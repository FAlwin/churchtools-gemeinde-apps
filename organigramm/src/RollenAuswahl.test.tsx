// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RollenAuswahl } from './RollenAuswahl';

afterEach(cleanup);

const ROLLEN = [
  { name: 'Leiter', leitung: true },
  { name: 'Co-Leiter', leitung: true },
  { name: 'Mitarbeiter', leitung: false },
];

function zeigen(rollen = ROLLEN, aus = new Set<string>()) {
  const onAus = vi.fn();
  render(<RollenAuswahl rollen={rollen} aus={aus} onAus={onAus} feldKlasse="" />);
  return { onAus };
}

describe('RollenAuswahl (#915)', () => {
  it('ein Häkchen je Rolle; abwählen meldet die abgewählten Namen, das Menü bleibt offen', () => {
    const { onAus } = zeigen(ROLLEN, new Set(['Mitarbeiter']));
    fireEvent.click(screen.getByRole('button', { name: 'Welche Rollen: 2 von 3' }));
    expect(screen.getAllByRole('checkbox').map((c) => (c as HTMLInputElement).checked)).toEqual([
      true,
      true,
      false,
    ]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Co-Leiter' }));
    expect(onAus).toHaveBeenLastCalledWith(new Set(['Mitarbeiter', 'Co-Leiter']));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mitarbeiter' }));
    expect(onAus).toHaveBeenLastCalledWith(new Set());
    expect(screen.getByRole('group', { name: 'Welche Rollen' })).toBeTruthy();
  });

  it('„Alle“ und „Nur Leitung“ – ohne Leitungsrolle gibt es „Nur Leitung“ nicht', () => {
    const { onAus } = zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Welche Rollen: Alle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nur Leitung' }));
    expect(onAus).toHaveBeenLastCalledWith(new Set(['Mitarbeiter']));
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(onAus).toHaveBeenLastCalledWith(new Set());
    cleanup();
    zeigen([{ name: 'Teilnehmer', leitung: false }]);
    fireEvent.click(screen.getByRole('button', { name: 'Welche Rollen: Alle' }));
    expect(screen.queryByRole('button', { name: 'Nur Leitung' })).toBeNull();
  });

  it('solange keine Mitglieder da sind, sagt das Menü es, statt leer zu sein', () => {
    zeigen([]);
    fireEvent.click(screen.getByRole('button', { name: 'Welche Rollen: Alle' }));
    expect(screen.getByText('Noch keine Rollen geladen')).toBeTruthy();
  });

  it('am Handy rückt das Menü nach links, statt rechts hinauszuragen (wie „Anfangen bei“)', () => {
    const rechteck = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 200, width: 240 } as DOMRect);
    const breite = vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(375);
    try {
      zeigen();
      fireEvent.click(screen.getByRole('button', { name: 'Welche Rollen: Alle' }));
      expect(screen.getByRole('group', { name: 'Welche Rollen' }).style.left).toBe('-81px'); // 200 + 240 − (375 − 16)
    } finally {
      rechteck.mockRestore();
      breite.mockRestore();
    }
  });
});
