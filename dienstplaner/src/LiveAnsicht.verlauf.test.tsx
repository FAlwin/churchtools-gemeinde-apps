// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ablaufZeileAus } from '@shared/ct/ablaufZeile';
import { liveListe, liveStandAus, type LiveGrund, type LiveStand } from '@shared/ct/liveAgenda';
import { wechselAus, zusammenfuehren, type Wechsel } from '@shared/ct/liveVerlauf';
import type { CtAgendaItem } from '@shared/ct/typen';
import type {
  VerlaufGrund,
  VerlaufLesen,
  VerlaufSchreiben,
} from '@shared/dienstplan/liveVerlaufSpeicher';
import { FEHLKLICK_HINWEIS_MS, LiveAnsicht } from './LiveAnsicht';
import { NACHTRAGEN_NACH_MS, VERLAUF_TAKT_MS } from './useVerlauf';

/**
 * **Live-Verlauf in der Live-Ansicht** (L4-3, Alwin 23.11.2026): ± je erledigtem Punkt, „Ende voraussichtlich“, „Warum“,
 * Nachtragen aus ChurchTools und der Fehlklick (A19). ChurchTools und der Speicher sind nachgebaut; die Wechsel entstehen aus
 * den echten Erzeugern (`wechselAus`, `liveStandAus`, `liveListe`). **Fake-Timer** überall – bei 30 s und 5 s täte sonst ein
 * echter Zeitgeber die Arbeit des Tests.
 */
const T = 216;
const ms = (iso: string) => Date.parse(iso);
const T0 = ms('2027-03-07T09:00:00Z');
const ISO = (t: number) => new Date(t).toISOString();

const TITEL = ['Begrüßung', 'Lobpreis', 'Predigt', 'Ansagen', 'Segen'];
const ITEMS: CtAgendaItem[] = TITEL.map((titel, i) => ({
  id: 100 + i,
  title: titel,
  type: 'text',
  duration: 300,
  startTimes: { [String(T)]: ISO(T0 + i * 300_000) },
}));
const ZEILEN = ITEMS.map((i) => ablaufZeileAus(i, T, 'Europe/Berlin'));
const LISTE = liveListe(ITEMS, T);

function stand(stelle: number | null, seit: string | null, zusatz = 0): LiveStand {
  return liveStandAus({
    pos_id: stelle === null ? null : String(stelle),
    switchdate: seit,
    addseconds: String(zusatz),
    category_id: '2',
    currentTime: Date.now(),
  }) as LiveStand;
}

/** Der Speicher des Verlaufs im Arbeitsspeicher – wie der echte: Schreiben führt zusammen, Lesen liefert alles. */
function speicher(anfang: Wechsel[] = []) {
  const s = {
    wechsel: [...anfang],
    lesenGrund: null as VerlaufGrund | null,
    schreibenGrund: null as VerlaufGrund | null,
  };
  const lesen = vi.fn(
    (_t: number): Promise<VerlaufLesen> =>
      Promise.resolve(
        s.lesenGrund
          ? { ok: false, grund: s.lesenGrund }
          : { ok: true, wechsel: [...s.wechsel], ausnahmen: [], vorhanden: s.wechsel.length > 0 },
      ),
  );
  const schreiben = vi.fn((_t: number, neue: readonly Wechsel[]): Promise<VerlaufSchreiben> => {
    if (s.schreibenGrund) return Promise.resolve({ ok: false, grund: s.schreibenGrund });
    s.wechsel = zusammenfuehren(s.wechsel, neue);
    return Promise.resolve({ ok: true, wechsel: [...s.wechsel], ausnahmen: [] });
  });
  return { s, lesen, schreiben };
}

