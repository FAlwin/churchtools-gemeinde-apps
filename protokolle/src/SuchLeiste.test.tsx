// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SuchLeiste } from './SuchLeiste';

const knoepfe = () => ({ onOeffnen: vi.fn(), onBegriff: vi.fn(), onSchliessen: vi.fn() });

describe('SuchLeiste (S3-4b)', () => {
  it('zu: nur die Lupe – ein Tipp öffnet', () => {
    const k = knoepfe();
    render(<SuchLeiste offen={false} begriff="" {...k} />);
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(k.onOeffnen).toHaveBeenCalledTimes(1);
  });

  it('offen: das Feld hat den Fokus, Tippen meldet den Begriff', () => {
    const k = knoepfe();
    render(<SuchLeiste offen begriff="bea" {...k} />);
    const feld = screen.getByRole('searchbox', { name: 'Suchbegriff' });
    expect(document.activeElement).toBe(feld);
    fireEvent.change(feld, { target: { value: 'beamer' } });
    expect(k.onBegriff).toHaveBeenCalledWith('beamer');
  });

  it('✕ und Esc schließen', () => {
    const k = knoepfe();
    render(<SuchLeiste offen begriff="x" {...k} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suche schließen' }));
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(k.onSchliessen).toHaveBeenCalledTimes(2);
  });
});
