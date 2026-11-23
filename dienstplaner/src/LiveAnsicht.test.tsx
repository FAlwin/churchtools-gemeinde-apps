// @vitest-environment jsdom
import { useState, type ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ablaufZeileAus } from '@shared/ct/ablaufZeile';
import {
  liveStandAus,
  type Betriebsart,
  type LiveGrund,
  type LiveStand,
} from '@shared/ct/liveAgenda';
import { zusammenfuehren, type Wechsel } from '@shared/ct/liveVerlauf';
import type { CtAgendaItem } from '@shared/ct/typen';
import type { EinstellungenStand } from '@shared/dienstplan/liveEinstellungen';
import type { VerlaufLesen, VerlaufSchreiben } from '@shared/dienstplan/liveVerlaufSpeicher';
import { LiveAnsicht as LiveAnsichtEcht } from './LiveAnsicht';
import { TAKT_MS } from './useLive';
import { BETRIEBSART_NOCHMAL_MS, BETRIEBSART_TAKT_MS } from './useBetriebsart';

/** Die Betriebsart, wie `ladeEinstellungen` sie liefert – ohne ChurchTools. `fehler`: das Lesen ist gescheitert. */
const betriebsartMit =
  (betriebsart: Betriebsart, fehler: EinstellungenStand['fehler'] = null) =>
  (): Promise<EinstellungenStand> =>
    Promise.resolve({ betriebsart, gespeichert: null, unlesbar: false, fehler });

/**
 * Die Ansicht mit der Betriebsart „immer nach der Uhr“ als Vorgabe – so verhielt sie sich vor L4-2, und die alten Tests
 * unten prüfen genau das. Die neuen Betriebsarten haben einen eigenen Block (`betriebsartLesen` überschreibt die Vorgabe).
 */
function LiveAnsicht(p: ComponentProps<typeof LiveAnsichtEcht>) {
  const [verlauf] = useState(verlaufImSpeicher);
  return (
    <LiveAnsichtEcht
      betriebsartLesen={betriebsartMit('immer-uhr')}
      verlaufLesen={verlauf.lesen}
      verlaufSchreiben={verlauf.schreiben}
      {...p}
    />
  );
}

/**
 * Der Live-Verlauf (L4-3) ist hier nicht das Thema: ein Speicher im Arbeitsspeicher, der sich wie der echte verhält (Schreiben
 * führt zusammen, Lesen liefert alles). Er hat einen eigenen Testblock (`LiveAnsicht.verlauf.test.tsx`).
 */
function verlaufImSpeicher() {
  let wechsel: Wechsel[] = [];
  return {
    lesen: (): Promise<VerlaufLesen> =>
      Promise.resolve({
        ok: true,
        wechsel: [...wechsel],
        ausnahmen: [],
        vorhanden: wechsel.length > 0,
      }),
    schreiben: (_t: number, neue: readonly Wechsel[]): Promise<VerlaufSchreiben> => {
      wechsel = zusammenfuehren(wechsel, neue);
      return Promise.resolve({ ok: true, wechsel: [...wechsel], ausnahmen: [] });
    },
  };
}

/**
 * **„Live“ zum Folgen** (E6b-2 L2, Entwurf `e6b-2-live.html` Variante A). Der Stand kommt aus `liveStandAus` (Antworten
 * wie gemessen), Liste und Lage aus dem echten Kern; nur das Lesen ist ersetzt. **Fake-Timer:** Takt (2,5 s) und Uhr
 * (1 s) werden vorgespult, sonst täte ein echter Zeitgeber die Arbeit, die der Test der Ansicht zuschreibt.
 */
const T = 216;
const ms = (iso: string) => Date.parse(iso);

/** Der Ablauf des Probe-Termins aus der Messung L0 – „Lied“ weggelassen –, dazu Zuständige, Infos und ein Lied ohne Dauer. */
const ITEMS: CtAgendaItem[] = [
  {
    id: 964,
    title: 'Ankommen',
    type: 'header',
    duration: 0,
    startTimes: { '216': '2027-03-07T09:00:00Z' },
  },
  {
    id: 968,
    title: 'Begrüßung',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:00:00Z' },
  },
  { id: 970, title: 'Lied', type: 'text', duration: 240, startTimes: { '216': null } },
  {
    id: 972,
    title: 'Predigt',
    type: 'text',
    duration: 1800,
    startTimes: { '216': '2027-03-07T09:05:00Z' },
    responsible: {
      text: '[Predigt]',
      persons: [{ service: '[Predigt]', person: { title: 'Clara Test' } }],
    },
    note: 'Thema folgt',
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Headset' }],
  },
  {
    id: 973,
    title: 'Lied',
    type: 'song',
    duration: 0,
    startTimes: { '216': '2027-03-07T09:35:00Z' },
    song: { title: 'Wie groß', songId: 5, arrangementId: 7 } as CtAgendaItem['song'],
  },
  {
    id: 974,
    title: 'Ansagen',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:35:00Z' },
  },
  {
    id: 976,
    title: 'Segen',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:40:00Z' },
  },
];
const ZEILEN = ITEMS.map((i) => ablaufZeileAus(i, T, 'Europe/Berlin'));
const ENDE = 7;

/** Eine Antwort wie gemessen; `uhrVor`: um wie viel die Uhr des Geräts der von ChurchTools vorausgeht. */
function stand(
  stelle: number | null,
  seit: string | null,
  o: { zusatz?: number; uhrVor?: number } = {},
): LiveStand {
  return liveStandAus({
    pos_id: stelle === null ? null : String(stelle),
    switchdate: seit,
    addseconds: o.zusatz === undefined ? null : String(o.zusatz),
    category_id: '2',
    currentTime: Date.now() - (o.uhrVor ?? 0),
  }) as LiveStand;
}

type Antwort =
  | { stelle: number | null; seit: string | null; zusatz?: number; uhrVor?: number }
  | LiveGrund;

function zeige(antworten: Antwort[]) {
  const folge = [...antworten];
  const lesen = vi.fn((_t: number, _a: number) => {
    const a = folge.length > 1 ? folge.shift()! : folge[0];
    return Promise.resolve(
      typeof a === 'string'
        ? ({ ok: false, grund: a } as const)
        : ({ ok: true, stand: stand(a.stelle, a.seit, a) } as const),
    );
  });
  const onSchliessen = vi.fn();
  render(
    <LiveAnsicht
      titel="Gottesdienst"
      tag="2027-03-07"
      beginn="10:00"
      terminId={T}
      agendaId={126}
      items={ITEMS}
      zeilen={ZEILEN}
      infoGruppen={[{ id: 3, name: 'Technik' }]}
      zeitzone="Europe/Berlin"
      onSchliessen={onSchliessen}
      lesen={lesen}
    />,
  );
  return { lesen, onSchliessen };
}

