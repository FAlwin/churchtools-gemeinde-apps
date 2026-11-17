// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { diensteAus } from '@shared/ct/dienste';
import { planAus } from '@shared/dienstplan/plan';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { EntwuerfeDaten } from './ladeEntwuerfe';
import { daten, entwurf, nachgebaut } from './entwurfAnschluss.testutil';
import { ladeWerKann } from './ladeWerKann';
import { LANG_MS } from './useLangDruck';
import { Planen } from './Planen';
import type { PersonenLader } from './ladePersonen';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn(), vergissWerKann: vi.fn() }));

/**
 * **Fokus-Modus** (Wunsch 11, Alwin 16.11.2026): eine Person im Plan anleuchten. Echter Plan (`planAus`), echte
 * Ansichten – nur ChurchTools ist nachgebaut. Die Rechnung selbst prüft `shared/dienstplan/fokus.test.ts`.
 *
 * Technik: Ton (6), Bild (7); Musik: Gesang (9). Daniel (12): Ton 06.12. (zugesagt), Gesang 06.12. (angefragt),
 * Bild 13.12. (zugesagt). Anna (5): Bild 06.12., Gesang 09.12. – dazu ein Gast und ein verborgener Name am 09.12.; am
 * 13.12. ist Ton frei.
 */
const DIENSTE = diensteAus([
  { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
  { id: 7, name: 'Bild', serviceGroupId: 3, groupIds: [7], sortKey: 2 },
  { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9], sortKey: 3 },
]);
const GRUPPEN = [
  { id: 3, name: 'Technik', fuerAlle: false },
  { id: 4, name: 'Musik', fuerAlle: false },
];
const p = (
  serviceId: number,
  personId: number | null,
  name: string | null,
  zu = true,
  index = 1,
) => ({
  serviceId,
  personId,
  name,
  isAccepted: zu,
  index,
});
const ROH = [
  {
    id: 20,
    name: 'Gottesdienst',
    startDate: '2026-12-06T09:00:00Z',
    endDate: '2026-12-06T10:30:00Z',
    eventServices: [
      p(6, 12, 'Daniel Test', true, 1),
      p(7, 5, 'Anna Test'),
      p(9, 12, 'Daniel Test', false),
    ],
  },
  {
    id: 21,
    name: 'Gebetsabend',
    startDate: '2026-12-09T17:00:00Z',
    endDate: '2026-12-09T18:30:00Z',
    eventServices: [
      p(9, 5, 'Anna Test'),
      p(9, null, 'Gastsänger', true, 2),
      p(6, -2, 'Echter Name'),
    ],
  },
  {
    id: 22,
    name: 'Gottesdienst',
    startDate: '2026-12-13T09:00:00Z',
    endDate: '2026-12-13T10:30:00Z',
    eventServices: [p(7, 12, 'Daniel Test'), p(6, null, null, true, 1)],
  },
] as RohTermin[];
const PLAN = planAus(ROH, {
  ichId: 1,
  dienste: DIENSTE,
  dienstgruppen: GRUPPEN,
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
});
const ANSICHT = 'dienstplaner.planen.ansicht';

function zeige(extra: Partial<ComponentProps<typeof Planen>> = {}, handy = false) {
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={handy}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-12-01"
      entwuerfe={nachgebaut()}
      {...extra}
    />,
  );
}

/** Alles, was die Fokus-Umrandung trägt (Klasse `fokus` aus Planen.module.scss bzw. PersonenRaster.module.scss) – nicht das Symbol. */
const umrandet = (wurzel: ParentNode = document) =>
  [...wurzel.querySelectorAll('*')].filter((e) =>
    /(^|\s)_fokus_/.test(e.getAttribute('class') ?? ''),
  );
const namen = (liste: Element[]) =>
  liste.map((e) => /(Daniel|Anna|Ben|Gast|Nicht)[^✓?]*/.exec(e.textContent ?? '')?.[0] ?? '?');
const leiste = () => screen.queryByRole('status', { name: 'Fokus' });
const symbol = (name: string, nr = 0) =>
  screen.getAllByRole('button', { name: `Im Plan hervorheben: ${name}` })[nr];

