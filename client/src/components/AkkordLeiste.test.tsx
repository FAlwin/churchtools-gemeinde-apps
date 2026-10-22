// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within, act } from '@testing-library/react';
import { AkkordLeiste } from './AkkordLeiste';
import { tonartAkkorde } from '../utils/transpose';

/** Lied-Editor L5 (22.10.2026, Entwurf Variante A): Akkord-Leiste statt Menü. */
const TEXT = '{key: E}\n{comment: Vers}\n[E]Du [F#m7]bleibst [A]an [F#m7]meiner [D/F#]Seite';

function zeige(props: Partial<Parameters<typeof AkkordLeiste>[0]> = {}) {
  const waehlen = vi.fn();
  const anderer = vi.fn();
  render(
    <AkkordLeiste
      tonart="E"
      text={TEXT}
      zuletzt={[]}
      waehlen={waehlen}
      anderer={anderer}
      {...props}
    />,
  );
  return { waehlen, anderer };
}
const knoepfe = (gruppe: HTMLElement) =>
  within(gruppe)
    .getAllByRole('button')
    .map((b) => b.textContent);

afterEach(() => vi.useRealTimers());

describe('AkkordLeiste', () => {
  it('vorne die Akkorde der Tonart – dieselbe Regel wie tonartAkkorde', () => {
    zeige();
    const tonart = screen.getByText('Tonart E').parentElement!;
    expect(knoepfe(tonart)).toEqual(tonartAkkorde('E'));
  });

  it('„Im Lied“: was sonst im Text steht, häufigste zuerst, ohne die der Tonart', () => {
    zeige();
    expect(knoepfe(screen.getByText('Im Lied').parentElement!)).toEqual(['F#m7', 'D/F#']);
  });

  it('eben Gesetztes steht in „Im Lied“ vorne', () => {
    zeige({ zuletzt: ['Gsus4', 'A'] });
    expect(knoepfe(screen.getByText('Im Lied').parentElement!)).toEqual(['Gsus4', 'F#m7', 'D/F#']);
  });

  it('ohne Tonart keine Tonart-Gruppe – „Anderer Akkord“ bleibt', () => {
    zeige({ tonart: undefined });
    expect(screen.queryByText(/^Tonart/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Anderer Akkord' })).toBeTruthy();
  });

  it('Antippen setzt den Akkord; „Anderer Akkord“ öffnet das Fenster', () => {
    const { waehlen, anderer } = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(waehlen).toHaveBeenCalledWith('A');
    fireEvent.click(screen.getByRole('button', { name: 'Anderer Akkord' }));
    expect(anderer).toHaveBeenCalled();
  });

  it('Gedrückt halten zeigt die Varianten des Grundtons – der Klick danach setzt nichts', () => {
    vi.useFakeTimers();
    const { waehlen } = zeige();
    const e = screen.getByRole('button', { name: 'E' });
    fireEvent.pointerDown(e);
    act(() => void vi.advanceTimersByTime(500));
    fireEvent.pointerUp(e);
    fireEvent.click(e);
    expect(waehlen).not.toHaveBeenCalled();
    const varianten = screen.getByRole('group', { name: 'Varianten von E' });
    fireEvent.click(within(varianten).getByRole('button', { name: 'Em7' }));
    expect(waehlen).toHaveBeenCalledWith('Em7');
    expect(screen.queryByRole('group', { name: 'Varianten von E' })).toBeNull();
  });

  it('kurz tippen zeigt keine Varianten', () => {
    vi.useFakeTimers();
    const { waehlen } = zeige();
    const e = screen.getByRole('button', { name: 'E' });
    fireEvent.pointerDown(e);
    act(() => void vi.advanceTimersByTime(200));
    fireEvent.pointerUp(e);
    act(() => void vi.advanceTimersByTime(1000));
    fireEvent.click(e);
    expect(waehlen).toHaveBeenCalledWith('E');
    expect(screen.queryByRole('group', { name: /Varianten/ })).toBeNull();
  });
});
