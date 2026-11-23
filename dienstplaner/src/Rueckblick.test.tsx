// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HANDY_BREITE } from '@ui/bedienung/useMedienAbfrage';
import { itemLabel } from '@shared/ct/ablaufZeile';
import { endeStelle, liveListe } from '@shared/ct/liveAgenda';
import { ausnahmeSetzen, wechselAus, zusammenfuehren, type Wechsel } from '@shared/ct/liveVerlauf';
import { schnittAus, schnittSchluessel, type VerlaufTermin } from '@shared/ct/liveRueckblick';
import { VERLAUF_VERWEIGERT } from '@shared/dienstplan/liveVerlaufSpeicher';
import type { CtAgendaItem } from '@shared/ct/typen';
import { Rueckblick } from './Rueckblick';
import { STANDARD_ANZEIGE } from './meineAnzeige';
import type { schreibeAusnahmen } from './ladeVerlauf';

const EVENT = 7;
const T0 = Date.parse('2026-11-22T09:00:00Z');
const MIN = 60_000;

const song = (title: string) => ({ title, songId: 1, arrangementId: 1, arrangement: 'Standard' });
/** Plan 10:00–11:05 (Ortszeit Berlin, UTC+1): Beginn nach dem Soundcheck um 10:00. */
const ITEMS = [
  { id: 1, title: 'Soundcheck', type: 'normal', duration: 300, isBeforeEvent: true, at: -5 },
  { id: 2, title: 'Lobpreis', type: 'header', at: 0 },
  { id: 3, title: 'Lied', type: 'song', duration: 240, song: song('Halleluja'), at: 0 },
  { id: 4, title: 'Begrüßung', type: 'normal', duration: 600, at: 4 },
  { id: 5, title: 'Gebet', type: 'normal', duration: 300, at: 14 },
  { id: 6, title: 'Predigt', type: 'header', at: 19 },
  { id: 7, title: 'Predigt', type: 'normal', duration: 1800, at: 19 },
].map(({ at, ...i }) => ({
  ...i,
  startTimes: { [String(EVENT)]: new Date(T0 + (at + 5) * MIN).toISOString() },
})) as CtAgendaItem[];

const liste = liveListe(ITEMS, EVENT);
const ENDE = endeStelle(liste);

/** Ein Durchgang aus den Erzeugern: Soundcheck 09:00, Lied ab 09:05, Gebet überzogen, Predigt 6:40 länger. */
const wechsel: Wechsel[] = [
  [1, 0],
  [2, 300],
  [3, 300 + 250],
  [4, 300 + 250 + 400],
  [5, 300 + 250 + 400 + 360],
  [ENDE, 300 + 250 + 400 + 360 + 1800 + 400],
].reduce<Wechsel[]>(
  (acc, [stelle, sek]) => zusammenfuehren(acc, [wechselAus(liste, stelle, T0 + sek * 1000)]),
  [],
);
const verlauf: VerlaufTermin = { wechsel, ausnahmen: [] };
// Ein Vergleichstermin für Ø: Begrüßung 8 Min, Lied 4 Min
const frueher: VerlaufTermin = {
  wechsel: [
    [2, 0],
    [3, 240],
    [4, 480],
    [ENDE, 960],
  ].reduce<Wechsel[]>(
    (acc, [stelle, sek]) =>
      zusammenfuehren(acc, [wechselAus(liste, stelle, T0 - 7 * 86_400_000 + sek * 1000)]),
    [],
  ),
  ausnahmen: [],
};
const schnitt = schnittAus([frueher, verlauf]);