/** Promises der Abfrage abarbeiten, ohne die Zeit weiterzudrehen. */
const fertig = () => act(() => vi.advanceTimersByTimeAsync(0));
const spulen = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

const jetztBereich = () => screen.getByRole('region', { name: 'Jetzt' });
const restzeit = () => screen.getByLabelText('Restzeit').textContent;

function sichtbarkeit(wert: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => wert });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(ms('2027-03-07T09:08:00Z'));
  sichtbarkeit('visible');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LiveAnsicht', () => {
  it('läuft: Jetzt mit Zuständigen und Infos, Dann, Restzeit, Abweichung, Liste mit erledigt/weggelassen/aktuell', async () => {
    zeige([{ stelle: 3, seit: '2027-03-07T09:07:00Z' }]);
    await fertig();
    const jetzt = jetztBereich();
    expect(within(jetzt).getByText('Jetzt')).toBeTruthy();
    expect(within(jetzt).getByRole('heading').textContent).toBe('Predigt');
    // Die Notiz wie in der Live-Agenda von ChurchTools.
    expect(within(jetzt).getByText('Thema folgt')).toBeTruthy();
    expect(within(jetzt).getByText('Clara Test')).toBeTruthy();
    expect(within(jetzt).getByText(/Headset/).textContent).toBe('Technik: Headset');
    // Das Lied ohne Dauer läuft mit „Jetzt“ mit, „Dann“ ist der nächste eigene Punkt.
    expect(within(jetzt).getByText('mit Lied – Wie groß')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Dann' })).getByText('Ansagen')).toBeTruthy();
    expect(restzeit()).toBe('29:00noch, von 30 Min');
    // Zeitkonto statt „Gesamt“: Predigt Plan 10:05, begonnen 10:07 → 2 Min. Rückstand (A5: Minus rot).
    expect(screen.getByLabelText('Zeitkonto').textContent).toBe('Zeitkonto−2:00Rückstand');
    expect(screen.getByLabelText('Zeitkonto').className).toMatch(/minus/);
    expect(screen.queryByText(/Gesamt|später|früher/)).toBeNull();
    const liste = screen.getByRole('list', { name: 'Ablauf' });
    const punkte = within(liste).getAllByRole('listitem');
    expect(punkte.map((p) => p.textContent)).toEqual([
      '10:00Begrüßung',
      'Lied',
      // Die Info der eigenen Dienstgruppe steht auch beim laufenden Punkt klein darunter (A16).
      '10:05PredigtClara TestTechnik: Headset',
      '10:35Lied – Wie groß',
      '10:35Ansagen',
      '10:40Segen',
    ]);
    expect(punkte[0].className).toMatch(/erledigt/);
    expect(punkte[0].querySelector('svg')).toBeTruthy();
    expect(punkte[1].className).toMatch(/weggelassen/);
    expect(punkte[2].getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Live').getAttribute('data-laeuft')).toBe('true');
  });

  it('nicht gestartet: „Jetzt“ nach der Uhr, mit Hinweis – kein Punkt „läuft“, kein Zeitkonto', async () => {
    vi.setSystemTime(ms('2027-03-07T09:10:00Z'));
    zeige([{ stelle: null, seit: null }]);
    await fertig();
    expect(within(jetztBereich()).getByText('Jetzt · nach Plan')).toBeTruthy();
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Predigt');
    expect(screen.getByText('Noch nicht gestartet – „Jetzt“ folgt der Uhr.')).toBeTruthy();
    expect(restzeit()).toBe('25:00noch, von 30 Min');
    expect(screen.queryByLabelText('Zeitkonto')).toBeNull();
    expect(screen.queryByText(/Gesamt/)).toBeNull();
    expect(screen.getByText('Live').getAttribute('data-laeuft')).toBe('false');
  });

  it('vor dem ersten Punkt: „Noch nicht begonnen“ mit Beginn, „Dann“ der erste', async () => {
    vi.setSystemTime(ms('2027-03-07T08:50:00Z'));
    zeige([{ stelle: null, seit: null }]);
    await fertig();
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Noch nicht begonnen');
    expect(within(jetztBereich()).getByText('Beginn 10:00')).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Dann' })).getByText('Begrüßung'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Restzeit')).toBeNull();
  });

  it('Zeit um: rot, „−1:45“ (wie das Zeitkonto: Minus = Rückstand, A5) und „über der Zeit“', async () => {
    vi.setSystemTime(ms('2027-03-07T09:06:45Z'));
    zeige([{ stelle: 1, seit: '2027-03-07T09:00:00Z' }]);
    await fertig();
    expect(restzeit()).toBe('−1:45über der Zeit');
    expect(screen.getByLabelText('Restzeit').className).toMatch(/ueber/);
    // Kein Bogen mehr, nur die rote Spur (sonst stand oben ein blauer Punkt – Demo, 02.11.2026).
    expect(screen.getByLabelText('Restzeit').querySelectorAll('circle')).toHaveLength(1);
  });

  it('Ende: „Ablauf vorbei“, fertig um, Endstand des Zeitkontos; alles erledigt', async () => {
    vi.setSystemTime(ms('2027-03-07T09:50:00Z'));
    zeige([{ stelle: ENDE, seit: '2027-03-07T09:49:00Z' }]);
    await fertig();
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Ablauf vorbei');
    expect(within(jetztBereich()).getByText(/Fertig um/).textContent).toBe('Fertig um 10:49');
    // Plan-Ende 09:45 (UTC), letzter Klick 09:49 → 4 Min. Rückstand als Endstand.
    expect(screen.getByLabelText('Zeitkonto').textContent).toBe('Zeitkonto−4:00Rückstand');
    expect(screen.queryByRole('region', { name: 'Dann' })).toBeNull();
    const punkte = within(screen.getByRole('list', { name: 'Ablauf' })).getAllByRole('listitem');
    expect(punkte.filter((p) => /erledigt/.test(p.className))).toHaveLength(5);
  });

  it('rechnet in der Uhr von ChurchTools: geht das Gerät 3 s vor, stimmt die Restzeit trotzdem', async () => {
    zeige([{ stelle: 3, seit: '2027-03-07T09:07:57Z', uhrVor: 3000 }]);
    await fertig();
    // ChurchTools-Zeit 09:07:57 = Wechsel gerade eben → volle 30:00 (ohne Abgleich wären es 29:57).
    expect(restzeit()).toBe('30:00noch, von 30 Min');
  });

  it('fragt sofort und dann alle 2,5 s – folgt einem Weiterschalten in ChurchTools; die Restzeit läuft jede Sekunde', async () => {
    const { lesen } = zeige([
      { stelle: 3, seit: '2027-03-07T09:07:00Z' },
      { stelle: 3, seit: '2027-03-07T09:07:00Z' },
      { stelle: 5, seit: '2027-03-07T09:08:02Z' },
    ]);
    await fertig();
    expect(lesen).toHaveBeenCalledTimes(1);
    expect(lesen).toHaveBeenLastCalledWith(T, 126);
    await spulen(1000);
    expect(restzeit()).toBe('28:59noch, von 30 Min');
    await spulen(TAKT_MS - 1001);
    expect(lesen).toHaveBeenCalledTimes(1);
    await spulen(1);
    expect(lesen).toHaveBeenCalledTimes(2);
    await spulen(TAKT_MS);
    expect(lesen).toHaveBeenCalledTimes(3);
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Ansagen');
  });

  it('langsame Leitung: die nächste Abfrage erst, wenn die vorige zurück ist', async () => {
    let antworten: (() => void) | null = null;
    const lesen = vi.fn(
      () =>
        new Promise<{ ok: true; stand: LiveStand }>((ok) => {
          antworten = () => ok({ ok: true, stand: stand(3, '2027-03-07T09:07:00Z') });
        }),
    );
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
        lesen={lesen}
      />,
    );
    await spulen(TAKT_MS * 4);
    // Auch ein Wechsel der Sichtbarkeit fragt nicht doppelt.
    sichtbarkeit('visible');
    await fertig();
    expect(lesen).toHaveBeenCalledTimes(1);
    await act(async () => antworten?.());
    await spulen(TAKT_MS);
    expect(lesen).toHaveBeenCalledTimes(2);
  });

  it('kurzer Aussetzer: der letzte Stand bleibt, Hinweis mit Uhrzeit, es wird weiter gefragt', async () => {
    // Stand „Ansagen“, obwohl laut Uhr die Predigt dran wäre – nur so sieht man, dass der Stand stehen bleibt.
    const { lesen } = zeige([{ stelle: 5, seit: '2027-03-07T09:07:00Z' }, 'voruebergehend']);
    await fertig();
    await spulen(TAKT_MS);
    expect(screen.getByRole('status').textContent).toBe(
      'Keine Verbindung – Stand von 10:08 Uhr. Wird wieder versucht.',
    );
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Ansagen');
    expect(within(jetztBereich()).getByText('Jetzt')).toBeTruthy();
    await spulen(TAKT_MS);
    expect(lesen).toHaveBeenCalledTimes(3);
  });

  it('nie gelesen und ChurchTools antwortet nicht: nach der Uhr, mit Hinweis', async () => {
    zeige(['voruebergehend']);
    await fertig();
    expect(screen.getByRole('status').textContent).toMatch(/antwortet gerade nicht/);
    expect(within(jetztBereich()).getByText('Jetzt · nach Plan')).toBeTruthy();
  });

  it.each([
    ['kein-recht', 'ChurchTools lässt dich die Live-Agenda dieses Termins nicht sehen.'],
    [
      'abgemeldet',
      'Du bist bei ChurchTools abgemeldet. Bitte neu anmelden und „Live“ wieder öffnen.',
    ],
    ['unlesbar', 'ChurchTools antwortet anders als erwartet – „Live“ geht gerade nicht.'],
  ] as const)(
    '%s: Meldung, und es wird nicht mehr gefragt – auch nicht beim Zurückkehren',
    async (grund, text) => {
      const { lesen } = zeige([grund]);
      await fertig();
      expect(screen.getByRole('status').textContent).toBe(text);
      await spulen(TAKT_MS * 4);
      sichtbarkeit('visible');
      await fertig();
      expect(lesen).toHaveBeenCalledTimes(1);
    },
  );

  it('nur solange sichtbar: verdeckt keine Abfragen, beim Zurückkehren sofort', async () => {
    const { lesen } = zeige([{ stelle: 3, seit: '2027-03-07T09:07:00Z' }]);
    await fertig();
    sichtbarkeit('hidden');
    await spulen(TAKT_MS * 4);
    expect(lesen).toHaveBeenCalledTimes(1);
    sichtbarkeit('visible');
    await fertig();
    expect(lesen).toHaveBeenCalledTimes(2);
    await spulen(TAKT_MS);
    expect(lesen).toHaveBeenCalledTimes(3);
  });

  it('nach dem Schließen keine Abfragen mehr', async () => {
    const { lesen, onSchliessen } = zeige([{ stelle: 3, seit: '2027-03-07T09:07:00Z' }]);
    await fertig();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    cleanup();
    await spulen(TAKT_MS * 3);
    expect(lesen).toHaveBeenCalledTimes(1);
  });

  it('eine Antwort, die erst nach dem Schließen kommt, stößt keine weitere Abfrage an', async () => {
    let antworten: (() => void) | null = null;
    const lesen = vi.fn(
      () =>
        new Promise<{ ok: true; stand: LiveStand }>((ok) => {
          antworten = () => ok({ ok: true, stand: stand(3, '2027-03-07T09:07:00Z') });
        }),
    );
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
        lesen={lesen}
      />,
    );
    await fertig();
    cleanup();
    await act(async () => antworten?.());
    await spulen(TAKT_MS * 3);
    expect(lesen).toHaveBeenCalledTimes(1);
  });

  it('Esc schließt', async () => {
    const { onSchliessen } = zeige([{ stelle: 3, seit: '2027-03-07T09:07:00Z' }]);
    await fertig();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSchliessen).toHaveBeenCalledTimes(1);
  });
});

