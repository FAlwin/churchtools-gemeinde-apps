// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { STANDARD, type Vorliebe } from '@shared/dienstplan/vorlieben';
import type { EntwurfAnschluss } from './ladeEntwuerfe';
import { VorliebenFach } from './VorliebenFach';

afterEach(cleanup);

const BEN = { id: 49, name: 'Ben Test' };
const TECHNIK = { id: 3, name: 'Technik' };

function zeige(v: Partial<EntwurfAnschluss['vorlieben']> = {}) {
  const vorlieben: EntwurfAnschluss['vorlieben'] = {
    lesen: vi.fn(() => Promise.resolve({ ok: true as const, vorliebe: STANDARD })),
    speichern: vi.fn(() => Promise.resolve({ ok: true as const })),
    ...v,
  };
  const onClose = vi.fn();
  render(<VorliebenFach person={BEN} gruppe={TECHNIK} vorlieben={vorlieben} onClose={onClose} />);
  return { vorlieben, onClose };
}
const feld = (name: string) => screen.getByRole<HTMLSelectElement>('combobox', { name });

describe('VorliebenFach (E5-3)', () => {
  it('zeigt die gespeicherten Werte der Person für diese Gruppe; Speichern erst nach einer Änderung', async () => {
    const gespeichert: Vorliebe = { hoechstens: 2, beziehung: 1, tageszeit: 4 };
    const { vorlieben } = zeige({
      lesen: vi.fn(() => Promise.resolve({ ok: true as const, vorliebe: gespeichert })),
    });
    await screen.findByRole('combobox', { name: 'Wie oft höchstens?' });
    expect(vorlieben.lesen).toHaveBeenCalledWith(3, 49);
    expect(screen.getByText('Vorlieben · Ben Test')).toBeTruthy();
    expect(screen.getByText('für Technik · wie der Stift in ChurchTools')).toBeTruthy();
    expect(feld('Wie oft höchstens?').selectedOptions[0].textContent).toBe('2× pro Monat');
    expect(feld('Mit Ehepartner').selectedOptions[0].textContent).toBe('bevorzugt zusammen');
    expect(feld('Tageszeit').selectedOptions[0].textContent).toBe('nur abends');
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
  });

  it('Speichern schreibt genau die gewählten Werte und schließt mit „gespeichert“', async () => {
    const { vorlieben, onClose } = zeige();
    await screen.findByRole('combobox', { name: 'Wie oft höchstens?' });
    fireEvent.change(feld('Wie oft höchstens?'), { target: { value: '1' } });
    fireEvent.change(feld('Tageszeit'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(vorlieben.speichern).toHaveBeenCalledWith(3, 49, {
      hoechstens: 1,
      beziehung: 0,
      tageszeit: 3,
    });
  });

  it('stille Ablehnung (kein Recht): Text steht da, Eingabe bleibt, Fenster bleibt offen', async () => {
    const { onClose } = zeige({
      speichern: vi.fn(() => Promise.resolve({ ok: false as const, grund: 'kein-recht' as const })),
    });
    await screen.findByRole('combobox', { name: 'Wie oft höchstens?' });
    fireEvent.change(feld('Wie oft höchstens?'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await screen.findByText(/dir fehlt das Recht, diese Dienstgruppe zu bearbeiten/);
    expect(feld('Wie oft höchstens?').value).toBe('0');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Lesen scheitert vorübergehend → „Erneut versuchen“ lädt neu; Abbrechen schließt ohne Speichern', async () => {
    const lesen = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, grund: 'voruebergehend' })
      .mockResolvedValue({ ok: true, vorliebe: STANDARD });
    const { onClose, vorlieben } = zeige({ lesen });
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByRole('combobox', { name: 'Wie oft höchstens?' });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(vorlieben.speichern).not.toHaveBeenCalled();
  });

  it('während des Speicherns: nicht schließen', async () => {
    const { onClose } = zeige({ speichern: () => new Promise<never>(() => {}) });
    await screen.findByRole('combobox', { name: 'Wie oft höchstens?' });
    fireEvent.change(feld('Tageszeit'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    // Gesperrt wie im ConfirmDialog (E6-O F2, #720): X und Abbrechen tun nichts, solange es läuft.
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

/** Fenster wie ChurchTools (E6-O F2, #720): X oben rechts, die Knöpfe unten rechts – der Hauptknopf zuletzt. */
const knopfFolge = () =>
  screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

describe('VorliebenFach im ChurchTools-Aufbau', () => {
  it('X oben, unten Abbrechen und Speichern', async () => {
    zeige();
    await screen.findByRole('combobox', { name: 'Wie oft höchstens?' });
    expect(screen.getByRole('dialog', { name: 'Vorlieben · Ben Test' })).toBeTruthy();
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge().slice(-2)).toEqual(['Abbrechen', 'Speichern']);
  });
});