/** ChurchTools nachgebaut (wie in `LiveAnsicht.test.tsx`): `switchdate` neu nur bei neuer Stelle, `addseconds` als Gesamtwert. */
function zeige(
  start: { stelle: number | null; seit: string | null; zusatz?: number },
  o: { steuern?: boolean; verlauf?: Wechsel[]; lesenGrund?: VerlaufGrund | null } = {},
) {
  const ct = { ...start };
  const lesen = vi.fn(() =>
    Promise.resolve({ ok: true, stand: stand(ct.stelle, ct.seit, ct.zusatz ?? 0) } as const),
  );
  const schreiben = vi.fn(
    (
      _t: number,
      _a: number,
      ziel: { stelle: number; zusatzSek: number },
    ): Promise<{ ok: true; stand: LiveStand } | { ok: false; grund: LiveGrund }> => {
      if (ziel.stelle !== ct.stelle) ct.seit = ISO(Date.now());
      ct.stelle = ziel.stelle;
      ct.zusatz = ziel.zusatzSek;
      return Promise.resolve({ ok: true, stand: stand(ct.stelle, ct.seit, ct.zusatz) });
    },
  );
  const v = speicher(o.verlauf);
  v.s.lesenGrund = o.lesenGrund ?? null;
  render(
    <LiveAnsicht
      titel="Gottesdienst"
      tag="2027-03-07"
      beginn="10:00"
      terminId={T}
      agendaId={126}
      items={ITEMS}
      zeilen={ZEILEN}
      infoGruppen={[]}
      zeitzone="Europe/Berlin"
      onSchliessen={() => {}}
      steuern={o.steuern ?? true}
      lesen={lesen}
      schreiben={schreiben}
      ablaufLesen={() => Promise.resolve({ id: 126, items: ITEMS })}
      betriebsartLesen={() =>
        Promise.resolve({
          betriebsart: 'klicken',
          gespeichert: null,
          unlesbar: false,
          fehler: null,
        })
      }
      verlaufLesen={v.lesen}
      verlaufSchreiben={v.schreiben}
    />,
  );
  return { ct, schreiben, v };
}