describe('LiveAnsicht – steuern (L3)', () => {
  /** ChurchTools nachgebaut: Lesen liefert den Stand, Schreiben übernimmt ihn (wie gemessen: Beginn neu nur bei neuer Stelle). */
  function zeigeSteuern(
    start: { stelle: number | null; seit: string | null; zusatz?: number },
    o: {
      steuern?: boolean;
      schreibeFehler?: LiveGrund;
      ablauf?: CtAgendaItem[] | 'fehler';
    } = {},
  ) {
    let aktuell = { ...start };
    const lesen = vi.fn(() =>
      Promise.resolve({ ok: true, stand: stand(aktuell.stelle, aktuell.seit, aktuell) } as const),
    );
    const schreiben = vi.fn(
      (_t: number, _a: number, ziel: { stelle: number; zusatzSek: number }) => {
        if (o.schreibeFehler)
          return Promise.resolve({ ok: false, grund: o.schreibeFehler } as const);
        const seit =
          ziel.stelle === aktuell.stelle ? aktuell.seit : new Date(Date.now()).toISOString();
        aktuell = { stelle: ziel.stelle, seit, zusatz: ziel.zusatzSek };
        return Promise.resolve({
          ok: true,
          stand: stand(aktuell.stelle, aktuell.seit, aktuell),
        } as const);
      },
    );
    const ablaufLesen = vi.fn(() =>
      o.ablauf === 'fehler'
        ? Promise.reject(new Error('Netz'))
        : Promise.resolve({ id: 126, items: o.ablauf ?? ITEMS }),
    );
    const onAblauf = vi.fn();
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
        onAblauf={onAblauf}
        lesen={lesen}
        schreiben={schreiben}
        ablaufLesen={ablaufLesen}
      />,
    );
    return { lesen, schreiben, ablaufLesen, onAblauf };
  }
  const knopf = (name: string) => screen.getByRole('button', { name });
  const klick = async (name: string) => {
    fireEvent.click(knopf(name));
    await fertig();
  };
  const knoepfe = () =>
    within(screen.getByRole('group', { name: 'Live-Agenda steuern' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));

  it('ohne Recht keine Knöpfe – nur folgen', async () => {
    zeigeSteuern({ stelle: 3, seit: '2027-03-07T09:07:00Z' }, { steuern: false });
    await fertig();
    expect(screen.queryByRole('group', { name: 'Live-Agenda steuern' })).toBeNull();
  });

  it('nicht gestartet: nur „Starten“ – schaltet auf den ersten Punkt und zeigt ihn sofort', async () => {
    const { schreiben } = zeigeSteuern({ stelle: null, seit: null });
    await fertig();
    expect(knoepfe()).toEqual(['Live-Agenda starten']);
    await klick('Live-Agenda starten');
    expect(schreiben).toHaveBeenCalledWith(T, 126, { stelle: 1, zusatzSek: 0 });
    // Sofort, nicht erst bei der nächsten Abfrage.
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Begrüßung');
    expect(within(jetztBereich()).getByText('Jetzt')).toBeTruthy();
  });

  it('läuft: Weiter überspringt Lieder ohne Dauer, Zurück den weggelassenen; ±1 Min als Gesamtwert', async () => {
    const { schreiben } = zeigeSteuern({ stelle: 3, seit: '2027-03-07T09:07:00Z' });
    await fertig();
    // Reihenfolge der Leiste unten: Zurück · −1 / +1 Min · Weiter.
    expect(knoepfe()).toEqual([
      'Zum vorigen Punkt',
      'Eine Minute weniger',
      'Eine Minute mehr',
      'Zum nächsten Punkt',
    ]);
    await klick('Eine Minute mehr');
    expect(schreiben).toHaveBeenLastCalledWith(T, 126, { stelle: 3, zusatzSek: 60 });
    expect(restzeit()).toBe('30:00noch, von 31 Min');
    await klick('Eine Minute weniger');
    expect(schreiben).toHaveBeenLastCalledWith(T, 126, { stelle: 3, zusatzSek: 0 });
    await klick('Zum nächsten Punkt');
    expect(schreiben).toHaveBeenLastCalledWith(T, 126, { stelle: 5, zusatzSek: 0 });
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Ansagen');
    await klick('Zum vorigen Punkt');
    await klick('Zum vorigen Punkt');
    expect(schreiben).toHaveBeenLastCalledWith(T, 126, { stelle: 1, zusatzSek: 0 });
  });

  it('am Ende: nur Zurück, Weiter gesperrt', async () => {
    zeigeSteuern({ stelle: ENDE, seit: '2027-03-07T09:07:00Z' });
    await fertig();
    expect(knoepfe()).toEqual(['Zum vorigen Punkt', 'Zum nächsten Punkt']);
    expect(knopf('Zum nächsten Punkt').hasAttribute('disabled')).toBe(true);
    expect(knopf('Zum vorigen Punkt').hasAttribute('disabled')).toBe(false);
  });

  it('Ablauf geändert (Begrüßung gelöscht): erst die Stelle nachziehen, dann schalten – und den Ablauf weitergeben', async () => {
    const ohneBegruessung = ITEMS.filter((i) => i.id !== 968);
    const { schreiben, onAblauf } = zeigeSteuern(
      { stelle: 3, seit: '2027-03-07T09:07:00Z' },
      { ablauf: ohneBegruessung },
    );
    await fertig();
    await klick('Eine Minute mehr');
    // Die Predigt ist jetzt Stelle 2 – ohne Nachziehen stünde hier 3 (das Lied ohne Dauer).
    expect(schreiben).toHaveBeenLastCalledWith(T, 126, { stelle: 2, zusatzSek: 60 });
    expect(onAblauf).toHaveBeenCalledWith({ id: 126, items: ohneBegruessung });
  });

  it('unveränderter Ablauf wird nicht weitergegeben; scheitert das Lesen des Ablaufs, wird trotzdem geschaltet', async () => {
    const a = zeigeSteuern({ stelle: 3, seit: '2027-03-07T09:07:00Z' });
    await fertig();
    await klick('Zum nächsten Punkt');
    expect(a.onAblauf).not.toHaveBeenCalled();
    cleanup();
    const b = zeigeSteuern({ stelle: 3, seit: '2027-03-07T09:07:00Z' }, { ablauf: 'fehler' });
    await fertig();
    await klick('Zum nächsten Punkt');
    expect(b.schreiben).toHaveBeenLastCalledWith(T, 126, { stelle: 5, zusatzSek: 0 });
  });

  it.each([
    [
      'nicht-angekommen',
      'Nicht übernommen – vermutlich hat gerade jemand anderes geschaltet. Der aktuelle Stand wird geladen.',
    ],
    [
      'voruebergehend',
      'Nicht gespeichert – ChurchTools antwortet gerade nicht. Bitte noch einmal tippen.',
    ],
  ] as const)('Schalten scheitert (%s): Meldung, der Stand bleibt', async (grund, text) => {
    zeigeSteuern({ stelle: 3, seit: '2027-03-07T09:07:00Z' }, { schreibeFehler: grund });
    await fertig();
    await klick('Zum nächsten Punkt');
    expect(screen.getByRole('alert').textContent).toBe(text);
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Predigt');
  });

  it('während geschrieben wird, sind die Knöpfe gesperrt – zweimal tippen schaltet nur einmal', async () => {
    const { schreiben } = zeigeSteuern({ stelle: 3, seit: '2027-03-07T09:07:00Z' });
    await fertig();
    fireEvent.click(knopf('Zum nächsten Punkt'));
    fireEvent.click(knopf('Zum nächsten Punkt'));
    await fertig();
    expect(schreiben).toHaveBeenCalledTimes(1);
  });

  it('eine Abfrage, die vor dem Schalten losging, überschreibt den neuen Stand nicht', async () => {
    let alteAntwort: (() => void) | null = null;
    let erste = true;
    const lesen = vi.fn(() => {
      if (erste) {
        erste = false;
        return Promise.resolve({ ok: true, stand: stand(3, '2027-03-07T09:07:00Z') } as const);
      }
      return new Promise<{ ok: true; stand: LiveStand }>((ok) => {
        alteAntwort = () => ok({ ok: true, stand: stand(3, '2027-03-07T09:07:00Z') });
      });
    });
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
        steuern
        lesen={lesen}
        schreiben={() =>
          Promise.resolve({
            ok: true,
            stand: stand(5, new Date(Date.now()).toISOString()),
          } as const)
        }
        ablaufLesen={() => Promise.resolve({ id: 126, items: ITEMS })}
      />,
    );
    await fertig();
    await spulen(TAKT_MS); // zweite Abfrage läuft jetzt (hängt)
    await klick('Zum nächsten Punkt');
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Ansagen');
    await act(async () => alteAntwort?.());
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Ansagen');
  });
});

