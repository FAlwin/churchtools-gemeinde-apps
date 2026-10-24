// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Die Bestätigung im ChurchTools-Aufbau (E6-O F1, #716): X oben, unten Abbrechen vor der Bestätigung. Der zweite Weg
 * (E6-5b, geteilter Ablauf) kommt nur, wenn man ihn reicht.
 */
afterEach(cleanup);

const grund = { title: 'Löschen?', message: 'Weg damit?', confirmLabel: 'Löschen' };
const knopfTexte = () =>
  screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);

describe('ConfirmDialog', () => {
  it('ohne Zusätze: X, dann Abbrechen und Bestätigen; X und Abbrechen brechen ab', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...grund} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('alertdialog', { name: 'Löschen?' })).toBeTruthy();
    expect(knopfTexte()).toEqual(['Schließen', 'Abbrechen', 'Löschen']);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('mit zweitem Weg: Abbrechen, zweiter Weg, Bestätigen – samt Inhalt und Fußtext', () => {
    const zweit = vi.fn();
    render(
      <ConfirmDialog
        {...grund}
        zweit={{ label: 'Nur hier', onClick: zweit }}
        fuss="Klein gedruckt"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      >
        <p>Die Liste</p>
      </ConfirmDialog>,
    );
    expect(knopfTexte()).toEqual(['Schließen', 'Abbrechen', 'Nur hier', 'Löschen']);
    expect(screen.getByText('Die Liste')).toBeTruthy();
    expect(screen.getByText('Klein gedruckt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nur hier' }));
    expect(zweit).toHaveBeenCalled();
  });

  it('`cancelLabel={null}` ohne Abbrechen und ohne X; `beschaeftigt` sperrt alles, auch X und Wegklicken', () => {
    const onCancel = vi.fn();
    const { container, rerender } = render(
      <ConfirmDialog {...grund} cancelLabel={null} onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    expect(knopfTexte()).toEqual(['Löschen']);

    rerender(<ConfirmDialog {...grund} beschaeftigt onConfirm={vi.fn()} onCancel={onCancel} />);
    expect(screen.getAllByRole('button').every((b) => (b as HTMLButtonElement).disabled)).toBe(
      true,
    );
    fireEvent.click(container.firstElementChild as Element);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
