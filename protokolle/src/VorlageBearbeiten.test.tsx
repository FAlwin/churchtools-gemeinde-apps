// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NichtUebernommen } from '@ui/ct/fehler';
import { STANDARD_VORLAGEN } from '@shared/protokolle/vorlagen';
import * as V from './vorlagen';
import { VorlagenKarte } from './VorlagenKarte';
import { fensterKnoepfe } from '@ui/fenster/fenster.testutil';

vi.mock('./vorlagen', async (orig) => ({
  ...(await orig<typeof import('./vorlagen')>()),
  ladeVorlagen: vi.fn(),
  vorlageSpeichern: vi.fn(),
  vorlageLoeschen: vi.fn(),
}));
const m = vi.mocked(V);

const GESPEICHERT = STANDARD_VORLAGEN.map((vorlage, i) => ({ wert: 500 + i, vorlage }));
const hinweis = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  m.ladeVorlagen.mockResolvedValue({ kategorie: 5, vorlagen: GESPEICHERT });
  m.vorlageSpeichern.mockImplementation((_m, _f, _v) => Promise.resolve(STANDARD_VORLAGEN[0]));
  m.vorlageLoeschen.mockResolvedValue(undefined);
});

const oeffnen = async (name: string) => {
  render(<VorlagenKarte modul={24} onHinweis={hinweis} />);
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  return screen.findByText('Tagesordnungspunkte');
};
const feld = (name: string) => screen.getByRole<HTMLInputElement>('textbox', { name });

describe('Karte „Vorlagen“ (S2-3)', () => {
  it('zeigt jede Vorlage mit Umfang und Punkten', async () => {
    render(<VorlagenKarte modul={24} onHinweis={hinweis} />);
    const zeilen = within(await screen.findByRole('list'))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(zeilen[0]).toBe(
      'Leitungssitzung5 Punkte · 1 feste Aufgabe · Andacht & Gebet · Protokoll der letzten Sitzung · Offene To-Dos · Termine & Gemeindeleben · Verschiedenes',
    );
  });

  it('noch keine Vorlagen: ein Satz statt einer leeren Liste', async () => {
    m.ladeVorlagen.mockResolvedValue({ kategorie: null, vorlagen: [] });
    render(<VorlagenKarte modul={24} onHinweis={hinweis} />);
    expect(await screen.findByText(/Noch keine Vorlagen/)).toBeTruthy();
  });
});

describe('Fenster „Vorlage“', () => {
  it('neu: beginnt mit „Gebet“ und „Offene To-Dos“; ohne Namen wird nichts gespeichert', async () => {
    await oeffnen('Neue Vorlage');
    // Fenster wie ChurchTools (E6-O F5): „Speichern“ unten rechts.
    expect(fensterKnoepfe()[0]).toBe('Fenster schließen');
    expect(fensterKnoepfe().slice(-2)).toEqual(['Abbrechen', 'Speichern']);
    expect(feld('Punkt 1').value).toBe('Gebet');
    expect(feld('Punkt 2').value).toBe('Offene To-Dos');
    expect(screen.getByText(/Füllt sich selbst mit den offenen To-Dos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Die Vorlage braucht einen Namen.')).toBeTruthy();
    expect(m.vorlageSpeichern).not.toHaveBeenCalled();
  });

  it('bearbeiten: Reihenfolge, neue Aufgabe und Text gehen genau so an das Speichern', async () => {
    await oeffnen('Teamtreffen');
    fireEvent.click(screen.getAllByRole('button', { name: 'Nach oben' })[3]); // „Gebet“ vor „Planung …“
    fireEvent.click(screen.getByRole('button', { name: 'Aufgabe' }));
    fireEvent.change(feld('Aufgabe 1'), { target: { value: 'Getränke besorgen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(m.vorlageSpeichern).toHaveBeenCalledTimes(1));
    const [, formular, vorhanden] = m.vorlageSpeichern.mock.calls[0];
    expect(formular.punkte.map((p) => p.titel)).toEqual([
      'Rückblick',
      'Offene To-Dos',
      'Gebet',
      'Planung der nächsten Wochen',
    ]);
    expect(formular.aufgaben).toEqual(['Getränke besorgen']);
    expect(vorhanden).toBe(GESPEICHERT[1]); // Teamtreffen
    await waitFor(() => expect(hinweis).toHaveBeenCalledWith('Vorlage gespeichert'));
  });

  it('während des Speicherns: X und „Abbrechen“ gesperrt (E6-O F5)', async () => {
    m.vorlageSpeichern.mockReturnValue(new Promise(() => {}));
    await oeffnen('Klausur');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByRole('button', { name: 'Wird gespeichert …' })).toBeTruthy();
    for (const name of ['Fenster schließen', 'Abbrechen'])
      expect(screen.getByRole('button', { name })).toHaveProperty('disabled', true);
  });

  it('Speichern scheitert: Fenster bleibt offen und sagt warum', async () => {
    m.vorlageSpeichern.mockRejectedValue(new NichtUebernommen('die Vorlage'));
    await oeffnen('Klausur');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText(/die Vorlage nicht übernommen/)).toBeTruthy();
    expect(screen.getByText('Tagesordnungspunkte')).toBeTruthy();
    expect(hinweis).not.toHaveBeenCalled();
  });

  it('löschen fragt erst; „Abbrechen“ löscht nichts, „Löschen“ schon', async () => {
    await oeffnen('Klausur');
    // „Vorlage löschen“ bleibt im Inhalt, getrennt vom Speichern unten (wie „Löschen …“ in der Musik-App).
    expect(fensterKnoepfe().slice(-3)).toEqual(['Vorlage löschen', 'Abbrechen', 'Speichern']);
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage löschen' }));
    expect(screen.getByText('Vorlage löschen?')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Abbrechen' })[0]);
    expect(m.vorlageLoeschen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    // GESPEICHERT[2] = Klausur
    await waitFor(() => expect(m.vorlageLoeschen).toHaveBeenCalledWith(24, GESPEICHERT[2]));
    await waitFor(() => expect(hinweis).toHaveBeenCalledWith('Vorlage gelöscht'));
  });
});
