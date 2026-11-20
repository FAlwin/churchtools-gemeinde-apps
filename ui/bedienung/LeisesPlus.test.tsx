// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LeisesPlus } from './LeisesPlus';

afterEach(cleanup);

/** **Das leise „+“ mitten im Inhalt** (R10, B8): die zweite Art von „+“ – gestrichelt und grau, nie gefüllt. */
describe('LeisesPlus', () => {
  it('ist ein Knopf mit Wort und „+“; Antippen legt an', () => {
    const onClick = vi.fn();
    render(<LeisesPlus label="Ablauf anlegen" onClick={onClick} dataTour="x" />);
    const knopf = screen.getByRole('button', { name: 'Ablauf anlegen' });
    expect(knopf.querySelector('svg')).not.toBeNull();
    expect(knopf.getAttribute('data-tour')).toBe('x');
    fireEvent.click(knopf);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('gesperrt: nicht tippbar', () => {
    const onClick = vi.fn();
    render(<LeisesPlus label="Ablauf anlegen" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