const fertig = () => act(() => vi.advanceTimersByTimeAsync(0));
const spulen = (msec: number) => act(() => vi.advanceTimersByTimeAsync(msec));
/** In Schritten: React rechnet Effekte erst am Ende eines `act` – ein langer Sprung ließe einen neuen Stand zu spät sehen. */
const spulenInSchritten = async (msec: number, schritt = 1000) => {
  for (let t = 0; t < msec; t += schritt) await spulen(schritt);
};
const knopf = (name: string) => screen.getByRole('button', { name });
const klick = async (name: string) => {
  fireEvent.click(knopf(name));
  await fertig();
};
const restzeit = () => screen.getByLabelText('Restzeit').textContent;
const konto = () => screen.getByLabelText('Zeitkonto').textContent;
const prognose = () => screen.getByLabelText('Voraussichtliches Ende').textContent;
const hinweis = () => screen.queryByText(/Fehlklick nicht gezählt/);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('± je erledigtem Punkt, „Ende voraussichtlich“ und „Warum“ (A14)', () => {
  it('Begrüßung 50 s früher fertig: + grün am Punkt, Konto, Prognose und Warum passen zusammen', async () => {
    const { v } = zeige({ stelle: 1, seit: ISO(T0) });
    await fertig();
    await spulen(250_000); // 09:04:10
    await klick('Zum nächsten Punkt');
    const plus = screen.getByLabelText('Plus/Minus +0:50');
    expect(plus.className).toMatch(/deltaPlus/);
    expect(plus.closest('li')?.textContent).toContain('Begrüßung');
    expect(konto()).toBe('Zeitkonto+0:50gespart');
    // Plan-Ende 09:25 (10:25 Ortszeit) minus 50 s = 09:24:10 → 10:24; Plan 10:25.
    expect(prognose()).toBe(
      'Ende voraussichtlich10:24Plan 10:25 · wenn der Rest nach Plan läuftBegrüßung+0:50',
    );
    // Der Wechsel steht einmal im Speicher (Nachtragen und Klick tragen denselben `switchdate` ein).
    expect(v.s.wechsel.map((w) => [w.stelle, w.zeit])).toEqual([
      [1, T0],
      [2, T0 + 250_000],
    ]);
  });

  it('überzogener Punkt: − rot, Prognose später und rot, „Warum“ nach Betrag', async () => {
    zeige({ stelle: 1, seit: ISO(T0) });
    await fertig();
    await spulen(400_000); // Begrüßung 100 s überzogen
    await klick('Zum nächsten Punkt');
    const minus = screen.getByLabelText('Plus/Minus −1:40');
    expect(minus.className).toMatch(/deltaMinus/);
    expect(konto()).toBe('Zeitkonto−1:40Rückstand');
    expect(prognose()).toContain('Ende voraussichtlich10:27');
    expect(screen.getByLabelText('Voraussichtliches Ende').querySelector('b')?.className).toMatch(
      /progSpaeter/,
    );
    const warum = within(screen.getByRole('list', { name: 'Warum' }));
    expect(warum.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Begrüßung−1:40']);
  });

  it('„Warum“ nennt höchstens die drei größten Abweichungen, egal ob Plus oder Minus', async () => {
    // Läufe 260 s (+40) · 380 s (−80) · 290 s (+10) · 400 s (−100) – dann läuft Segen.
    zeige({ stelle: 1, seit: ISO(T0) });
    await fertig();
    for (const sek of [260, 380, 290, 400]) {
      await spulen(sek * 1000);
      await klick('Zum nächsten Punkt');
    }
    const warum = within(screen.getByRole('list', { name: 'Warum' }));
    expect(warum.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Ansagen−1:40',
      'Lobpreis−1:20',
      'Begrüßung+0:40',
    ]);
  });

  it('der laufende Punkt hat noch kein ±; überzieht er, steht er im „Warum“', async () => {
    zeige({ stelle: 1, seit: ISO(T0) });
    await fertig();
    await spulen(200_000);
    expect(screen.queryByLabelText(/Plus\/Minus/)).toBeNull();
    await spulen(160_000); // 09:06:00 → 60 s drüber
    expect(screen.queryByLabelText(/Plus\/Minus/)).toBeNull();
    const warum = within(screen.getByRole('list', { name: 'Warum' }));
    expect(warum.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Begrüßung−1:00']);
  });

  it('„+1 Min“ ändert weder ± noch Konto (gerechnet gegen den ursprünglichen Plan)', async () => {
    zeige({ stelle: 1, seit: ISO(T0) });
    await fertig();
    await spulen(250_000);
    await klick('Eine Minute mehr');
    await klick('Zum nächsten Punkt');
    expect(screen.getByLabelText('Plus/Minus +0:50')).toBeTruthy();
  });

  it('Lesegerät ohne Steuer-Recht sieht ± und Prognose aus dem Verlauf – und schreibt nichts', async () => {
    const verlauf = [wechselAus(LISTE, 1, T0), wechselAus(LISTE, 2, T0 + 250_000, 0)];
    vi.setSystemTime(T0 + 260_000);
    const { v } = zeige({ stelle: 2, seit: ISO(T0 + 250_000) }, { steuern: false, verlauf });
    await fertig();
    expect(screen.getByLabelText('Plus/Minus +0:50')).toBeTruthy();
    expect(prognose()).toContain('Ende voraussichtlich10:24');
    await spulen(60_000);
    expect(v.schreiben).not.toHaveBeenCalled();
  });

  it.each([
    ['kein Recht oder keine Kategorie (leere Liste)', null],
    ['Lesefehler (Netz, 5xx)', 'voruebergehend'],
  ] as const)(
    'ohne Verlauf (%s): ± und „Warum“ fehlen leise, der Rest läuft',
    async (_n, grund) => {
      vi.setSystemTime(T0 + 260_000);
      zeige({ stelle: 2, seit: ISO(T0 + 250_000) }, { steuern: false, lesenGrund: grund });
      await spulen(VERLAUF_TAKT_MS);
      expect(restzeit()).toMatch(/noch/);
      expect(konto()).toMatch(/Zeitkonto/);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByLabelText(/Plus\/Minus/)).toBeNull();
      expect(screen.queryByRole('list', { name: 'Warum' })).toBeNull();
    },
  );

  it('kommt der Verlauf später (Lesefehler behoben), erscheinen ± und „Warum“', async () => {
    vi.setSystemTime(T0 + 260_000);
    const verlauf = [wechselAus(LISTE, 1, T0), wechselAus(LISTE, 2, T0 + 250_000, 0)];
    const { v } = zeige(
      { stelle: 2, seit: ISO(T0 + 250_000) },
      { steuern: false, lesenGrund: 'voruebergehend' },
    );
    await fertig();
    expect(screen.queryByLabelText(/Plus\/Minus/)).toBeNull();
    v.s.wechsel = verlauf;
    v.s.lesenGrund = null;
    await spulen(VERLAUF_TAKT_MS);
    expect(screen.getByLabelText('Plus/Minus +0:50')).toBeTruthy();
  });
});

