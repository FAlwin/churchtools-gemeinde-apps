// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReiterLeiste } from './ReiterLeiste';

const REITER = [
  { id: 'a', label: 'Eins', icon: 'home' as const },
  { id: 'b', label: 'Zwei', icon: 'calendar' as const },
];

describe('ReiterLeiste', () => {
  it('Tipp auf einen anderen Reiter wechselt, auf den aktiven ruft „erneut“', () => {
    const onWechsel = vi.fn();
    const onErneut = vi.fn();
    render(<ReiterLeiste reiter={REITER} aktiv="a" onWechsel={onWechsel} onErneut={onErneut} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zwei' }));
    expect(onWechsel).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Eins' }));
    expect(onErneut).toHaveBeenCalledTimes(1);
    expect(onWechsel).toHaveBeenCalledTimes(1);
  });

  it('der aktive Reiter ist für Screenreader gedrückt; ein gedimmter bleibt tippbar', () => {
    const onWechsel = vi.fn();
    render(<ReiterLeiste reiter={REITER} aktiv="a" gedimmt={['b']} onWechsel={onWechsel} />);
    expect(screen.getByRole('button', { name: 'Eins' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Zwei' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Zwei' }));
    expect(onWechsel).toHaveBeenCalledWith('b');
  });
});
