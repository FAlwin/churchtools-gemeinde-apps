// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Zeitraum } from '@shared/protokolle/fruehere';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { STANDARD_VORLAGEN } from '@shared/protokolle/vorlagen';
import * as L from './lesen';
import * as B from './beginnen';
import * as V from './vorlagen';
import { Sitzungen } from './Sitzungen';
import { neuAngebot, neuWaehlen } from './neuMenue.testutil';

/**
 * „Frühere Treffen“ (v1.0.1): Block „Noch ohne Protokoll“ und Fenster „Protokoll nachtragen“ im Reiter „Sitzungen“.
 * Gelesen wird über `sitzungenOhneProtokoll` (eigene Tests in `lesenFruehere.test.ts`); hier zählt, **was** gefragt und
 * **wem** was gezeigt wird. „Heute“ ist fest: Di 17.11.2026 (nur `Date` ist falsch, damit `waitFor` echt weiterläuft).
 */
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeSitzungen: vi.fn(),
  ladeMitarbeit: vi.fn(),
  sitzungenOhneProtokoll: vi.fn(),
}));
vi.mock('./beginnen', () => ({ protokollBeginnen: vi.fn() }));
vi.mock('./vorlagen', () => ({ ladeVorlagen: vi.fn() }));
vi.mock('./mitglieder', () => ({
  ladeGruppenMitglieder: vi.fn(() => Promise.resolve('verborgen')),
}));
const m = vi.mocked(L);
const beginnen = vi.mocked(B.protokollBeginnen);

const ICH = { person: 1, name: 'Alwin' };
const GRUPPEN: ProtokollGruppe[] = [
  { id: 194, name: 'Technik', lage: 'eingerichtet', protokolle: 60, mitarbeit: 61 },
];
const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, 'okt');
const KOPF: ProtokollKopf = {
  art: 'protokoll',
  fassung: 1,
  sitzung: 'okt',
  titel: 'Techniker Treffen',
  status: 'frei',
  beginn: '2026-10-18T17:00:00Z',
  termin: null,
  treffen: null,
  freigabe: { von: 1, am: '2026-10-19T08:00:00Z' },
  sperre: null,
  stand,
};
const FREI: Sitzung = {
  schluessel: 'p:okt',
  beginn: KOPF.beginn,
  titel: 'Techniker Treffen',
  termin: null,
  treffen: null,
  kopf: KOPF,
  anfragen: [],
};
const KOMMEND: Sitzung = {
  schluessel: 't:4:200',
  beginn: '2026-12-11T17:00:00Z',
  titel: 'Dezember-Treffen',
  termin: { kalender: 4, id: 200 },
  treffen: 30,
  kopf: null,
  anfragen: [],
};
const DATEN: L.GruppenSitzungen = {
  kommend: [KOMMEND],
  protokolle: [FREI],
  teile: werte.map((w) => JSON.parse(w) as ProtokollTeil),
  kalender: 4,
  treffenNichtFreigegeben: false,
  punkte: 'vorschlagen',
};
const TECHNIKER: Sitzung = {
  schluessel: 't:4:114',
  beginn: '2026-11-15T17:00:00Z',
  titel: 'Techniker Treffen',
  termin: { kalender: 4, id: 114 },
  treffen: 24,
  kopf: null,
  anfragen: [
    { person: 1, antwort: 'zugesagt' },
    { person: 2, antwort: 'zugesagt' },
    { person: 3, antwort: 'abgesagt' },
  ],
};
const SEPTEMBER: Sitzung = {
  schluessel: 'g:9',
  beginn: '2026-09-20T17:00:00Z',
  titel: 'Gruppentreffen',
  termin: null,
  treffen: 9,
  kopf: null,
  anfragen: [],
  abgeschlossen: true,
};
const OKTOBER: Sitzung = {
  schluessel: 't:4:150',
  beginn: '2026-10-04T17:00:00Z',
  titel: 'Mikrofone prüfen',
  termin: { kalender: 4, id: 150 },
  treffen: null,
  kopf: null,
  anfragen: [{ person: 1, antwort: 'zugesagt' }],
};
/** Was ChurchTools je Zeitraum „liefert“: Block (19.10.–16.11.), November, Oktober, September. */
const NACH_ZEITRAUM = (z: Zeitraum): Sitzung[] =>
  z.von === '2026-11-01'
    ? [TECHNIKER]
    : z.von === '2026-10-01'
      ? [OKTOBER]
      : z.von === '2026-09-01'
        ? [SEPTEMBER]
        : z.von === '2026-10-19'
          ? [TECHNIKER]
          : [];