describe('Verlauf festhalten und nachtragen (T4)', () => {
  it('ein offenes Gerät trägt einen Wechsel aus CT nach – erst nach der Schonfrist, nur einmal', async () => {
    const { ct, v } = zeige({ stelle: 2, seit: ISO(T0) });
    await fertig();
    await spulen(NACHTRAGEN_NACH_MS - 1000);
    expect(v.schreiben).not.toHaveBeenCalled();
    await spulen(2000);
    expect(v.schreiben).toHaveBeenCalledTimes(1);
    expect(v.schreiben.mock.calls[0][1]).toEqual([{ ...wechselAus(LISTE, 2, T0) }]);
    await spulen(60_000);
    expect(v.schreiben).toHaveBeenCalledTimes(1);
    // Jemand schaltet in der CT-App weiter: derselbe Weg, mit der Zusatzzeit davor.
    ct.zusatz = 60;
    await spulen(3_000);
    ct.stelle = 3;
    ct.seit = ISO(Date.now());
    ct.zusatz = 0;
    await spulenInSchritten(NACHTRAGEN_NACH_MS + 6000);
    expect(v.s.wechsel.map((w) => w.stelle)).toEqual([2, 3]);
    expect(v.s.wechsel[1].zusatzDavor).toBe(60);
  });

  it('hat das klickende Gerät den Wechsel schon festgehalten, trägt niemand ihn zusätzlich nach', async () => {
    const { v } = zeige({ stelle: 1, seit: ISO(T0) });
    await fertig();
    await spulen(10_000);
    await klick('Zum nächsten Punkt');
    await spulen(60_000);
    expect(v.s.wechsel).toHaveLength(2);
    const alle = v.schreiben.mock.calls.flatMap((c) => c[1]);
    // Jeder Wechsel wurde höchstens einmal übergeben (Klick und Nachtragen überschneiden sich nicht).
    expect(new Set(alle.map((w) => `${w.zeit}:${w.stelle}`)).size).toBe(alle.length);
  });

  it('ohne Steuer-Recht trägt das Gerät nichts nach, auch nicht nach Minuten', async () => {
    const { v } = zeige({ stelle: 2, seit: ISO(T0) }, { steuern: false });
    await fertig();
    await spulen(120_000);
    expect(v.schreiben).not.toHaveBeenCalled();
  });

  it('ein Gerät ohne Steuer-Recht schreibt auch dann nichts, wenn der Speicher kurz weniger liefert als es kennt', async () => {
    const verlauf = [wechselAus(LISTE, 1, T0), wechselAus(LISTE, 2, T0 + 250_000, 0)];
    vi.setSystemTime(T0 + 260_000);
    const { v } = zeige({ stelle: 2, seit: ISO(T0 + 250_000) }, { steuern: false, verlauf });
    await fertig();
    expect(screen.getByLabelText('Plus/Minus +0:50')).toBeTruthy();
    // Ein hinterherhinkender Speicher (alter Stand) – ein schreibendes Gerät würde das Fehlende nachschreiben, dieses nicht.
    v.s.wechsel = [verlauf[0]];
    await spulen(VERLAUF_TAKT_MS * 2);
    expect(v.schreiben).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Plus/Minus +0:50')).toBeTruthy();
  });

  it('fehlendes Recht an der Ablage (403): einmal versucht, danach Ruhe – die Anzeige läuft mit dem lokalen Verlauf weiter', async () => {
    const { v } = zeige({ stelle: 1, seit: ISO(T0) });
    v.s.schreibenGrund = 'kein-recht';
    await fertig();
    await spulen(250_000);
    await klick('Zum nächsten Punkt');
    await spulen(120_000);
    expect(v.schreiben.mock.calls.length).toBeLessThanOrEqual(2);
    const nachDemKlick = v.schreiben.mock.calls.length;
    await spulen(120_000);
    expect(v.schreiben).toHaveBeenCalledTimes(nachDemKlick);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Plus/Minus +0:50')).toBeTruthy();
  });

  it('vorübergehender Schreibfehler: nichts geht verloren, der nächste Takt versucht es noch einmal', async () => {
    const { v } = zeige({ stelle: 1, seit: ISO(T0) });
    await fertig();
    await spulen(250_000);
    v.s.schreibenGrund = 'voruebergehend';
    await klick('Zum nächsten Punkt');
    // Im Speicher steht nur, was vorher ankam (das Nachtragen von Begrüßung) – der Klick ist nicht angekommen.
    expect(v.s.wechsel.map((w) => w.stelle)).toEqual([1]);
    // Lokal ist der Wechsel trotzdem sofort da.
    expect(screen.getByLabelText('Plus/Minus +0:50')).toBeTruthy();
    v.s.schreibenGrund = null;
    await spulen(VERLAUF_TAKT_MS + 1000);
    expect(v.s.wechsel.map((w) => w.stelle)).toEqual([1, 2]);
  });

  it('ein anderes Gerät hat dazugeschrieben: sein Wechsel erscheint nach dem nächsten Lesen, unserer bleibt', async () => {
    const { v } = zeige({ stelle: 1, seit: ISO(T0) });
    await fertig();
    await spulen(250_000);
    await klick('Zum nächsten Punkt');
    v.s.wechsel = zusammenfuehren(v.s.wechsel, [wechselAus(LISTE, 3, T0 + 260_000, 0)]);
    await spulen(VERLAUF_TAKT_MS + 1000);
    expect(v.s.wechsel.map((w) => w.stelle)).toEqual([1, 2, 3]);
    expect(screen.getByLabelText('Plus/Minus +0:50')).toBeTruthy();
  });

  it('überschrieben von einem anderen Gerät (ChurchTools prüft keine Version): das Gerät, dem etwas fehlt, schreibt es nach', async () => {
    const { v } = zeige({ stelle: 1, seit: ISO(T0) });
    await fertig();
    await spulen(250_000);
    await klick('Zum nächsten Punkt');
    expect(v.s.wechsel).toHaveLength(2);
    // Ein anderes Gerät ersetzt den Wert und kennt unseren Wechsel nicht.
    v.s.wechsel = [wechselAus(LISTE, 1, T0)];
    await spulen(VERLAUF_TAKT_MS + 1000);
    expect(v.s.wechsel.map((w) => w.stelle)).toEqual([1, 2]);
  });
});

