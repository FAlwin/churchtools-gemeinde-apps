// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as E from './einrichten';
import * as G from './gemeinde';
import { GemeindeFenster } from './GemeindeFenster';
import { knopfFolge } from '@ui/fenster/fenster.testutil';

vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  stammdaten: vi.fn(),
}));
vi.mock('./gemeinde', () => ({
  gemeindeVorgaben: vi.fn(),
  gemeindeEinstellungen: vi.fn(),
  pruefeFormularSeite: vi.fn(),
  speichereGemeindeEinstellungen: vi.fn(),
}));
const ei = vi.mocked(E);
const gm = vi.mocked(G);

beforeEach(() => {
  ei.stammdaten.mockResolvedValue({
    status: [
      { id: 2, name: 'status.potential', nameTranslated: 'Interessent', isMember: false },
      { id: 3, name: 'status.member', nameTranslated: 'Mitglied', isMember: true },
    ],
    standorte: [
      { id: 0, name: 'Zentrale' },
      { id: 5, name: 'Nord' },
    ],
    bereiche: [{ id: 1, name: 'Gemeindeliste' }],
  });
  gm.gemeindeVorgaben.mockResolvedValue({ statusId: 2, departmentId: 1 });
  gm.gemeindeEinstellungen.mockResolvedValue({
    neuePersonen: null,
    formularAdresse: null,
    zahlarten: ['Überweisung', 'Bar', 'PayPal'],
  });
  gm.pruefeFormularSeite.mockResolvedValue({
    erreichbar: true,
    erlaubt: false,
    herkunft: 'https://anmeldung.beispiel.de',
  });
  gm.speichereGemeindeEinstellungen.mockResolvedValue();
});

describe('Einstellungen der Gemeinde (A6-2)', () => {
  it('Vorschlag vorbelegt; „Mitglied“ nicht wählbar; ohne Adresse und Standort kein Speichern', async () => {
    render(<GemeindeFenster onClose={() => {}} onGespeichert={() => {}} />);
    const status = await screen.findByLabelText<HTMLSelectElement>('Status');
    expect(status.value).toBe('2');
    expect([...status.options].map((o) => o.textContent)).toEqual([
      'Bitte wählen …',
      'Interessent',
    ]);
    expect(screen.getByText(/Noch nicht gespeichert – das ist der Vorschlag/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Standort'), { target: { value: '5' } });
    // Standort gewählt, aber noch keine Adresse.
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
  });

  it('Adresse: geprüft (antwortet, erlaubte Herkunft) – und normalisiert gespeichert', async () => {
    const gespeichert = vi.fn();
    render(<GemeindeFenster onClose={() => {}} onGespeichert={gespeichert} />);
    fireEvent.change(await screen.findByLabelText('Standort'), { target: { value: '0' } });
    const feld = screen.getByLabelText('Adresse des Anmeldeformulars');
    fireEvent.change(feld, { target: { value: 'http://kaputt' } });
    expect(screen.getByText(/https-Adresse/)).toBeTruthy();
    fireEvent.change(feld, { target: { value: 'anmeldung.beispiel.de' } });
    fireEvent.blur(feld);
    await waitFor(() =>
      expect(gm.pruefeFormularSeite).toHaveBeenCalledWith('https://anmeldung.beispiel.de/'),
    );
    expect(await screen.findByText(/Die Seite antwortet/)).toBeTruthy();
    expect(screen.getByText(/fehlt in ChurchTools bei den erlaubten Herkünften/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(gm.speichereGemeindeEinstellungen).toHaveBeenCalledWith({
        neuePersonen: { statusId: 2, campusId: 0, departmentId: 1 },
        formularAdresse: 'https://anmeldung.beispiel.de/',
        zahlarten: ['Überweisung', 'Bar', 'PayPal'],
      }),
    );
    expect(gespeichert).toHaveBeenCalled();
  });

  it('gespeicherte Adresse steht vorne drin', async () => {
    gm.gemeindeEinstellungen.mockResolvedValue({
      neuePersonen: { statusId: 2, campusId: 0, departmentId: 1 },
      formularAdresse: 'https://anmeldung.beispiel.de/',
      zahlarten: ['Bar'],
    });
    render(<GemeindeFenster onClose={() => {}} onGespeichert={() => {}} />);
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>('Adresse des Anmeldeformulars').value).toBe(
        'https://anmeldung.beispiel.de/',
      ),
    );
    expect(screen.queryByText(/das ist der Vorschlag/)).toBeNull();
  });

  it('Zahlarten (A7-2): hinzufügen, entfernen – die letzte bleibt', async () => {
    gm.gemeindeEinstellungen.mockResolvedValue({
      neuePersonen: { statusId: 2, campusId: 0, departmentId: 1 },
      formularAdresse: 'https://anmeldung.beispiel.de/',
      zahlarten: ['Überweisung', 'Bar'],
    });
    render(<GemeindeFenster onClose={() => {}} onGespeichert={() => {}} />);
    fireEvent.change(await screen.findByLabelText('Standort'), { target: { value: '0' } });
    const neu = await screen.findByLabelText('Neue Zahlart');
    fireEvent.change(neu, { target: { value: ' Kartenzahlung ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Überweisung entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bar entfernen' }));
    expect(screen.getByRole('button', { name: 'Kartenzahlung entfernen' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(gm.speichereGemeindeEinstellungen).toHaveBeenCalledWith(
        expect.objectContaining({ zahlarten: ['Kartenzahlung'] }),
      ),
    );
  });
});

/** Fenster wie ChurchTools (E6-O F4): X oben rechts, „Speichern“ unten rechts. */
describe('Einstellungen der Gemeinde im ChurchTools-Aufbau', () => {
  it('unten „Abbrechen · Speichern“', async () => {
    render(<GemeindeFenster onClose={() => {}} onGespeichert={() => {}} />);
    await screen.findByLabelText('Status');
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge().slice(-2)).toEqual(['Abbrechen', 'Speichern']);
  });
});
