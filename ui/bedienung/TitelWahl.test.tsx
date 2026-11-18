// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TitelWahl } from './TitelWahl';

/** Gruppenwahl als Überschrift (Protokolle „Sitzungen“, Organigramm „Kinder & Jugend“, 18.11.2026). */

const OPTIONEN = [
  { wert: '1', text: 'Bildtechnik' },
  { wert: '2', text: 'Festplanung' },
  { wert: '3', text: 'Leitungsteam' },
];

const zeigen = (wert = '1', onWahl: (w: string) => void = () => {}) =>
  render(<TitelWahl optionen={OPTIONEN} wert={wert} onWahl={onWahl} />);

afterEach(cleanup);

describe('TitelWahl', () => {
  it('ist eine Überschrift mit dem Namen der Gruppe, darin der Knopf – zu, bis man tippt', () => {
    zeigen();
    const knopf = screen.getByRole('button', { name: 'Gruppe wählen: Bildtechnik' });
    expect(knopf.closest('h2')).not.toBeNull();
    expect(knopf.getAttribute('aria-expanded')).toBe('false');
    expect(knopf.getAttribute('aria-haspopup')).toBe('listbox');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Tippen klappt alle Gruppen auf, die aktuelle trägt aria-selected', () => {
    zeigen('2');
    const knopf = screen.getByRole('button', { name: 'Gruppe wählen: Festplanung' });
    fireEvent.click(knopf);
    expect(knopf.getAttribute('aria-expanded')).toBe('true');
    expect(knopf.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
    const optionen = screen.getAllByRole('option');
    expect(optionen.map((o) => o.textContent)).toEqual([
      'Bildtechnik',
      'Festplanung',
      'Leitungsteam',
    ]);
    expect(optionen.map((o) => o.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('eine Wahl meldet den Wert und schließt die Liste', () => {
    const onWahl = vi.fn();
    zeigen('1', onWahl);
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe wählen: Bildtechnik' }));
    fireEvent.click(screen.getByRole('option', { name: 'Leitungsteam' }));
    expect(onWahl).toHaveBeenCalledExactlyOnceWith('3');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('die schon gewählte Gruppe zu tippen schließt nur, ohne etwas zu melden', () => {
    const onWahl = vi.fn();
    zeigen('1', onWahl);
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe wählen: Bildtechnik' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bildtechnik' }));
    expect(onWahl).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Escape schließt, ein Tipp daneben auch', () => {
    zeigen();
    const knopf = screen.getByRole('button', { name: 'Gruppe wählen: Bildtechnik' });
    fireEvent.click(knopf);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(knopf);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('nur eine Möglichkeit: einfache Überschrift, kein Knopf', () => {
    render(<TitelWahl optionen={[OPTIONEN[0]]} wert="1" onWahl={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Bildtechnik' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