function setzeHandy(an: boolean) {
  window.matchMedia = ((abfrage: string) => ({
    matches: an && abfrage === HANDY_BREITE,
    media: abfrage,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function zeige(
  p: Partial<React.ComponentProps<typeof Rueckblick>> = {},
  v: VerlaufTermin = verlauf,
) {
  const onAusnahmen = vi.fn();
  const schreiben = vi.fn<typeof schreibeAusnahmen>((_t, neue) =>
    Promise.resolve({ ok: true, wechsel: [...v.wechsel], ausnahmen: [...neue] }),
  );
  const r = render(
    <Rueckblick
      terminId={EVENT}
      tag="2026-11-22"
      items={ITEMS}
      zeitzone="Europe/Berlin"
      verlauf={v}
      schnitt={schnitt}
      darfAusnehmen
      anzeige={STANDARD_ANZEIGE}
      onAusnahmen={onAusnahmen}
      schreiben={schreiben}
      {...p}
    />,
  );
  return { ...r, onAusnahmen, schreiben };
}

const zeileVon = (name: string) =>
  screen.getByText(name, { selector: 'span' }).closest('[role="row"]') as HTMLElement;
const MINUS = '−';

beforeEach(() => setzeHandy(false));
afterEach(cleanup);

describe('Rückblick – was die Karte zeigt (A6, A18)', () => {
  it('Kopf mit dem Datum, Beginn und Ende mit ± gegen den Plan, eingeholt und überzogen', () => {
    zeige();
    expect(screen.getByRole('heading', { name: /Rückblick · Live am 22\.11\./ })).toBeTruthy();
    // Beginn 10:05 Ortszeit (09:05 UTC) = Plan; Ende 4:30 nach dem Plan-Ende (Plan 54 Min, gelaufen 58:30)
    const chip = (name: string) => screen.getByText(name).parentElement?.textContent ?? '';
    expect(chip('Beginn')).toContain('10:05');
    expect(chip('Beginn')).toContain('±0:00');
    expect(chip('Ende')).toContain(`${MINUS}4:30`);
    expect(chip('Am meisten überzogen')).toContain('Predigt');
    expect(chip('Am meisten überzogen')).toContain(`${MINUS}6:40`);
    expect(chip('Am meisten eingeholt')).toContain('Begrüßung');
    expect(chip('Am meisten eingeholt')).toContain('+3:20');
  });

  it('ohne Ende des Live gibt es keine Karte', () => {
    const ohneEnde = { wechsel: wechsel.slice(0, -1), ausnahmen: [] };
    const { container } = zeige({}, ohneEnde);
    expect(container.textContent).toBe('');
  });

  it('ohne Verlauf keine Karte, nichts kaputt', () => {
    const { container } = zeige({}, { wechsel: [], ausnahmen: [] });
    expect(container.textContent).toBe('');
  });

  it('„Rückblick zeigen“ aus (Meine Anzeige): keine Karte', () => {
    const { container } = zeige({ anzeige: { ...STANDARD_ANZEIGE, rueckblick: false } });
    expect(container.textContent).toBe('');
  });

  it('Tabelle: Plan, Gelaufen, ± und Ø bisher je Punkt – gegliedert nach den Abschnitten des Ablaufs', () => {
    zeige();
    const tabelle = screen.getByRole('table', { name: 'Was wie lange lief' });
    const gruppen = within(tabelle).getAllByRole('rowgroup');
    // Der Soundcheck steht vor der ersten Überschrift (ohne Band), danach „Lobpreis“ und „Predigt“ mit Band.
    expect(gruppen[0].firstElementChild?.getAttribute('role')).toBe('row');
    expect(gruppen.slice(1).map((g) => g.firstElementChild?.textContent)).toEqual([
      'Lobpreis',
      'Predigt',
    ]);
    const lied = zeileVon(itemLabel(ITEMS[2]));
    expect(lied.textContent).toContain('4:00'); // Plan
    expect(lied.textContent).toContain('4:10'); // gelaufen 250 s
    expect(lied.textContent).toContain(`${MINUS}0:10`);
    expect(lied.textContent).toContain('Lied Ø 4:05 · 2×');
    const predigt = zeileVon('Predigt');
    expect(predigt.textContent).toContain('30:00');
    expect(predigt.textContent).toContain('36:40');
    expect(predigt.textContent).toContain(`${MINUS}6:40`);
  });

  it('der Soundcheck vor dem Beginn steht mit in der Tabelle (er ist gelaufen)', () => {
    zeige();
    expect(zeileVon('Soundcheck').textContent).toContain('5:00');
  });

  it('Spalten „±“ und „Ø bisher“ lassen sich ausblenden (Meine Anzeige)', () => {
    zeige({ anzeige: { ...STANDARD_ANZEIGE, spalteAbweichung: false, spalteSchnitt: false } });
    expect(screen.queryByRole('columnheader', { name: '±' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Ø bisher' })).toBeNull();
    expect(zeileVon('Predigt').textContent).not.toContain(`${MINUS}6:40`);
    expect(screen.getByRole('columnheader', { name: 'Plan' })).toBeTruthy();
    // Ohne die Spalte „Ø bisher“ braucht es auch ihre Erklärung nicht.
    expect(screen.queryByText(/„Ø bisher“ zählt gleichnamige Punkte/)).toBeNull();
  });

  it('Handy: Plan, Gelaufen, ± und Ø stehen alle da – mit Beschriftung, nichts abgeschnitten', () => {
    setzeHandy(true);
    zeige();
    const z = zeileVon('Predigt');
    expect(z.textContent).toContain('Plan 30:00');
    expect(z.textContent).toContain('Gelaufen 36:40');
    expect(z.textContent).toContain(`${MINUS}6:40`);
    expect(z.textContent).toMatch(/Ø bisher .*×/);
  });
});

describe('Bezeichnung wie in der Live-Liste', () => {
  it('Lieder heißen „Lied – Halleluja“ (itemLabel, nicht nachgebaut) – in der Zeile und im Menü-Titel', () => {
    zeige();
    const soll = itemLabel(ITEMS[2]);
    expect(soll).toBe('Lied – Halleluja');
    expect(within(zeileVon(soll)).getByRole('button', { name: `Mehr – ${soll}` })).toBeTruthy();
    // Jede Zeile trägt genau die Bezeichnung des Erzeugers
    for (const i of ITEMS.filter((x) => x.type !== 'header' && x.id !== 1)) {
      expect(zeileVon(itemLabel(i))).toBeTruthy();
    }
  });

  it('auch bei „am meisten eingeholt/überzogen“', () => {
    const lang = [
      [1, 0],
      [2, 300],
      [3, 300 + 1000],
      [4, 300 + 1000 + 400],
      [5, 300 + 1000 + 400 + 300],
      [ENDE, 300 + 1000 + 400 + 300 + 1800],
    ].reduce<Wechsel[]>(
      (a, [st, sek]) => zusammenfuehren(a, [wechselAus(liste, st, T0 + sek * 1000)]),
      [],
    );
    zeige({}, { wechsel: lang, ausnahmen: [] });
    expect(screen.getByText('Am meisten überzogen').parentElement?.textContent).toContain(
      itemLabel(ITEMS[2]),
    );
  });
});

describe('Aus dem Schnitt nehmen (A9)', () => {
  it('ohne Schreibrecht kein „⋯“ – weder je Zeile noch im Kopf', () => {
    zeige({ darfAusnehmen: false });
    expect(screen.queryByRole('button', { name: /^Mehr/ })).toBeNull();
  });

  it('ein Punkt: Menü „Aus dem Schnitt nehmen“ schreibt die Markierung und meldet das Nachgelesene', async () => {
    const { schreiben, onAusnahmen } = zeige();
    fireEvent.click(within(zeileVon('Predigt')).getByRole('button', { name: 'Mehr – Predigt' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Aus dem Schnitt nehmen' }));
    await waitFor(() => expect(onAusnahmen).toHaveBeenCalled());
    expect(schreiben).toHaveBeenCalledTimes(1);
    const [terminId, neue] = schreiben.mock.calls[0];
    expect(terminId).toBe(EVENT);
    expect(neue).toEqual([{ punkt: 7, zeit: expect.any(Number) as number, aus: true }]);
    expect(onAusnahmen).toHaveBeenCalledWith(neue);
  });

  it('der ganze Termin: Menü im Kartenkopf', async () => {
    const { schreiben } = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Mehr – Rückblick' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Termin aus dem Schnitt nehmen' }));
    await waitFor(() => expect(schreiben).toHaveBeenCalled());
    expect(schreiben.mock.calls[0][1]).toEqual([
      { punkt: null, zeit: expect.any(Number) as number, aus: true },
    ]);
  });

  it('ein ausgenommener Punkt trägt das Etikett „nicht im Schnitt“, zählt nicht für „überzogen“ und lässt sich zurücknehmen', async () => {
    const ausnahmen = ausnahmeSetzen([], 7, true, T0);
    const { schreiben } = zeige({}, { wechsel, ausnahmen });
    expect(within(zeileVon('Predigt')).getByText('nicht im Schnitt')).toBeTruthy();
    expect(screen.getByText('Am meisten überzogen').parentElement?.textContent).not.toContain(
      'Predigt',
    );
    fireEvent.click(within(zeileVon('Predigt')).getByRole('button', { name: 'Mehr – Predigt' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wieder in den Schnitt nehmen' }));
    await waitFor(() => expect(schreiben).toHaveBeenCalled());
    const neu = schreiben.mock.calls[0][1][0];
    expect(neu).toMatchObject({ punkt: 7, aus: false });
    expect(neu.zeit).toBeGreaterThan(ausnahmen[0].zeit);
  });

  it('ein ausgenommener Termin trägt das Etikett im Kopf und bietet die Rücknahme an', () => {
    zeige({}, { wechsel, ausnahmen: ausnahmeSetzen([], null, true, T0) });
    const kopf = screen.getByRole('heading', { name: /Rückblick/ });
    expect(within(kopf).getByText('nicht im Schnitt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mehr – Rückblick' }));
    expect(
      screen.getByRole('menuitem', { name: 'Termin wieder in den Schnitt nehmen' }),
    ).toBeTruthy();
  });

  it('scheitert das Speichern (Netz), steht ein Hinweis da und nichts wird gemeldet', async () => {
    const schreiben = vi.fn<typeof schreibeAusnahmen>(() =>
      Promise.resolve({ ok: false, grund: 'voruebergehend' }),
    );
    const { onAusnahmen } = zeige({ schreiben });
    fireEvent.click(within(zeileVon('Predigt')).getByRole('button', { name: 'Mehr – Predigt' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Aus dem Schnitt nehmen' }));
    expect((await screen.findByRole('alert')).textContent).toContain('nicht speichern');
    expect(onAusnahmen).not.toHaveBeenCalled();
    // Die Zeile zählt weiter – es wurde nichts verändert.
    expect(within(zeileVon('Predigt')).queryByText('nicht im Schnitt')).toBeNull();
  });

  it('ohne Recht an der Ablage: der Grund wird genannt', async () => {
    const schreiben = vi.fn<typeof schreibeAusnahmen>(() =>
      Promise.resolve({ ok: false, grund: 'kein-recht' }),
    );
    zeige({ schreiben });
    fireEvent.click(within(zeileVon('Predigt')).getByRole('button', { name: 'Mehr – Predigt' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Aus dem Schnitt nehmen' }));
    expect((await screen.findByRole('alert')).textContent).toBe(VERLAUF_VERWEIGERT);
  });

  it('wirft das Schreiben, bleibt die Karte ganz', async () => {
    const schreiben = vi.fn<typeof schreibeAusnahmen>(() => Promise.reject(new Error('Netz')));
    zeige({ schreiben });
    fireEvent.click(within(zeileVon('Predigt')).getByRole('button', { name: 'Mehr – Predigt' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Aus dem Schnitt nehmen' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Was wie lange lief' })).toBeTruthy();
  });
});

describe('Ø bisher in der Karte', () => {
  it('der Schlüssel ist der Titel, Lieder zählen zusammen', () => {
    expect(schnitt.get(schnittSchluessel('Begrüßung', false)!)?.n).toBe(2);
    expect(schnitt.get('lied')?.n).toBe(2);
  });

  it('noch kein Schnitt gelesen: Striche statt Zahlen', () => {
    zeige({ schnitt: null });
    expect(zeileVon('Predigt').textContent).toContain('–');
  });
});
