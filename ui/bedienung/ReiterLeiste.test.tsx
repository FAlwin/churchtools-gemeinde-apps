// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('oben (Musik-App am iPad, Scheibe S): Textreiter ohne Symbole, gleiche Bedienung', () => {
    const onWechsel = vi.fn();
    const { container } = render(
      <ReiterLeiste reiter={REITER} aktiv="a" onWechsel={onWechsel} oben />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('nav')?.className).toMatch(/oben/);
    fireEvent.click(screen.getByRole('button', { name: 'Zwei' }));
    expect(onWechsel).toHaveBeenCalledWith('b');
  });

  it('Anzahl hinter dem Text (U2-1); eigener Name für eine zweite Leiste, sonst „Bereiche“', () => {
    render(
      <ReiterLeiste
        reiter={[
          { ...REITER[0], zahl: 3 },
          { ...REITER[1], zahl: 0 },
        ]}
        aktiv="a"
        onWechsel={vi.fn()}
        oben
        name="Ansichten"
      />,
    );
    expect(screen.getByRole('button', { name: 'Eins 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zwei 0' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Ansichten' })).toBeTruthy();
    cleanup();
    render(<ReiterLeiste reiter={REITER} aktiv="a" onWechsel={vi.fn()} oben />);
    expect(screen.getByRole('navigation', { name: 'Bereiche' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Eins' })).toBeTruthy();
  });

  it('unten zeigt jeder Reiter sein Symbol', () => {
    const { container } = render(<ReiterLeiste reiter={REITER} aktiv="a" onWechsel={vi.fn()} />);
    expect(container.querySelectorAll('svg')).toHaveLength(REITER.length);
  });
});