beforeEach(() => {
  // Wie im Personen-Test: jsdom kennt `PointerEvent` nicht – ohne ginge `pointerType` beim Auslösen verloren.
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerType: string;
      constructor(typ: string, init: MouseEventInit & { pointerType?: string } = {}) {
        super(typ, init);
        this.pointerType = init.pointerType ?? '';
      }
    },
  );
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(ladeWerKann).mockReset();
});

describe('Fokus – Matrix', () => {
  it('Symbol am Namen: alle Plätze der Person umrandet, keine anderen – und das Fenster am Platz bleibt zu', () => {
    zeige();
    expect(umrandet()).toHaveLength(0);
    expect(leiste()).toBeNull();
    fireEvent.click(symbol('Daniel Test'));
    // Daniel: Ton, Gesang, Bild – Anna, der Gast und der verborgene Name nicht.
    expect(namen(umrandet())).toEqual(['Daniel Test', 'Daniel Test', 'Daniel Test']);
    expect(umrandet().every((e) => e.closest('table'))).toBe(true);
    // Das Symbol ist ein eigener Knopf: kein Fehltipp auf den Platz → kein Fenster „zurückziehen oder ersetzen“.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
  });

  it('der Zustand im Platz bleibt: zugesagt (Haken) und angefragt (?) sind weiter zu unterscheiden', () => {
    zeige();
    fireEvent.click(symbol('Daniel Test'));
    const stand = umrandet().map((e) =>
      e.querySelector('[aria-label]')?.getAttribute('aria-label'),
    );
    // Reihenfolge der Matrix: Technik (Ton 06.12., Bild 13.12.), dann Musik (Gesang 06.12.).
    expect(stand).toEqual(['zugesagt', 'zugesagt', 'angefragt']);
  });

  it('die Leiste zählt, was umrandet ist (3 Einsätze in 2 Terminen, 1 angefragt)', () => {
    zeige();
    fireEvent.click(symbol('Daniel Test'));
    expect(leiste()?.textContent).toBe(
      'DTFokus: Daniel Test · 3 Einsätze in 2 Terminen · 1 angefragt Fokus aus',
    );
    expect(umrandet()).toHaveLength(3);
  });

  it('„Fokus aus“ nimmt Umrandung und Leiste weg', () => {
    zeige();
    fireEvent.click(symbol('Daniel Test'));
    fireEvent.click(screen.getByRole('button', { name: 'Fokus aus' }));
    expect(umrandet()).toHaveLength(0);
    expect(leiste()).toBeNull();
  });

  it('immer nur eine Person: eine zweite Wahl löst die erste ab', () => {
    zeige();
    fireEvent.click(symbol('Daniel Test'));
    fireEvent.click(symbol('Anna Test'));
    expect(namen(umrandet())).toEqual(['Anna Test', 'Anna Test']);
    expect(leiste()?.textContent).toContain('Fokus: Anna Test · 2 Einsätze in 2 Terminen');
  });

  it('Gast und verborgener Name haben kein Fokus-Symbol – nie fokussierbar', () => {
    zeige();
    expect(screen.getAllByRole('button', { name: /^Im Plan hervorheben: / })).toHaveLength(5); // 3× Daniel/Anna … s. u.
    const alle = screen
      .getAllByRole('button', { name: /^Im Plan hervorheben: / })
      .map((b) => b.getAttribute('aria-label'));
    expect(alle.some((n) => /Gastsänger|Echter Name/.test(n ?? ''))).toBe(false);
  });

  it('ein ausgeblendeter Dienst zählt mit – die Leiste sagt „1 ausgeblendet“', () => {
    localStorage.setItem(ANSICHT, JSON.stringify({ ausgeblendeteDienste: [7] }));
    zeige();
    fireEvent.click(symbol('Daniel Test'));
    // Bild (7) fehlt in der Matrix – Daniels Bild am 13.12. ist trotzdem ein Einsatz.
    expect(umrandet()).toHaveLength(2);
    expect(leiste()?.textContent).toContain(
      '3 Einsätze in 2 Terminen · 1 angefragt · 1 ausgeblendet',
    );
  });

  it('Entwurf auf die Person: umrandet, gezählt (Gegenstück zu „zugesagt“)', async () => {
    const e: Entwurf = entwurf({
      ort: { eventId: 22, serviceId: 6, index: 1 },
      ziel: { art: 'person', personId: 12, name: 'Daniel Test' },
    });
    zeige({ entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([e])) }) });
    fireEvent.click(symbol('Daniel Test'));
    await waitFor(() => expect(umrandet()).toHaveLength(4));
    expect(leiste()?.textContent).toContain('4 Einsätze in 2 Terminen · 1 angefragt · 1 Entwurf');
  });
});

