// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AuswahlFenster, type Option } from './OptionWaehlen';

afterEach(cleanup);

/**
 * **Das Auswahl-Fenster ersetzt das Blatt von unten** (Alwin, 20.11.2026: „alles mit Modalen machen und nicht mit Drawer“).
 * Es ist dasselbe `Sheet` wie jedes Fenster – Titel, ✕, die Einträge als Liste; kein Griff, kein Blatt.
 */
const optionen = (klick: () => void): Option[] => [
  { label: 'Matrix', gewaehlt: true, onClick: klick },
  { label: 'Termine', onClick: klick },
  { label: 'Teilen', trenner: true, onClick: klick },
  { label: 'Gesperrt', gesperrt: true, onClick: klick },
];

describe('AuswahlFenster', () => {
  it('ein Fenster mit Titel und den Einträgen als Liste; der gewählte ist ausgezeichnet, der gesperrte tot', () => {
    const klick = vi.fn();
    render(<AuswahlFenster titel="Ansicht" optionen={optionen(klick)} onClose={vi.fn()} />);
    const fenster = screen.getByRole('dialog', { name: 'Ansicht' });
    expect(fenster.getAttribute('aria-modal')).toBe('true');
    const namen = within(fenster)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(namen).toEqual(['', 'Matrix', 'Termine', 'Teilen', 'Gesperrt']); // vorn das ✕ (nur Symbol)
    expect(
      within(fenster).getByRole('button', { name: 'Matrix' }).getAttribute('aria-current'),
    ).toBe('true');
    expect(
      within(fenster).getByRole('button', { name: 'Termine' }).hasAttribute('aria-current'),
    ).toBe(false);
    expect(within(fenster).getByRole('button', { name: 'Teilen' }).className).toMatch(/trenner/);
    expect(within(fenster).getByRole('button', { name: 'Gesperrt' })).toHaveProperty(
      'disabled',
      true,
    );
    // Kein Blatt von unten mehr: kein Griff.
    expect(fenster.querySelector('[class*="griff"]')).toBeNull();
  });

  it('ein Tipp auf einen Eintrag ruft nur dessen Aktion – das Schließen bleibt beim Aufrufer', () => {
    const klick = vi.fn();
    const zu = vi.fn();
    render(<AuswahlFenster titel="Ansicht" optionen={optionen(klick)} onClose={zu} />);
    fireEvent.click(screen.getByRole('button', { name: 'Termine' }));
    expect(klick).toHaveBeenCalledTimes(1);
    expect(zu).not.toHaveBeenCalled();
  });

  it('✕, Escape und der Tipp neben das Fenster schließen – ohne eine Aktion auszulösen', () => {
    const klick = vi.fn();
    const zu = vi.fn();
    render(<AuswahlFenster titel="Ansicht" optionen={optionen(klick)} onClose={zu} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    expect(zu).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(zu).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('dialog').parentElement as Element);
    expect(zu).toHaveBeenCalledTimes(3);
    expect(klick).not.toHaveBeenCalled();
  });
});
