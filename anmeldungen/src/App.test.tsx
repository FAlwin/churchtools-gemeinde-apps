// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { ChurchToolsBremst } from '@ui/ct/verbindung';
import { App } from './App';
import { fehlerZustand } from './zustand';
import { NichtUebernommen } from './einrichten';
import { datumText } from './anzeige';
import { tagAusIso } from '@shared/ct/zeit';
import { ladeStart } from './start';
import { ladeUebersicht, type Uebersicht } from './veranstaltungen';
import { anlegenMoeglich } from './einrichten';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
// Die Veranstaltungsseite als Attrappe: Ein Knopf meldet „archiviert“ – wie „Verwalten → Löschen“.
const zurueckholen = vi.fn().mockResolvedValue(undefined);
vi.mock('./VeranstaltungSeite', () => ({
  VeranstaltungSeite: ({
    onGeaendert,
  }: {
    onGeaendert: (a: { text: string; rueckgaengig: () => Promise<void> }, weg: boolean) => void;
  }) => (
    <button
      type="button"
      onClick={() => onGeaendert({ text: '„X“ ist im Archiv.', rueckgaengig: zurueckholen }, true)}
    >
      archivieren
    </button>
  ),
}));
vi.mock('./veranstaltungen', () => ({ ladeUebersicht: vi.fn() }));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  anlegenMoeglich: vi.fn(),
  istGruppenAdmin: vi.fn().mockResolvedValue(false),
}));
const laden = vi.mocked(ladeStart);
const ladenUebersicht = vi.mocked(ladeUebersicht);
const anlegen = vi.mocked(anlegenMoeglich);

const LEER: Uebersicht = {
  einteilung: { anstehend: [], entwuerfe: [], vorbei: [] },
  hinweise: [],
  offen: new Map(),
  verborgen: new Map(),
};

describe('App der Anmeldungen (#474, #480)', () => {
  beforeEach(() => anlegen.mockResolvedValue({ artId: 5, teamIds: [] }));

  it('zeigt Gruß, Gemeinde und die Gruppen mit Leitung/Mitglied', async () => {
    laden.mockResolvedValue({
      vorname: 'Alwin',
      gemeinde: 'Evangeliumschristen- Gemeinde e.V.',
      gruppen: [
        { id: 9, name: 'Lobpreisteam', leitung: true },
        { id: 7, name: 'Technik', leitung: false },
      ],
    });
    ladenUebersicht.mockResolvedValue(LEER);
    render(<App />);
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
    expect(screen.getByText(/Evangeliumschristen- Gemeinde e\.V\./)).toBeTruthy();
    // Neben dem Gruß steht das heutige Datum („Di, 13.10.2026“) – über den gemeinsamen Rahmen.
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(screen.getByText(datumText(tagAusIso(new Date().toISOString(), zone)))).toBeTruthy();
    const zeilen = screen.getAllByRole('listitem').map((z) => z.textContent);
    expect(zeilen).toEqual(['Lobpreisteamnichts geplantLeitung', 'Techniknichts geplantMitglied']);
    // Die Übersicht wird mit genau den Gruppen der Person geladen.
    // Dazu die Gruppenart (A5: erkennt Veranstaltungen, deren Einstellungen überschrieben wurden).
    expect(ladenUebersicht).toHaveBeenCalledWith(
      [
        { id: 9, name: 'Lobpreisteam', leitung: true },
        { id: 7, name: 'Technik', leitung: false },
      ],
      expect.any(Date),
      5,
    );
  });

  it('keine Gruppen → erklärt, warum', async () => {
    laden.mockResolvedValue({ vorname: 'Alwin', gemeinde: null, gruppen: [] });
    ladenUebersicht.mockResolvedValue(LEER);
    render(<App />);
    expect(await screen.findByText(/Du bist in keiner Gruppe/)).toBeTruthy();
  });

  it('Übersicht scheitert vorübergehend → „Erneut versuchen" lädt beides neu', async () => {
    laden.mockResolvedValue({ vorname: 'Alwin', gemeinde: null, gruppen: [] });
    ladenUebersicht.mockRejectedValueOnce(new ApiError(502, 'x')).mockResolvedValueOnce(LEER);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
    expect(laden).toHaveBeenCalledTimes(2);
    expect(ladenUebersicht).toHaveBeenCalledTimes(2);
  });
});

