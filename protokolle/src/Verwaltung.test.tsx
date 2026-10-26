// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import type { GruppenEinstellung } from '@shared/protokolle/einrichten';
import * as E from './einrichten';
import { Verwaltung } from './Verwaltung';
import { fensterKnoepfe } from '@ui/fenster/fenster.testutil';

vi.mock('./einrichten', async (orig) => ({
  ...(await orig<typeof import('./einrichten')>()),
  ladeVerwaltung: vi.fn(),
  ladeGruppe: vi.fn(),
  gruppeEinrichten: vi.fn(),
}));
const m = vi.mocked(E);

const ROLLEN = [
  { id: 2126, name: 'Leiter', leitung: true },
  { id: 2123, name: 'Teilnehmer', leitung: false },
];
const EINSTELLUNG: GruppenEinstellung = {
  art: 'einstellung',
  fassung: 1,
  gruppe: 194,
  rollen: [
    { rolle: 2126, stufe: 'leitung' },
    { rolle: 2123, stufe: 'keine' },
  ],
  punkte: 'direkt',
  kalender: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.ladeVerwaltung.mockResolvedValue({
    darf: true,
    gruppen: [
      { id: 11, name: 'Leitungsteam', versteckt: true, eingerichtet: true },
      { id: 194, name: 'Technik', versteckt: false, eingerichtet: false },
    ],
    kalender: [{ id: 4, name: 'Gemeindeleitung' }],
  });
  m.ladeGruppe.mockResolvedValue({ rollen: ROLLEN, einstellung: null });
  m.gruppeEinrichten.mockResolvedValue(EINSTELLUNG);
});

const oeffnen = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  return screen.findByText(/Was darf welche Rolle/);
};
const auswahl = (rolle: string, stufe: string) =>
  screen.getByRole<HTMLInputElement>('radio', { name: `${rolle}: ${stufe}` });

describe('Verwaltung (S2-2)', () => {
  it('zeigt alle Gruppen mit Stand; versteckte sind markiert', async () => {
    render(<Verwaltung modul={24} />);
    const zeilen = within(await screen.findByRole('list'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(zeilen).toEqual(['Leitungsteamversteckteingerichtet', 'TechnikEinrichten']);
  });

  it('ohne Admin-Recht: ein Satz statt der Liste', async () => {
    m.ladeVerwaltung.mockResolvedValue({ darf: false, gruppen: [], kalender: [] });
    render(<Verwaltung modul={24} />);
    expect(await screen.findByText(/nur für Admins/)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('vorübergehender Fehler beim Laden: „Erneut versuchen“ lädt neu', async () => {
    m.ladeVerwaltung.mockRejectedValueOnce(new ApiError(503, 'weg'));
    render(<Verwaltung modul={24} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('list')).toBeTruthy();
  });
});

describe('Fenster „Gruppe einrichten“', () => {
  it('neue Gruppe: Vorschlag Leiter = Leitung, andere = Lesen; Einrichten schickt die Wahl', async () => {
    render(<Verwaltung modul={24} />);
    await oeffnen('Technik');
    expect(screen.getByText('Gruppe einrichten: Technik')).toBeTruthy();
    // Fenster wie ChurchTools (E6-O F5): „Einrichten“ unten rechts.
    expect(fensterKnoepfe()[0]).toBe('Fenster schließen');
    expect(fensterKnoepfe().slice(-2)).toEqual(['Abbrechen', 'Einrichten']);
    expect(auswahl('Leiter', 'Leitung').checked).toBe(true);
    expect(auswahl('Teilnehmer', 'Lesen + eigene To-Dos').checked).toBe(true);
    fireEvent.click(auswahl('Teilnehmer', 'Kein Zugriff'));
    fireEvent.change(screen.getByLabelText('Kalender für die Sitzungstermine'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Direkt eintragen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    await waitFor(() => expect(m.gruppeEinrichten).toHaveBeenCalledTimes(1));
    expect(m.gruppeEinrichten).toHaveBeenCalledWith(24, expect.objectContaining({ id: 194 }), {
      rollen: [
        { rolle: 2126, stufe: 'leitung' },
        { rolle: 2123, stufe: 'keine' },
      ],
      punkte: 'direkt',
      kalender: 4,
    });
    // fertig: Fenster zu, Hinweis, Liste neu geladen
    expect(await screen.findByText('Gruppe eingerichtet')).toBeTruthy();
    expect(screen.queryByText(/Was darf welche Rolle/)).toBeNull();
    expect(m.ladeVerwaltung).toHaveBeenCalledTimes(2);
  });

  it('eingerichtete Gruppe: zeigt die gespeicherte Wahl und heißt „Speichern“', async () => {
    m.ladeGruppe.mockResolvedValue({ rollen: ROLLEN, einstellung: EINSTELLUNG });
    render(<Verwaltung modul={24} />);
    await oeffnen('Leitungsteam');
    expect(screen.getByText('Gruppe: Leitungsteam')).toBeTruthy();
    expect(auswahl('Teilnehmer', 'Kein Zugriff').checked).toBe(true);
    expect(screen.getByLabelText<HTMLSelectElement>('Kalender für die Sitzungstermine').value).toBe(
      '4',
    );
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
    expect(screen.getByText(/in ChurchTools versteckt/)).toBeTruthy();
  });

  it('eingerichtete Gruppe heißt schon beim Laden „Gruppe: …“, nicht kurz „einrichten“', async () => {
    m.ladeGruppe.mockReturnValue(new Promise(() => undefined));
    render(<Verwaltung modul={24} />);
    fireEvent.click(await screen.findByRole('button', { name: /Leitungsteam/ }));
    expect(await screen.findByText('Gruppe: Leitungsteam')).toBeTruthy();
  });

  it('Kategorien da, Einstellung fehlt: sagt „unvollständig“ und bietet Einrichten an', async () => {
    render(<Verwaltung modul={24} />);
    await oeffnen('Leitungsteam');
    expect(screen.getByText(/Einrichtung ist unvollständig/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Einrichten' })).toBeTruthy();
  });

  it('Fehler beim Einrichten: Fenster bleibt offen und sagt warum; Knopf wieder frei', async () => {
    m.gruppeEinrichten.mockRejectedValue(new NichtUebernommen('die Rechte der Rollen'));
    render(<Verwaltung modul={24} />);
    await oeffnen('Technik');
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    expect(await screen.findByText(/die Rechte der Rollen nicht übernommen/)).toBeTruthy();
    expect(screen.getByText(/Was darf welche Rolle/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Einrichten' }).disabled).toBe(
      false,
    );
  });

  it('während des Einrichtens: Knopf gesperrt, Abbrechen schließt nicht', async () => {
    m.gruppeEinrichten.mockReturnValue(new Promise(() => undefined));
    render(<Verwaltung modul={24} />);
    await oeffnen('Technik');
    fireEvent.click(screen.getByRole('button', { name: 'Einrichten' }));
    const knopf = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Wird eingerichtet …',
    });
    expect(knopf.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByText(/Was darf welche Rolle/)).toBeTruthy();
  });
});