describe('Fokus – Fenster am belegten Platz', () => {
  it('„Im Plan hervorheben“ im Fenster: schließt es und stellt die Person in den Fokus', () => {
    zeige();
    fireEvent.click(
      screen.getAllByRole('button', { name: /^Anna Test – zugesagt: zurückziehen/ })[0],
    );
    const knopf = screen.getByRole('button', { name: 'Im Plan hervorheben' });
    fireEvent.click(knopf);
    expect(screen.queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
    expect(namen(umrandet())).toEqual(['Anna Test', 'Anna Test']);
    expect(leiste()?.textContent).toContain('Fokus: Anna Test');
  });

  it('bei einem Gast gibt es den Knopf nicht', async () => {
    zeige();
    // Der Gast steht als Platz da; antippen öffnet das Fenster – ohne „Im Plan hervorheben“.
    fireEvent.click(screen.getByRole('button', { name: /^Gastsänger \(Gast\)/ }));
    expect(await screen.findByText(/als Gast eingetragen/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Im Plan hervorheben' })).toBeNull();
  });
});

describe('Fokus – langes Drücken (Handy)', () => {
  const platzKnopf = () =>
    screen.getAllByRole('button', { name: /^Anna Test – zugesagt: zurückziehen/ })[0];

  it('500 ms mit dem Finger: Fokus; das Antippen danach öffnet das Fenster nicht', () => {
    vi.useFakeTimers();
    zeige({}, true);
    const k = platzKnopf();
    fireEvent.pointerDown(k, { pointerType: 'touch', clientX: 10, clientY: 10 });
    act(() => void vi.advanceTimersByTime(LANG_MS - 1));
    expect(leiste()).toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(leiste()?.textContent).toContain('Fokus: Anna Test');
    fireEvent.pointerUp(k, { pointerType: 'touch' });
    fireEvent.click(k);
    expect(screen.queryByRole('button', { name: 'Im Plan hervorheben' })).toBeNull();
  });

  it('kurzes Tippen: kein Fokus, das Fenster geht auf', () => {
    vi.useFakeTimers();
    zeige({}, true);
    const k = platzKnopf();
    fireEvent.pointerDown(k, { pointerType: 'touch', clientX: 10, clientY: 10 });
    act(() => void vi.advanceTimersByTime(200));
    fireEvent.pointerUp(k, { pointerType: 'touch' });
    act(() => void vi.advanceTimersByTime(2000));
    expect(leiste()).toBeNull();
    fireEvent.click(k);
    // Das Fenster am belegten Platz ist auf (es trägt den Knopf „Im Plan hervorheben“).
    expect(screen.getByRole('button', { name: 'Im Plan hervorheben' })).toBeTruthy();
  });

  it('Wischen (Finger wandert) ist kein langes Drücken; die Maus auch nicht', () => {
    vi.useFakeTimers();
    zeige({}, true);
    const k = platzKnopf();
    fireEvent.pointerDown(k, { pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.pointerMove(k, { pointerType: 'touch', clientX: 10, clientY: 40 });
    act(() => void vi.advanceTimersByTime(2000));
    expect(leiste()).toBeNull();
    fireEvent.pointerDown(k, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    act(() => void vi.advanceTimersByTime(2000));
    expect(leiste()).toBeNull();
  });

  it('ein langer Druck auf den Gast tut nichts', () => {
    vi.useFakeTimers();
    zeige();
    const k = screen.getByRole('button', { name: /^Gastsänger \(Gast\)/ });
    fireEvent.pointerDown(k, { pointerType: 'touch', clientX: 10, clientY: 10 });
    act(() => void vi.advanceTimersByTime(2000));
    expect(leiste()).toBeNull();
  });

  it('am Handy-Zettel umrandet der Fokus den Platz im gezeigten Termin', () => {
    zeige({}, true);
    fireEvent.click(symbol('Daniel Test'));
    // Der Zettel zeigt einen Termin (den ersten): Daniel steht dort in Ton und Gesang.
    expect(namen(umrandet())).toEqual(['Daniel Test', 'Daniel Test']);
    expect(leiste()?.textContent).toContain('3 Einsätze');
  });

  it('Kurzform am Handy: „Fokus: Name · N Einsätze“, Einzelheiten klein darunter, „Fokus aus“ nur als ✕ mit aria-label', () => {
    zeige({}, true);
    fireEvent.click(symbol('Daniel Test'));
    const l = leiste()!;
    const zeilen = l.querySelectorAll('span[class*="_text_"]');
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].firstChild?.textContent).toBe('Fokus: ');
    expect(zeilen[0].textContent).toBe(
      'Fokus: Daniel Test · 3 Einsätzein 2 Terminen · 1 angefragt',
    );
    expect(l.querySelector('small')?.textContent).toBe('in 2 Terminen · 1 angefragt');
    const aus = screen.getByRole('button', { name: 'Fokus aus' });
    expect(aus.textContent).toBe('');
    expect(aus.querySelector('svg')).not.toBeNull();
  });

  it('am Rechner bleibt die volle Fassung mit beschriftetem Knopf', () => {
    zeige();
    fireEvent.click(symbol('Daniel Test'));
    expect(leiste()?.querySelector('small')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fokus aus' }).textContent).toBe(' Fokus aus');
  });
});

describe('Fokus – bleibt über die Ansichten', () => {
  const ansicht = (name: string) =>
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Ansicht' })).getByRole('button', { name }),
    );
  const lader: PersonenLader = () => Promise.resolve(new Map());

  it('Matrix → Personen → Wer wie oft? → Matrix: derselbe Fokus; „Personen“ umrandet alle Zeilen der Person', async () => {
    zeige({
      ladePersonen: lader,
      // „Wer wie oft?“ lädt die Vergangenheit nach – hier derselbe Plan.
      ladeZeitraum: () => Promise.resolve({ zeilen: [] as [], plan: PLAN }),
    });
    fireEvent.click(symbol('Daniel Test'));
    ansicht('Personen');
    await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    const zeilen = [...document.querySelectorAll('tr[data-person]')];
    const fokussiert = zeilen.filter((r) => umrandet().includes(r));
    // Daniel hat eine Zeile je Dienst (Ton, Bild, Gesang) – und nur seine.
    expect(fokussiert.map((r) => r.getAttribute('data-person'))).toEqual(['12', '12', '12']);
    expect(fokussiert).toHaveLength(
      zeilen.filter((r) => r.getAttribute('data-person') === '12').length,
    );
    expect(leiste()?.textContent).toContain('Fokus: Daniel Test');
    ansicht('Wer wie oft?');
    expect(leiste()?.textContent).toContain('Fokus: Daniel Test');
    ansicht('Matrix');
    expect(namen(umrandet())).toEqual(['Daniel Test', 'Daniel Test', 'Daniel Test']);
  });

  it('Personen: Antippen des Namens nimmt die Person in den Fokus, noch einmal antippen nimmt ihn zurück', async () => {
    zeige({ ladePersonen: lader });
    ansicht('Personen');
    await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    // Die Namen-Knöpfe (`aria-pressed`) – die Zellen daneben sind Eintragen-Knöpfe (P2a) und zählen hier nicht.
    const knoepfe = screen.getAllByRole('button', { name: /Anna Test/, pressed: false });
    fireEvent.click(knoepfe[0]);
    expect(leiste()?.textContent).toContain('Fokus: Anna Test');
    expect(
      umrandet()
        .filter((e) => e.tagName === 'TR')
        .map((r) => r.getAttribute('data-person')),
    ).toEqual(knoepfe.map(() => '5'));
    fireEvent.click(screen.getAllByRole('button', { name: /Anna Test/, pressed: true })[1]);
    expect(leiste()).toBeNull();
    expect(umrandet()).toHaveLength(0);
  });

  it('Verlassen von Planen beendet den Fokus – und er wird nicht gemerkt', () => {
    const { unmount } = zeige();
    fireEvent.click(symbol('Daniel Test'));
    expect(leiste()).not.toBeNull();
    unmount();
    zeige();
    expect(leiste()).toBeNull();
    expect(umrandet()).toHaveLength(0);
    expect(JSON.stringify({ ...localStorage })).not.toMatch(/fokus|Daniel/i);
  });
});

describe('Fokus – Suchfeld „Person hervorheben“', () => {
  const feld = () => screen.getByRole('combobox', { name: 'Person hervorheben' });

  it('tippen → Vorschläge mit Name und Diensten, nur Treffer am Namensanfang; wählen → Fokus', () => {
    zeige();
    fireEvent.change(feld(), { target: { value: 'da' } });
    const liste = screen.getByRole('listbox', { name: 'Vorschläge' });
    expect(
      within(liste)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['DTDaniel TestTon · Bild · Gesang']);
    fireEvent.click(within(liste).getByRole('option'));
    expect(leiste()?.textContent).toContain('Fokus: Daniel Test · 3 Einsätze');
    expect(namen(umrandet())).toEqual(['Daniel Test', 'Daniel Test', 'Daniel Test']);
    // Das Feld ist wieder leer, die Liste zu.
    expect((feld() as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('auch Wörter hinter dem Vornamen; Gast und verborgener Name tauchen nicht auf', () => {
    zeige();
    fireEvent.change(feld(), { target: { value: 'test' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'ATAnna TestBild · Gesang',
      'DTDaniel TestTon · Bild · Gesang',
    ]);
    // Mitten im Wort zählt nicht („nie“ steckt in „Daniel“).
    fireEvent.change(feld(), { target: { value: 'nie' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    fireEvent.change(feld(), { target: { value: 'gast' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    fireEvent.change(feld(), { target: { value: 'echter' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('Pfeiltasten und Enter wählen', () => {
    zeige();
    fireEvent.change(feld(), { target: { value: 'test' } });
    fireEvent.keyDown(feld(), { key: 'ArrowDown' });
    fireEvent.keyDown(feld(), { key: 'Enter' });
    expect(leiste()?.textContent).toContain('Fokus: Daniel Test');
  });

  it('am Handy steckt das Feld hinter einem Such-Symbol', () => {
    zeige({}, true);
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Person hervorheben' }));
    fireEvent.change(feld(), { target: { value: 'an' } });
    fireEvent.click(screen.getByRole('option', { name: /Anna Test/ }));
    expect(leiste()?.textContent).toContain('Fokus: Anna Test');
  });
});

describe('Fokus – aus „Wer kann?“', () => {
  const laden = vi.mocked(ladeWerKann);
  const KANDIDATEN = [
    { person: { domainIdentifier: '12', title: 'Daniel Test' }, score: 0 },
    { person: { domainIdentifier: '6', title: 'Ben Test' }, score: 0 },
  ];
  const speichern = () =>
    vi.fn(
      (
        _d: EntwuerfeDaten,
        _g: number,
        eingabe: Omit<Entwurf, 'zeit' | 'version'>,
        _erwartet: number | null,
      ) =>
        Promise.resolve({ ok: true as const, entwurf: { ...eingabe, zeit: 'jetzt', version: 1 } }),
    );
  /** Ton am 13.12. ist frei – dort fragt man „Wer kann?“. */
  const offen = async () => {
    const platz = screen.getAllByRole('button', { name: /^frei – Wer kann\?/ });
    fireEvent.click(platz[0]);
    return screen.findByRole('list', { name: 'Wer kann?' });
  };

  it('Mini-Zeile je Kandidat: seine Einsätze ±7 Tage um den Termin', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    zeige();
    const liste = await offen();
    const text = (name: string) =>
      within(liste)
        .getAllByRole('listitem')
        .find((li) => li.textContent?.startsWith(name))?.textContent;
    // Daniel am 13.12.: Ton und Gesang am 06.12. (genau 7 Tage) und Bild am 13.12. (Reihenfolge nach Datum).
    expect(text('Daniel Test')).toContain(
      'Im Plan, ±7 Tage: Ton So 06.12. · Gesang So 06.12. (?) · Bild So 13.12.',
    );
    expect(text('Ben Test')).toContain('Im Plan, ±7 Tage: noch nichts');
  });

  it('„im Plan zeigen“: Fenster zu, Fokus auf die Person, Leiste mit „Zurück zu Wer kann?“', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    zeige();
    await offen();
    fireEvent.click(screen.getByRole('button', { name: 'Im Plan zeigen: Daniel Test' }));
    expect(screen.queryByRole('list', { name: 'Wer kann?' })).toBeNull();
    expect(namen(umrandet())).toEqual(['Daniel Test', 'Daniel Test', 'Daniel Test']);
    expect(leiste()?.textContent).toContain('Fokus: Daniel Test');
    expect(
      screen.getByRole('button', { name: /Zurück zu „Wer kann\?“ für Ton · So, 13\.12\./ }),
    ).toBeTruthy();
    // „Zurück“ öffnet dasselbe Fenster für denselben Platz; der Fokus bleibt, die Zeile „Zurück“ ist weg.
    fireEvent.click(screen.getByRole('button', { name: /Zurück zu „Wer kann\?“/ }));
    expect(await screen.findByRole('list', { name: 'Wer kann?' })).toBeTruthy();
    expect(screen.getByText('Gottesdienst um 10:00 Uhr · Platz 1 von 1')).toBeTruthy();
    expect(leiste()?.textContent).toContain('Fokus: Daniel Test');
    expect(screen.queryByRole('button', { name: /Zurück zu „Wer kann\?“/ })).toBeNull();
  });

  it('„Hier eintragen“ legt den Entwurf an – mit genau denselben Angaben wie die Wahl im Fenster', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    // 1) Die Wahl im Fenster selbst.
    const direkt = speichern();
    const a = zeige({ entwuerfe: nachgebaut({ speichern: direkt }) });
    await offen();
    fireEvent.click(screen.getByRole('button', { name: /^Ben Test/ }));
    await waitFor(() => expect(direkt).toHaveBeenCalledTimes(1));
    a.unmount();
    cleanup();
    // 2) Dieselbe Person über „im Plan zeigen“ → „Hier eintragen“.
    const ueberLeiste = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: ueberLeiste }) });
    await offen();
    fireEvent.click(screen.getByRole('button', { name: 'Im Plan zeigen: Ben Test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hier eintragen' }));
    await waitFor(() => expect(ueberLeiste).toHaveBeenCalledTimes(1));
    expect(ueberLeiste.mock.calls[0].slice(1)).toEqual(direkt.mock.calls[0].slice(1));
    expect(ueberLeiste.mock.calls[0][2]).toMatchObject({
      ort: { eventId: 22, serviceId: 6, index: 1 },
      ziel: { art: 'person', personId: 6, name: 'Ben Test' },
      gesehen: { art: 'frei' },
    });
    expect(await screen.findByText('Ben Test eingetragen – noch nicht gesendet.')).toBeTruthy();
    // Danach gibt es den Weg zurück nicht mehr – der Platz ist besetzt –, der Fokus bleibt.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Hier eintragen' })).toBeNull(),
    );
    expect(leiste()?.textContent).toContain('Fokus: Ben Test');
    // Der Entwurf zählt und ist umrandet.
    await waitFor(() =>
      expect(leiste()?.textContent).toContain('1 Einsatz in 1 Termin · 1 Entwurf'),
    );
  });

  it('„Hier eintragen“ nach „Andere Person wählen“ ersetzt den Platz genauso wie die Wahl im Fenster („statt Anna“)', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    const anna = () =>
      screen.getAllByRole('button', { name: /^Anna Test – zugesagt: zurückziehen/ })[0];
    const ersetzen = async () => {
      fireEvent.click(anna());
      fireEvent.click(await screen.findByRole('button', { name: 'Andere Person wählen' }));
      return screen.findByRole('list', { name: 'Wer kann?' });
    };
    // Anna steht in Bild (Technik) am 06.12. – dort darf man eintragen.
    const direkt = speichern();
    const a = zeige({ entwuerfe: nachgebaut({ speichern: direkt }) });
    const liste = await ersetzen();
    fireEvent.click(within(liste).getByRole('button', { name: /^Daniel Test/ }));
    await waitFor(() => expect(direkt).toHaveBeenCalledTimes(1));
    a.unmount();
    cleanup();
    const ueberLeiste = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: ueberLeiste }) });
    await ersetzen();
    fireEvent.click(screen.getByRole('button', { name: 'Im Plan zeigen: Daniel Test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hier eintragen' }));
    await waitFor(() => expect(ueberLeiste).toHaveBeenCalledTimes(1));
    expect(ueberLeiste.mock.calls[0].slice(1)).toEqual(direkt.mock.calls[0].slice(1));
    // Der Entwurf kennt, wer dort stand: „gesehen“ ist Annas Zusage (nicht „frei“).
    expect(ueberLeiste.mock.calls[0][2].gesehen).toEqual({ art: 'zusage', personId: 5 });
  });

  it('„Hier eintragen“ nach „Andere Person wählen“ an einem Entwurf ersetzt diesen Entwurf (Version) wie die Wahl im Fenster', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    // Ein Entwurf von Alwin für Ben am freien Platz Ton (13.12.); Daniel soll ihn ersetzen.
    const e = entwurf({
      ort: { eventId: 22, serviceId: 6, index: 1 },
      ziel: { art: 'person', personId: 6, name: 'Ben Test' },
      version: 4,
    });
    const anschluss = (speichernFn: ReturnType<typeof speichern>) =>
      nachgebaut({ speichern: speichernFn, laden: () => Promise.resolve(daten([e])) });
    const ersetzen = async () => {
      fireEvent.click(await screen.findByRole('button', { name: /^Entwurf von Alwin: Ben Test/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Andere Person wählen' }));
      return screen.findByRole('list', { name: 'Wer kann?' });
    };
    const direkt = speichern();
    const a = zeige({ entwuerfe: anschluss(direkt) });
    const liste = await ersetzen();
    fireEvent.click(within(liste).getByRole('button', { name: /^Daniel Test/ }));
    await waitFor(() => expect(direkt).toHaveBeenCalledTimes(1));
    a.unmount();
    cleanup();
    const ueberLeiste = speichern();
    zeige({ entwuerfe: anschluss(ueberLeiste) });
    await ersetzen();
    fireEvent.click(screen.getByRole('button', { name: 'Im Plan zeigen: Daniel Test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hier eintragen' }));
    await waitFor(() => expect(ueberLeiste).toHaveBeenCalledTimes(1));
    expect(ueberLeiste.mock.calls[0].slice(1)).toEqual(direkt.mock.calls[0].slice(1));
    // Die Version des ersetzten Entwurfs reist mit – sonst legte es einen zweiten an (oder meldete einen Konflikt).
    expect(ueberLeiste.mock.calls[0][3]).toBe(4);
  });

  it('am Handy ist die Zeile „Zurück“ kompakt, der aria-label bleibt voll', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    zeige({}, true);
    // Am Handy zeigt der Zettel den ersten Termin; dort ist kein Platz frei – Wer kann? über Gesang am 20.12.? Nein:
    // freier Platz des ersten Termins gibt es nicht, deshalb der Weg über den Platz Anna (ersetzen).
    fireEvent.click(
      screen.getAllByRole('button', { name: /^Anna Test – zugesagt: zurückziehen/ })[0],
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Andere Person wählen' }));
    await screen.findByRole('list', { name: 'Wer kann?' });
    fireEvent.click(screen.getByRole('button', { name: 'Im Plan zeigen: Daniel Test' }));
    const z = screen.getByRole('button', { name: /^Zurück zu „Wer kann\?“ für Bild/ });
    expect(z.textContent).toMatch(/^‹ Wer kann\? · Bild · /);
  });

  it('ein Konflikt beim Eintragen geht nicht verloren: Hinweis, „Hier eintragen“ bleibt', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    const ablehnen = vi.fn(() =>
      Promise.resolve({ ok: false as const, grund: 'konflikt' as const }),
    );
    zeige({ entwuerfe: nachgebaut({ speichern: ablehnen }) });
    await offen();
    fireEvent.click(screen.getByRole('button', { name: 'Im Plan zeigen: Ben Test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hier eintragen' }));
    expect(await screen.findByText(/hat eben jemand den Platz geändert/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hier eintragen' })).toBeTruthy();
  });

  it('ohne Recht zum Eintragen gibt es „Hier eintragen“ nicht, den Weg zurück schon', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    zeige({
      entwuerfe: nachgebaut({
        laden: () => Promise.resolve(daten([], { stand: 'nur-lesen' })),
      }),
    });
    await offen();
    fireEvent.click(screen.getByRole('button', { name: 'Im Plan zeigen: Daniel Test' }));
    expect(screen.getByRole('button', { name: /Zurück zu „Wer kann\?“/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hier eintragen' })).toBeNull();
  });

  it('eine andere Fokus-Wahl (Suchfeld) lässt „Zurück“ und „Hier eintragen“ verschwinden', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    zeige();
    await offen();
    fireEvent.click(screen.getByRole('button', { name: 'Im Plan zeigen: Daniel Test' }));
    fireEvent.click(symbol('Anna Test'));
    expect(screen.queryByRole('button', { name: /Zurück zu „Wer kann\?“/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hier eintragen' })).toBeNull();
  });
});