describe('fehlerZustand – die Zweige einzeln', () => {
  it('abgemeldet (401) → kein „Erneut versuchen", sondern neu anmelden', () => {
    expect(fehlerZustand(new ApiError(401, ''))).toMatchObject({ nochmal: false });
  });
  it('Bremse, 5xx und Netzfehler → vorübergehend, mit „Erneut versuchen"', () => {
    for (const e of [
      new ChurchToolsBremst(5000),
      new ApiError(504, ''),
      new TypeError('Failed to fetch'),
    ]) {
      expect(fehlerZustand(e)).toMatchObject({
        nochmal: true,
        text: expect.stringContaining('antwortet gerade nicht'),
      });
    }
  });
  it('nicht übernommen (A3) → genau das, NICHT „antwortet gerade nicht“, obwohl es ein 502 ist', () => {
    expect(fehlerZustand(new NichtUebernommen('die Freigabe'))).toMatchObject({
      text: expect.stringContaining('nicht übernommen'),
      nochmal: true,
    });
  });
  it('anderer Fehler (z. B. fehlendes Recht) → die Meldung von ChurchTools', () => {
    expect(fehlerZustand(new ApiError(403, 'Keine ausreichende Berechtigung.'))).toMatchObject({
      text: 'Keine ausreichende Berechtigung.',
    });
  });
});

describe('Anlegen auf der Startseite (A3, #486)', () => {
  const START = {
    vorname: 'Alwin',
    gemeinde: null,
    gruppen: [
      { id: 9, name: 'Lobpreisteam', leitung: true },
      { id: 7, name: 'Technik', leitung: false },
    ],
  };
  it('„Neue Veranstaltung“ nur, wenn man in einem Team anlegen darf – und nur mit diesen Teams', async () => {
    laden.mockResolvedValue(START);
    ladenUebersicht.mockResolvedValue(LEER);
    anlegen.mockResolvedValue({ artId: 5, teamIds: [7] });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Neue Veranstaltung/ }));
    const auswahl = await screen.findByRole('combobox', { name: 'Gehört zur Gruppe' });
    expect([...auswahl.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Technik']);
    expect(anlegen).toHaveBeenCalledWith([9, 7]);
  });
  it('ohne Anlege-Recht kein Knopf; fehlt die Gruppenart, sagt die Seite es', async () => {
    laden.mockResolvedValue(START);
    ladenUebersicht.mockResolvedValue(LEER);
    anlegen.mockResolvedValue({ artId: null, teamIds: [] });
    render(<App />);
    expect(await screen.findByText(/fehlt die Gruppenart „Anmeldung“/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Neue Veranstaltung/ })).toBeNull();
  });
});

describe('Leiste „Rückgängig“ über den Seitenwechsel (A4-Nachtrag)', () => {
  beforeEach(() => anlegen.mockResolvedValue({ artId: 5, teamIds: [] }));

  it('archiviert → Übersicht mit „Rückgängig“; danach lädt sie neu und bietet es NICHT noch einmal an', async () => {
    window.location.hash = '#/v/91';
    laden.mockResolvedValue({ vorname: 'Alwin', gemeinde: null, gruppen: [] });
    ladenUebersicht.mockResolvedValue(LEER);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'archivieren' }));
    expect(await screen.findByText('„X“ ist im Archiv.')).toBeTruthy();
    expect(window.location.hash).toBe('');
    const vorher = laden.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(laden.mock.calls.length).toBeGreaterThan(vorher));
    expect(await screen.findByText('Rückgängig gemacht.')).toBeTruthy();
    expect(zurueckholen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });
});