describe('Fehlklick zählt nicht (A19, T9)', () => {
  /** Lobpreis läuft seit 09:05:00 (Plan), jetzt 09:06:40; Weiter auf Predigt, 5 s später Zurück. */
  async function fehlklick() {
    vi.setSystemTime(T0 + 300_000);
    const h = zeige({ stelle: 2, seit: ISO(T0 + 300_000) });
    await fertig();
    await spulen(100_000); // 09:06:40
    await klick('Zum nächsten Punkt');
    expect(restzeit()).toBe('5:00noch, von 5 Min');
    await spulen(5_000);
    await klick('Zum vorigen Punkt');
    return h;
  }

  it('Weiter, nach 5 s Zurück: der Punkt läuft mit seiner alten Zeit weiter – Hinweis unten', async () => {
    const { schreiben } = await fehlklick();
    // Lobpreis lief 105 s (09:05:00 → 09:06:45): 3:15 sind übrig, als wäre man nie weg gewesen.
    expect(restzeit()).toBe('3:15noch, von 5 Min');
    expect(konto()).toBe('Zeitkonto±0:00im Plan');
    expect(
      within(screen.getByRole('heading', { level: 2 }).closest('section')!).getByText('Lobpreis'),
    ).toBeTruthy();
    expect(hinweis()?.closest('p')?.textContent).toBe(
      'Zeit läuft weiter – Fehlklick nicht gezählt ·Neu starten',
    );
    // CT: erst der Wechsel (Zusatzzeit 0), dann der Ausgleich = alte Zusatzzeit − gelaufene Sekunden.
    expect(schreiben.mock.calls.slice(-2).map((c) => c[2])).toEqual([
      { stelle: 2, zusatzSek: 0 },
      { stelle: 2, zusatzSek: -105 },
    ]);
  });

  it('die kurzen Stopps zählen nicht: Predigt bekommt kein ±, Lobpreis bei „Weiter“ danach den ganzen Lauf', async () => {
    await fehlklick();
    expect(screen.queryByLabelText(/Plus\/Minus/)).toBeNull();
    await spulen(60_000); // 09:07:45: 165 s gelaufen
    await klick('Zum nächsten Punkt');
    expect(screen.getByLabelText('Plus/Minus +2:15').closest('li')?.textContent).toContain(
      'Lobpreis',
    );
  });

  it('der Hinweis verschwindet nach etwa fünf Sekunden, die Zeit läuft weiter', async () => {
    await fehlklick();
    await spulen(FEHLKLICK_HINWEIS_MS - 1000);
    expect(hinweis()).toBeTruthy();
    await spulen(1500);
    expect(hinweis()).toBeNull();
    expect(restzeit()).toBe('3:10noch, von 5 Min');
  });

  it('„Neu starten“ macht daraus einen normalen Wechsel: der Punkt beginnt von vorn, der Ausgleich ist zurück', async () => {
    const { schreiben, v } = await fehlklick();
    await klick('Neu starten');
    expect(schreiben).toHaveBeenLastCalledWith(T, 126, { stelle: 2, zusatzSek: 0 });
    expect(restzeit()).toBe('5:00noch, von 5 Min');
    expect(hinweis()).toBeNull();
    expect(konto()).toBe('Zeitkonto−1:45Rückstand');
    expect(v.s.wechsel.filter((w) => w.neu === true).map((w) => w.stelle)).toEqual([2]);
    // Und es bleibt so: auch nach dem nächsten Lesen ist es ein normaler Wechsel.
    await spulen(VERLAUF_TAKT_MS);
    expect(restzeit()).toMatch(/^4:4\d/);
  });

  it('nach „Neu starten“ steht der Fehlklick-Punkt nicht im „Warum“ (er hat gar nicht stattgefunden)', async () => {
    await fehlklick();
    await klick('Neu starten');
    await spulen(VERLAUF_TAKT_MS);
    expect(screen.queryByLabelText(/Plus\/Minus/)).toBeNull();
    const warum = screen.queryByRole('list', { name: 'Warum' });
    expect(warum?.textContent ?? '').not.toContain('Predigt');
  });

  it('war der Punkt dazwischen 30 Sekunden dran, ist es ein normaler Wechsel – kein Hinweis, kein Ausgleich', async () => {
    vi.setSystemTime(T0 + 300_000);
    const { schreiben } = zeige({ stelle: 2, seit: ISO(T0 + 300_000) });
    await fertig();
    await spulen(100_000);
    await klick('Zum nächsten Punkt');
    await spulen(30_000);
    const vorher = schreiben.mock.calls.length;
    await klick('Zum vorigen Punkt');
    expect(schreiben.mock.calls.length).toBe(vorher + 1);
    expect(hinweis()).toBeNull();
    expect(restzeit()).toBe('5:00noch, von 5 Min');
  });

  it('mehrere Schritte: Weiter, Weiter, Zurück, Zurück – wieder beim ersten Punkt, alte Zeit', async () => {
    vi.setSystemTime(T0 + 300_000);
    zeige({ stelle: 2, seit: ISO(T0 + 300_000) });
    await fertig();
    await spulen(100_000);
    for (const art of [
      'Zum nächsten Punkt',
      'Zum nächsten Punkt',
      'Zum vorigen Punkt',
      'Zum vorigen Punkt',
    ]) {
      await spulen(3_000);
      await klick(art);
    }
    // 09:05:00 → 09:06:52 = 112 s gelaufen
    expect(restzeit()).toBe('3:08noch, von 5 Min');
    expect(hinweis()).toBeTruthy();
  });

  it('Ausgleich scheitert (CT antwortet nicht): die Anzeige rechnet trotzdem richtig, es gibt keine Fehlermeldung', async () => {
    vi.setSystemTime(T0 + 300_000);
    const { schreiben } = zeige({ stelle: 2, seit: ISO(T0 + 300_000) });
    await fertig();
    await spulen(100_000);
    await klick('Zum nächsten Punkt');
    await spulen(5_000);
    const echt = schreiben.getMockImplementation();
    let n = 0;
    schreiben.mockImplementation((t, a, ziel) => {
      n++;
      return n === 2
        ? Promise.resolve({ ok: false, grund: 'voruebergehend' } as const)
        : (echt as NonNullable<typeof echt>)(t, a, ziel);
    });
    await klick('Zum vorigen Punkt');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(restzeit()).toBe('3:15noch, von 5 Min');
  });

  it('der Klick liest den Verlauf frisch: auch wenn das Gerät ihn beim Öffnen nicht lesen konnte, gilt die Regel', async () => {
    const vorher = [wechselAus(LISTE, 2, T0 + 300_000), wechselAus(LISTE, 3, T0 + 400_000, 0)];
    vi.setSystemTime(T0 + 400_000);
    const { v } = zeige(
      { stelle: 3, seit: ISO(T0 + 400_000) },
      { verlauf: vorher, lesenGrund: 'voruebergehend' },
    );
    await fertig();
    await spulen(5_000);
    // Das Lesen klappt wieder – aber erst der Klick holt den Verlauf (der Takt ist 15 s).
    v.s.lesenGrund = null;
    await klick('Zum vorigen Punkt');
    expect(hinweis()).toBeTruthy();
    expect(restzeit()).toBe('3:15noch, von 5 Min');
  });

  it('der Hinweis verschwindet, sobald ein anderes Gerät weiterschaltet', async () => {
    const { ct } = await fehlklick();
    expect(hinweis()).toBeTruthy();
    ct.stelle = 4;
    ct.seit = ISO(Date.now());
    ct.zusatz = 0;
    await spulenInSchritten(3_000);
    expect(hinweis()).toBeNull();
  });

  it('ohne Steuer-Recht gibt es weder Hinweis noch „Neu starten“', async () => {
    zeige({ stelle: 2, seit: ISO(T0) }, { steuern: false });
    await fertig();
    expect(hinweis()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Neu starten' })).toBeNull();
  });
});