/**
 * **Live-Ansicht 2, Anzeige (L4-1)** – Alwin, 23.11.2026. Ein Ablauf mit Vorlauf (`isBeforeEvent`), einer Überschrift und
 * Infos in zwei Dienstgruppen. Zeilen und Liste kommen aus den echten Erzeugern (`ablaufZeileAus`, `liveListe`).
 */
describe('LiveAnsicht – Anzeige (L4-1)', () => {
  const VOR: CtAgendaItem[] = [
    {
      id: 901,
      title: 'Soundcheck',
      type: 'normal',
      duration: 1200,
      isBeforeEvent: true,
      startTimes: { '216': '2027-03-07T08:40:00Z' },
    },
    {
      id: 902,
      title: 'Countdown',
      type: 'normal',
      duration: 300,
      isBeforeEvent: true,
      startTimes: { '216': '2027-03-07T08:55:00Z' },
    },
    {
      id: 903,
      title: 'Lobpreis',
      type: 'header',
      duration: 0,
      isBeforeEvent: false,
      startTimes: { '216': '2027-03-07T09:00:00Z' },
    },
    {
      id: 904,
      title: 'Begrüßung',
      type: 'normal',
      duration: 300,
      isBeforeEvent: false,
      startTimes: { '216': '2027-03-07T09:00:00Z' },
      serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 2 an' }],
    },
    {
      id: 905,
      title: 'Lied',
      type: 'normal',
      duration: 240,
      isBeforeEvent: false,
      startTimes: { '216': '2027-03-07T09:05:00Z' },
      serviceGroupNotes: [{ serviceGroupId: 4, note: 'Band leise' }],
    },
  ];
  const TECHNIK = { id: 3, name: 'Technik' };
  const MUSIK = { id: 4, name: 'Musik' };

  function zeigeAblauf(
    items: CtAgendaItem[],
    o: {
      stelle: number | null;
      infoGruppen?: { id: number; name: string }[];
      steuern?: boolean;
      seit?: string;
    },
  ) {
    const lesen = vi.fn(() =>
      Promise.resolve({
        ok: true,
        stand: stand(o.stelle, o.stelle === null ? null : (o.seit ?? '2027-03-07T09:07:00Z')),
      } as const),
    );
    const schreiben = vi.fn(() => new Promise<never>(() => {}));
    render(
      <LiveAnsicht
        titel="Gottesdienst"
        tag="2027-03-07"
        beginn="10:00"
        terminId={T}
        agendaId={126}
        items={items}
        zeilen={items.map((i) => ablaufZeileAus(i, T, 'Europe/Berlin'))}
        infoGruppen={o.infoGruppen ?? [TECHNIK, MUSIK]}
        zeitzone="Europe/Berlin"
        onSchliessen={() => {}}
        steuern={o.steuern ?? false}
        lesen={lesen}
        schreiben={schreiben}
        ablaufLesen={() => Promise.resolve({ id: 126, items })}
      />,
    );
    return { schreiben };
  }

  const liste = () => screen.getByRole('list', { name: 'Ablauf' });

  it('Überschriften als Bänder, „Beginn 10:00“ an der Grenze – in der Reihenfolge des Ablaufs', async () => {
    zeigeAblauf(VOR, { stelle: 3 });
    await fertig();
    expect(
      Array.from(liste().children).map((li) =>
        li.textContent?.replace(/Technik: .*|Musik: .*/, ''),
      ),
    ).toEqual([
      '09:40Soundcheck',
      '09:55Countdown',
      'Beginn10:00',
      'Lobpreis',
      '10:00Begrüßung',
      '10:05Lied',
    ]);
    // Die Überschrift ist eine Überschrift (für Vorlesegeräte), kein Listenpunkt.
    expect(within(liste()).getByRole('heading', { name: 'Lobpreis' })).toBeTruthy();
    expect(within(liste()).getAllByRole('listitem')).toHaveLength(4);
  });

  it('ohne Vorlauf keine Beginn-Linie', async () => {
    zeigeAblauf(ITEMS, { stelle: 3 });
    await fertig();
    expect(within(liste()).queryByText('Beginn')).toBeNull();
  });

  it('Anzeige ändert die Zählung nicht: Stelle 3 ist der dritte Punkt ohne Überschriften wie in ChurchTools (T6)', async () => {
    zeigeAblauf(VOR, { stelle: 3 });
    await fertig();
    expect(within(jetztBereich()).getByRole('heading', { level: 2 }).textContent).toBe('Begrüßung');
    const aktuell = within(liste())
      .getAllByRole('listitem')
      .filter((p) => p.getAttribute('aria-current') === 'step');
    expect(aktuell).toHaveLength(1);
    expect(aktuell[0].textContent).toMatch(/^10:00Begrüßung/);
    // Die Punkte davor sind erledigt: Soundcheck und Countdown (Stelle 1 und 2).
    expect(
      within(liste())
        .getAllByRole('listitem')
        .filter((p) => /erledigt/.test(p.className))
        .map((p) => p.textContent),
    ).toEqual(['09:40Soundcheck', '09:55Countdown']);
  });

  it('Leiste unten: Zurück mit dem Titel des vorigen, Weiter mit dem Titel des nächsten Punkts; Weiter ist der gefüllte Knopf', async () => {
    zeigeAblauf(VOR, { stelle: 3, steuern: true });
    await fertig();
    const leiste = screen.getByRole('group', { name: 'Live-Agenda steuern' });
    const zurueck = within(leiste).getByRole('button', { name: 'Zum vorigen Punkt' });
    const weiter = within(leiste).getByRole('button', { name: 'Zum nächsten Punkt' });
    expect(zurueck.textContent).toBe('ZURÜCKCountdown');
    expect(weiter.textContent).toBe('WEITERLied');
    expect(weiter.className).toMatch(/haupt/);
    expect(zurueck.className).not.toMatch(/haupt/);
    // Nicht mehr in der rechten Spalte (dort bleiben Kreis und Zeitkonto).
    expect(screen.getByLabelText('Restzeit').parentElement?.contains(leiste)).toBe(false);
    // Die Leiste steht hinter dem Rumpf, ganz unten.
    expect(leiste.previousElementSibling?.contains(liste())).toBe(true);
    expect(leiste.nextElementSibling).toBeNull();
  });

  it('Leiste: am letzten Punkt heißt „Weiter“ Ende; vor dem ersten steht Zurück auf „Noch nicht gestartet“; vor dem Start nur „Starten“', async () => {
    zeigeAblauf(VOR, { stelle: 5, steuern: true });
    await fertig();
    expect(knopfText('Zum nächsten Punkt')).toBe('WEITER');
    cleanup();
    zeigeAblauf(VOR, { stelle: 4, steuern: true });
    await fertig();
    expect(knopfText('Zum nächsten Punkt')).toBe('WEITEREnde');
    cleanup();
    zeigeAblauf(VOR, { stelle: 1, steuern: true });
    await fertig();
    expect(knopfText('Zum vorigen Punkt')).toBe('ZURÜCKNoch nicht gestartet');
    cleanup();
    vi.setSystemTime(ms('2027-03-07T08:30:00Z'));
    zeigeAblauf(VOR, { stelle: null, steuern: true });
    await fertig();
    const leiste = screen.getByRole('group', { name: 'Live-Agenda steuern' });
    expect(
      within(leiste)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Live-Agenda starten']);
  });

  it('Leiste: ohne Steuer-Recht gibt es sie nicht', async () => {
    zeigeAblauf(VOR, { stelle: 3, steuern: false });
    await fertig();
    expect(screen.queryByRole('group', { name: 'Live-Agenda steuern' })).toBeNull();
  });

  it('Weiter schreibt die Stelle nach der Zählung von ChurchTools (ohne Überschriften)', async () => {
    const { schreiben } = zeigeAblauf(VOR, { stelle: 3, steuern: true });
    await fertig();
    fireEvent.click(screen.getByRole('button', { name: 'Zum nächsten Punkt' }));
    await fertig();
    expect(schreiben).toHaveBeenCalledWith(T, 126, { stelle: 4, zusatzSek: 0 });
  });

  it('Infos: groß unter „Jetzt“, klein in der Liste auch beim laufenden Punkt und bei kommenden – bei erledigten nicht', async () => {
    zeigeAblauf(VOR, { stelle: 3 });
    await fertig();
    expect(within(jetztBereich()).getByText(/Mikro 2 an/).textContent).toBe('Technik: Mikro 2 an');
    const zeilen = within(liste()).getAllByRole('listitem');
    const begruessung = zeilen.find((z) => /Begrüßung/.test(z.textContent ?? ''))!;
    const lied = zeilen.find((z) => /^10:05Lied/.test(z.textContent ?? ''))!;
    expect(begruessung.textContent).toBe('10:00BegrüßungTechnik: Mikro 2 an');
    expect(lied.textContent).toBe('10:05LiedMusik: Band leise');
    cleanup();
    // Eine Stelle weiter: Die Begrüßung ist erledigt, ihre Info steht nirgends mehr.
    zeigeAblauf(VOR, { stelle: 4 });
    await fertig();
    expect(screen.queryByText(/Mikro 2 an/)).toBeNull();
    expect(within(jetztBereich()).getByText(/Band leise/).textContent).toBe('Musik: Band leise');
  });

  it('Infos: nur die übergebenen Dienstgruppen – eine andere Gruppe erscheint weder groß noch klein', async () => {
    zeigeAblauf(VOR, { stelle: 3, infoGruppen: [MUSIK] });
    await fertig();
    expect(screen.queryByText(/Mikro 2 an/)).toBeNull();
    expect(screen.getByText(/Band leise/).textContent).toBe('Musik: Band leise');
  });
});

function knopfText(name: string) {
  return screen.getByRole('button', { name }).textContent;
}

/**
 * **Betriebsart und Zeitkonto** (L4-2, Alwin 23.11.2026): Ein Ablauf mit Vorlauf – Soundcheck, Countdown, **Beginn 10:00** –,
 * dann Begrüßung und Predigt. Die Zeiten stehen in UTC (09:00 UTC = 10:00 Uhr in Berlin). Gerechnet wird in `liveLage`
 * (`shared/ct/liveAgenda.test.ts`); hier geht es darum, was die Ansicht daraus zeigt und welche Knöpfe sie anbietet.
 */
describe('LiveAnsicht – Betriebsart und Zeitkonto (L4-2)', () => {
  const VOR: CtAgendaItem[] = [
    {
      id: 1,
      title: 'Soundcheck',
      type: 'text',
      duration: 1500,
      isBeforeEvent: true,
      startTimes: { '216': '2027-03-07T08:30:00Z' },
    },
    {
      id: 2,
      title: 'Countdown',
      type: 'text',
      duration: 300,
      isBeforeEvent: true,
      startTimes: { '216': '2027-03-07T08:55:00Z' },
    },
    {
      id: 3,
      title: 'Begrüßung',
      type: 'text',
      duration: 300,
      isBeforeEvent: false,
      startTimes: { '216': '2027-03-07T09:00:00Z' },
    },
    {
      id: 4,
      title: 'Predigt',
      type: 'text',
      duration: 1800,
      isBeforeEvent: false,
      startTimes: { '216': '2027-03-07T09:05:00Z' },
    },
  ];
  const zeigeVor = (
    start: { stelle: number | null; seit: string | null; zusatz?: number },
    art: Betriebsart | (() => Promise<EinstellungenStand>),
    steuern = true,
  ) =>
    zeigeSteuern(start, {
      items: VOR,
      steuern,
      betriebsartLesen: typeof art === 'string' ? betriebsartMit(art) : art,
    });
  const knopf = (name: string) => screen.getByRole('button', { name });
  const jetztUm = (iso: string) => vi.setSystemTime(ms(iso));
  const konto = () => screen.getByLabelText('Zeitkonto');

  /** Wie `zeigeSteuern` weiter oben – hier nur die Hilfe, die der Block braucht. */
  function zeigeSteuern(
    start: { stelle: number | null; seit: string | null; zusatz?: number },
    o: {
      steuern?: boolean;
      items: CtAgendaItem[];
      betriebsartLesen: () => Promise<EinstellungenStand>;
    },
  ) {
    let aktuell = { ...start };
    const lesen = vi.fn(() =>
      Promise.resolve({ ok: true, stand: stand(aktuell.stelle, aktuell.seit, aktuell) } as const),
    );
    const schreiben = vi.fn(
      (_t: number, _a: number, ziel: { stelle: number; zusatzSek: number }) => {
        const seit =
          ziel.stelle === aktuell.stelle ? aktuell.seit : new Date(Date.now()).toISOString();
        aktuell = { stelle: ziel.stelle, seit, zusatz: ziel.zusatzSek };
        return Promise.resolve({
          ok: true,
          stand: stand(aktuell.stelle, aktuell.seit, aktuell),
        } as const);
      },
    );
    render(
      <LiveAnsicht
        titel="Gottesdienst"
        tag="2027-03-07"
        beginn="10:00"
        terminId={T}
        agendaId={126}
        items={o.items}
        zeilen={o.items.map((i) => ablaufZeileAus(i, T, 'Europe/Berlin'))}
        infoGruppen={[]}
        zeitzone="Europe/Berlin"
        onSchliessen={() => {}}
        steuern={o.steuern}
        lesen={lesen}
        schreiben={schreiben}
        ablaufLesen={() => Promise.resolve({ id: 126, items: o.items })}
        betriebsartLesen={o.betriebsartLesen}
      />,
    );
    return { lesen, schreiben };
  }

  describe('bis Beginn nach der Uhr, ab Beginn klicken (Standard)', () => {
    it('vor Beginn: läuft nach der Uhr, Konto „±0:00 im Plan“, ‹ Zurück / Weiter › vom gezeigten Punkt', async () => {
      jetztUm('2027-03-07T08:57:00Z');
      zeigeVor({ stelle: null, seit: null }, 'bis-beginn');
      await fertig();
      expect(within(jetztBereich()).getByText('Jetzt · nach Plan')).toBeTruthy();
      expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Countdown');
      expect(
        screen.getByText(
          'Bis Beginn folgt „Jetzt“ der Uhr. Ab 10:00 geht es weiter, wenn jemand „Weiter“ drückt.',
        ),
      ).toBeTruthy();
      expect(restzeit()).toBe('3:00noch, von 5 Min');
      expect(konto().textContent).toBe('Zeitkonto±0:00im Plan');
      // Die Leiste: Zurück zum Soundcheck, Weiter zur Begrüßung – kein „Starten“, keine ±1 Min (läuft noch nichts).
      expect(
        within(screen.getByRole('group', { name: 'Live-Agenda steuern' }))
          .getAllByRole('button')
          .map((b) => b.getAttribute('aria-label')),
      ).toEqual(['Zum vorigen Punkt', 'Zum nächsten Punkt']);
      expect(knopf('Zum nächsten Punkt').textContent).toContain('Begrüßung');
      expect(knopf('Zum vorigen Punkt').textContent).toContain('Soundcheck');
    });

    it('ab Beginn ohne Klick: bleibt am Countdown stehen, „Wartet auf „Weiter““, rot ins Minus, Konto läuft mit', async () => {
      jetztUm('2027-03-07T09:02:14Z');
      zeigeVor({ stelle: null, seit: null }, 'bis-beginn');
      await fertig();
      expect(within(jetztBereich()).getByText('Wartet auf „Weiter“')).toBeTruthy();
      expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Countdown');
      expect(
        screen.getByText('Beginn war um 10:00. Drück „Weiter“, wenn es losgeht.'),
      ).toBeTruthy();
      expect(restzeit()).toBe('−2:14über der Zeit');
      expect(screen.getByLabelText('Restzeit').className).toMatch(/ueber/);
      expect(konto().textContent).toBe('Zeitkonto−2:14Rückstand');
      expect(konto().className).toMatch(/minus/);
      // Es läuft sekündlich weiter ins Minus.
      await spulen(1000);
      expect(restzeit()).toBe('−2:15über der Zeit');
      expect(konto().textContent).toBe('Zeitkonto−2:15Rückstand');
    });

    it('„Weiter“ startet den Punkt NACH dem gezeigten (die Begrüßung), nicht den ersten', async () => {
      jetztUm('2027-03-07T09:02:14Z');
      const { schreiben } = zeigeVor({ stelle: null, seit: null }, 'bis-beginn');
      await fertig();
      expect(knopf('Zum nächsten Punkt').textContent).toContain('Begrüßung');
      fireEvent.click(knopf('Zum nächsten Punkt'));
      await fertig();
      expect(schreiben).toHaveBeenCalledWith(T, 126, { stelle: 3, zusatzSek: 0 });
      // Danach läuft die Live-Agenda: die Begrüßung ist dran, volle Dauer ab dem Klick, Konto: 2:14 Rückstand.
      expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Begrüßung');
      expect(restzeit()).toBe('5:00noch, von 5 Min');
      expect(konto().textContent).toBe('Zeitkonto−2:14Rückstand');
    });

    it('ohne Steuer-Recht: derselbe Wartezustand, aber ohne Leiste und mit anderem Satz', async () => {
      jetztUm('2027-03-07T09:02:14Z');
      zeigeVor({ stelle: null, seit: null }, 'bis-beginn', false);
      await fertig();
      expect(screen.queryByRole('group', { name: 'Live-Agenda steuern' })).toBeNull();
      expect(
        screen.getByText('Beginn war um 10:00. Es geht weiter, sobald jemand „Weiter“ drückt.'),
      ).toBeTruthy();
      expect(restzeit()).toBe('−2:14über der Zeit');
    });
  });

  describe('immer nach der Uhr', () => {
    it('läuft nach Beginn weiter durch den Ablauf, „Starten“ allein, kein Zeitkonto', async () => {
      jetztUm('2027-03-07T09:02:14Z');
      zeigeVor({ stelle: null, seit: null }, 'immer-uhr');
      await fertig();
      expect(within(jetztBereich()).getByText('Jetzt · nach Plan')).toBeTruthy();
      expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Begrüßung');
      expect(screen.queryByLabelText('Zeitkonto')).toBeNull();
      expect(
        within(screen.getByRole('group', { name: 'Live-Agenda steuern' }))
          .getAllByRole('button')
          .map((b) => b.getAttribute('aria-label')),
      ).toEqual(['Live-Agenda starten']);
    });
  });

  describe('von Anfang an klicken', () => {
    it('nie automatisch: „Wartet auf „Starten““, nichts läuft, „Starten“ beginnt vorn', async () => {
      jetztUm('2027-03-07T09:02:14Z');
      const { schreiben } = zeigeVor({ stelle: null, seit: null }, 'klicken');
      await fertig();
      expect(within(jetztBereich()).getByText('Wartet auf „Starten“')).toBeTruthy();
      expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Noch nicht begonnen');
      expect(
        screen.getByText('Nichts läuft von selbst – drück „Starten“, wenn es losgeht.'),
      ).toBeTruthy();
      expect(screen.queryByLabelText('Restzeit')).toBeNull();
      expect(screen.queryByLabelText('Zeitkonto')).toBeNull();
      fireEvent.click(knopf('Live-Agenda starten'));
      await fertig();
      expect(schreiben).toHaveBeenCalledWith(T, 126, { stelle: 1, zusatzSek: 0 });
    });
  });

  describe('läuft ChurchTools schon: Betriebsart ohne Wirkung, Zeitkonto laufend', () => {
    it('ein überzogener Punkt verbraucht das Konto sofort – jede Sekunde ein Stück', async () => {
      // Begrüßung (Plan 10:00–10:05) pünktlich begonnen; Ende der Zeit um 09:05:00 UTC.
      jetztUm('2027-03-07T09:04:59Z');
      zeigeVor({ stelle: 3, seit: '2027-03-07T09:00:00Z' }, 'klicken');
      await fertig();
      expect(konto().textContent).toBe('Zeitkonto±0:00im Plan');
      await spulen(1000);
      expect(konto().textContent).toBe('Zeitkonto±0:00im Plan');
      await spulen(1000);
      expect(konto().textContent).toBe('Zeitkonto−0:01Rückstand');
      await spulen(9000);
      expect(konto().textContent).toBe('Zeitkonto−0:10Rückstand');
    });

    it('zu früh weitergeklickt: „+0:20“ grün = gespart', async () => {
      jetztUm('2027-03-07T09:00:30Z');
      zeigeVor({ stelle: 3, seit: '2027-03-07T08:59:40Z' }, 'bis-beginn');
      await fertig();
      expect(konto().textContent).toBe('Zeitkonto+0:20gespart');
      expect(konto().className).toMatch(/plus/);
    });

    it('„−1 / +1 Min“ ändert den Kreis, nicht das Zeitkonto (A13)', async () => {
      jetztUm('2027-03-07T09:06:10Z');
      zeigeVor({ stelle: 3, seit: '2027-03-07T09:00:00Z', zusatz: 60 }, 'bis-beginn');
      await fertig();
      // Begrüßung 5 Min + 1 Min Zusatz: Kreis „noch −0:10“ wäre bei 6:10 vergangen → −0:10; Konto gegen den Plan: −1:10.
      expect(restzeit()).toBe('−0:10über der Zeit');
      expect(konto().textContent).toBe('Zeitkonto−1:10Rückstand');
    });
  });

  describe('Betriebsart lesen', () => {
    it('Lesefehler beim Öffnen: Standard (bis Beginn) – und beim nächsten Versuch die gespeicherte Art', async () => {
      jetztUm('2027-03-07T09:02:14Z');
      const lesen = vi
        .fn<() => Promise<EinstellungenStand>>()
        .mockImplementationOnce(betriebsartMit('immer-uhr', 'voruebergehend'))
        .mockImplementation(betriebsartMit('immer-uhr'));
      zeigeVor({ stelle: null, seit: null }, lesen);
      await fertig();
      // Standard gilt: wartet am Countdown.
      expect(within(jetztBereich()).getByText('Wartet auf „Weiter“')).toBeTruthy();
      await spulen(BETRIEBSART_NOCHMAL_MS);
      expect(lesen).toHaveBeenCalledTimes(2);
      expect(within(jetztBereich()).getByText('Jetzt · nach Plan')).toBeTruthy();
      expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Begrüßung');
    });

    it('ein späterer Lesefehler ändert die gelesene Betriebsart NICHT (vorübergehend ist nicht ungültig)', async () => {
      jetztUm('2027-03-07T09:02:14Z');
      const lesen = vi
        .fn<() => Promise<EinstellungenStand>>()
        .mockImplementationOnce(betriebsartMit('immer-uhr'))
        .mockImplementation(betriebsartMit('bis-beginn', 'voruebergehend'));
      zeigeVor({ stelle: null, seit: null }, lesen);
      await fertig();
      expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Begrüßung');
      await spulen(BETRIEBSART_TAKT_MS);
      expect(lesen).toHaveBeenCalledTimes(2);
      // Der Fehlerstand trägt nur den Standard – er darf die gelesene Art nicht überschreiben.
      expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Begrüßung');
      expect(within(jetztBereich()).getByText('Jetzt · nach Plan')).toBeTruthy();
    });

    it('ändert ein Planer die Betriebsart, folgt die offene Ansicht beim nächsten Lesen', async () => {
      jetztUm('2027-03-07T09:02:14Z');
      const lesen = vi
        .fn<() => Promise<EinstellungenStand>>()
        .mockImplementationOnce(betriebsartMit('immer-uhr'))
        .mockImplementation(betriebsartMit('klicken'));
      zeigeVor({ stelle: null, seit: null }, lesen);
      await fertig();
      expect(within(jetztBereich()).getByText('Jetzt · nach Plan')).toBeTruthy();
      await spulen(BETRIEBSART_TAKT_MS);
      expect(within(jetztBereich()).getByText('Wartet auf „Starten“')).toBeTruthy();
    });
  });
});
