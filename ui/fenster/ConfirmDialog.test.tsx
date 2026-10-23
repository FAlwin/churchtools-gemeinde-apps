// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

/** Die Bestätigung bleibt wie gehabt; der zweite Weg (E6-5b, geteilter Ablauf) kommt nur, wenn man ihn reicht. */
afterEach(cleanup);

const grund = { title: 'Löschen?', message: 'Weg damit?', confirmLabel: 'Löschen' };

describe('ConfirmDialog', () => {
  it('ohne Zusätze: Abbrechen und Bestätigen nebeneinander, in dieser Reihenfolge', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...grund} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Abbrechen',
      'Löschen',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('mit zweitem Weg: untereinander Bestätigen, zweiter Weg, Abbrechen – samt Inhalt und Fußtext', () => {
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
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Löschen',
      'Nur hier',
      'Abbrechen',
    ]);
    expect(screen.getByText('Die Liste')).toBeTruthy();
    expect(screen.getByText('Klein gedruckt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nur hier' }));
    expect(zweit).toHaveBeenCalled();
  });

  it('`cancelLabel={null}` ohne Abbrechen; `beschaeftigt` sperrt alles, auch das Wegklicken', () => {
    const onCancel = vi.fn();
    const { container, rerender } = render(
      <ConfirmDialog {...grund} cancelLabel={null} onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Löschen']);

    rerender(<ConfirmDialog {...grund} beschaeftigt onConfirm={vi.fn()} onCancel={onCancel} />);
    expect(screen.getAllByRole('button').every((b) => (b as HTMLButtonElement).disabled)).toBe(
      true,
    );
    fireEvent.click(container.firstElementChild as Element);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