const zeitraeume = () => m.sitzungenOhneProtokoll.mock.calls.map((c) => c[0].zeitraum);

const zeigen = (schreibbar: number[] = [60]) =>
  render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={schreibbar} />);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T10:00:00Z'));
  vi.clearAllMocks();
  m.ladeSitzungen.mockResolvedValue(DATEN);
  m.ladeMitarbeit.mockResolvedValue({ aufgaben: [], todoVorschlaege: [], vorschlaege: [] });
  m.sitzungenOhneProtokoll.mockImplementation((q) =>
    Promise.resolve({ sitzungen: NACH_ZEITRAUM(q.zeitraum), treffenNichtFreigegeben: false }),
  );
  vi.mocked(V.ladeVorlagen).mockResolvedValue({
    kategorie: 68,
    vorlagen: STANDARD_VORLAGEN.map((vorlage, i) => ({ wert: 500 + i, vorlage })),
  });
});
afterEach(() => vi.useRealTimers());

describe('Block „Noch ohne Protokoll“', () => {
  it('Leitung: seit dem letzten freigegebenen Protokoll bis gestern, mit Zusagen und „vor 2 Tagen“', async () => {
    zeigen();
    const block = await screen.findByRole('region', { name: 'Noch ohne Protokoll' });
    expect(within(block).getByText('Techniker Treffen')).toBeTruthy();
    expect(within(block).getByText(/vor 2 Tagen/)).toBeTruthy();
    expect(within(block).getByText('2 Zusagen · 1 Absage')).toBeTruthy();
    expect(within(block).getByText('Einladung')).toBeTruthy();
    expect(within(block).getByText('Gruppentreffen')).toBeTruthy();
    expect(
      within(block).getByText(/Seit dem letzten freigegebenen Protokoll \(18\.10\.2026\)/),
    ).toBeTruthy();
    expect(m.sitzungenOhneProtokoll).toHaveBeenCalledTimes(1);
    expect(m.sitzungenOhneProtokoll.mock.calls[0][0]).toMatchObject({
      gruppe: 194,
      kalender: 4,
      zeitraum: { von: '2026-10-19', bis: '2026-11-16' },
    });
    expect(m.sitzungenOhneProtokoll.mock.calls[0][0].koepfe.map((k) => k.sitzung)).toEqual(['okt']);
  });

  it('Mitglied: kein Block (auch nicht der Satz „Ein Protokoll beginnt die Leitung …“), und es wird gar nicht erst gelesen', async () => {
    zeigen([]);
    await screen.findByRole('region', { name: 'Kommend' });
    expect(screen.queryByRole('region', { name: 'Noch ohne Protokoll' })).toBeNull();
    expect(screen.queryByText(/Ein Protokoll beginnt die Leitung/)).toBeNull();
    expect(m.sitzungenOhneProtokoll).not.toHaveBeenCalled();
  });

  it('Mitglied: kein Knopf „Protokoll nachtragen“, die Leitung hat ihn', async () => {
    const { unmount } = zeigen([]);
    await screen.findByRole('region', { name: 'Kommend' });
    expect(await neuAngebot()).not.toContain('Protokoll nachtragen');
    unmount();
    zeigen([60]);
    await screen.findByRole('region', { name: 'Kommend' });
    expect(await neuAngebot()).toContain('Protokoll nachtragen');
  });

  it('nichts offen: der Block ist weg', async () => {
    m.sitzungenOhneProtokoll.mockResolvedValue({ sitzungen: [], treffenNichtFreigegeben: false });
    zeigen();
    await screen.findByRole('region', { name: 'Kommend' });
    await waitFor(() => expect(m.sitzungenOhneProtokoll).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Noch ohne Protokoll' })).toBeNull();
  });

  it('Lesefehler: Hinweis im Block, der Rest der Seite bleibt; „Erneut versuchen“ liest noch einmal', async () => {
    m.sitzungenOhneProtokoll.mockRejectedValueOnce(new ApiError(503, 'weg'));
    zeigen();
    const block = await screen.findByRole('region', { name: 'Noch ohne Protokoll' });
    expect(await within(block).findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Kommend' })).toBeTruthy();
    expect(await neuAngebot()).toContain('Protokoll nachtragen');
    fireEvent.click(within(block).getByRole('button', { name: 'Erneut versuchen' }));
    expect(
      await within(await screen.findByRole('region', { name: 'Noch ohne Protokoll' })).findByText(
        'Techniker Treffen',
      ),
    ).toBeTruthy();
  });

  it('„Protokoll beginnen“ öffnet das bekannte Fenster mit genau dieser Sitzung und verknüpft Termin und Treffen', async () => {
    beginnen.mockResolvedValue({ art: 'ok', sitzung: 'neu', hinweis: null });
    zeigen();
    const block = await screen.findByRole('region', { name: 'Noch ohne Protokoll' });
    fireEvent.click(within(block).getByRole('button', { name: /Protokoll beginnen/ }));
    const fenster = await screen.findByRole('dialog', { name: 'Protokoll beginnen' });
    expect(within(fenster).getByText(/Techniker Treffen · .*15\.11\.2026/)).toBeTruthy();
    expect(
      within(fenster).getByText(/mit diesem Termin und dem Gruppentreffen verknüpft/),
    ).toBeTruthy();
    // „Wie letztes Mal“ = das freigegebene vom 18.10. (vor diesem Treffen)
    fireEvent.click(await within(fenster).findByRole('button', { name: 'Beginnen' }));
    await waitFor(() => expect(beginnen).toHaveBeenCalled());
    expect(beginnen.mock.calls[0][0]).toMatchObject({
      gruppe: 194,
      kategorie: 60,
      sitzung: { termin: { kalender: 4, id: 114 }, treffen: 24, beginn: TECHNIKER.beginn },
    });
    // Danach wird neu geladen (und das neue Protokoll geöffnet).
    await waitFor(() => expect(m.ladeSitzungen.mock.calls.length).toBeGreaterThan(1));
  });
});

describe('Fenster „Protokoll nachtragen“', () => {
  const oeffnen = async () => {
    zeigen();
    await screen.findByRole('region', { name: 'Kommend' });
    await neuWaehlen('Protokoll nachtragen');
    return screen.findByRole('dialog', { name: 'Protokoll nachtragen' });
  };

  it('startet im aktuellen Monat und liest nur diesen (bis gestern); vorwärts ist gesperrt', async () => {
    const fenster = await oeffnen();
    expect(within(fenster).getByText('November 2026')).toBeTruthy();
    expect(within(fenster).getByRole('button', { name: 'Nächster Monat' })).toHaveProperty(
      'disabled',
      true,
    );
    await within(fenster).findByText('Techniker Treffen');
    // Block (19.10.–16.11.) + Fenster (1.–16.11.) – kein weiter Zeitraum
    expect(zeitraeume()).toEqual([
      { von: '2026-10-19', bis: '2026-11-16' },
      { von: '2026-11-01', bis: '2026-11-16' },
    ]);
  });

  it('blättert monatsweise zurück – jeder Monat liest nur sich selbst; vorwärts wieder frei', async () => {
    const fenster = await oeffnen();
    await within(fenster).findByText('Techniker Treffen');
    fireEvent.click(within(fenster).getByRole('button', { name: 'Voriger Monat' }));
    expect(await within(fenster).findByText('Mikrofone prüfen')).toBeTruthy();
    expect(within(fenster).getByText('Oktober 2026')).toBeTruthy();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Voriger Monat' }));
    await within(fenster).findByText('September 2026');
    expect(zeitraeume().slice(2)).toEqual([
      { von: '2026-10-01', bis: '2026-10-31' },
      { von: '2026-09-01', bis: '2026-09-30' },
    ]);
    fireEvent.click(within(fenster).getByRole('button', { name: 'Nächster Monat' }));
    expect(await within(fenster).findByText('Oktober 2026')).toBeTruthy();
  });

  it('Zeile: Datum, Uhrzeit, Art, Zusagen und Hinweis zur Anwesenheit; abgeschlossenes Treffen sagt es', async () => {
    const fenster = await oeffnen();
    await within(fenster).findByText('Techniker Treffen');
    expect(within(fenster).getByText('Anwesenheit wird aus den Antworten vorbelegt.')).toBeTruthy();
    expect(within(fenster).getByText('2 Zusagen · 1 Absage')).toBeTruthy();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Voriger Monat' }));
    await within(fenster).findByText('Mikrofone prüfen');
    expect(within(fenster).getByText('Termin mit Einladung')).toBeTruthy();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Voriger Monat' }));
    await within(fenster).findByText('Gruppentreffen abgeschlossen');
    expect(within(fenster).getByText(/Anwesenheit steht in ChurchTools fest/)).toBeTruthy();
  });

  it('leerer Monat: freundlicher Satz', async () => {
    const fenster = await oeffnen();
    await within(fenster).findByText('Techniker Treffen');
    for (let i = 0; i < 3; i++) {
      fireEvent.click(within(fenster).getByRole('button', { name: 'Voriger Monat' }));
      await waitFor(() => expect(m.sitzungenOhneProtokoll.mock.calls.length).toBe(3 + i));
    }
    expect(await within(fenster).findByText('August 2026')).toBeTruthy();
    expect(
      await within(fenster).findByText(/Im August 2026 gibt es nichts nachzutragen/),
    ).toBeTruthy();
  });

  it('Zeile antippen → „Protokoll beginnen“ im selben Fenster mit genau dieser Sitzung', async () => {
    beginnen.mockResolvedValue({ art: 'ok', sitzung: 'neu', hinweis: null });
    const fenster = await oeffnen();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Voriger Monat' }));
    fireEvent.click(await within(fenster).findByText('Mikrofone prüfen'));
    const beginnenFenster = await screen.findByRole('dialog', { name: 'Protokoll beginnen' });
    expect(screen.queryByRole('dialog', { name: 'Protokoll nachtragen' })).toBeNull();
    expect(within(beginnenFenster).getByText(/Mikrofone prüfen · .*04\.10\.2026/)).toBeTruthy();
    fireEvent.click(await within(beginnenFenster).findByRole('button', { name: 'Beginnen' }));
    await waitFor(() => expect(beginnen).toHaveBeenCalled());
    expect(beginnen.mock.calls[0][0].sitzung).toMatchObject({
      termin: { kalender: 4, id: 150 },
      treffen: null,
      beginn: OKTOBER.beginn,
    });
  });

  it('Lesefehler im Fenster: Hinweis mit „Erneut versuchen“, nichts wird als leer ausgegeben', async () => {
    const fenster = await oeffnen();
    await within(fenster).findByText('Techniker Treffen');
    m.sitzungenOhneProtokoll.mockRejectedValueOnce(new ApiError(503, 'weg'));
    fireEvent.click(within(fenster).getByRole('button', { name: 'Voriger Monat' }));
    expect(await within(fenster).findByRole('alert')).toBeTruthy();
    expect(within(fenster).queryByText(/nichts nachzutragen/)).toBeNull();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Erneut versuchen' }));
    expect(await within(fenster).findByText('Mikrofone prüfen')).toBeTruthy();
  });
});
