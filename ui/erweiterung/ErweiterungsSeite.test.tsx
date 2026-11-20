// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ErweiterungsSeite, type Bereiche } from './ErweiterungsSeite';

/**
 * **Die Reiter der Erweiterungen kommen aus EINER Stelle** (R4/E4/R7, „Ruhige Bedienung“ B2): am Rechner unterstrichen
 * unter dem App-Namen, die Lupe rechts daneben; am Handy unten in der Leiste, die Lupe neben dem App-Namen.
 */
afterEach(cleanup);

type Id = 'start' | 'planen';
const zustand = { art: 'fertig', vorname: 'Alwin', gemeinde: null } as const;
const bereiche = (onWechsel: (id: Id) => void = () => {}): Bereiche<Id> => ({
  reiter: [
    { id: 'start', label: 'Start', icon: 'home' },
    { id: 'planen', label: 'Planen', icon: 'calendar' },
  ],
  aktiv: 'start',
  onWechsel,
});
const lupe = <button type="button">Lupe</button>;

describe('ErweiterungsSeite: Bereiche und Lupe', () => {
  it('Rechner: Reiter im Kopf, unterstrichen (kein Umschalter), Lupe in derselben Zeile rechts', () => {
    const wechsel = vi.fn();
    render(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={bereiche(wechsel)}
        lupe={lupe}
        onNochmal={() => {}}
      >
        <p>Inhalt</p>
      </ErweiterungsSeite>,
    );
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    expect(nav.closest('header')).not.toBeNull();
    expect(screen.queryByRole('group', { name: 'Bereiche' })).toBeNull();
    // Die Lupe steht im selben Elternelement wie die Leiste (der Reiterzeile), nach ihr.
    expect(nav.parentElement).toBe(screen.getByRole('button', { name: 'Lupe' }).parentElement);
    expect(nav.nextElementSibling).toBe(screen.getByRole('button', { name: 'Lupe' }));
    fireEvent.click(within(nav).getByRole('button', { name: 'Planen' }));
    expect(wechsel).toHaveBeenCalledWith('planen');
  });

  it('Handy: Leiste unten (nicht im Kopf), Lupe neben dem App-Namen', () => {
    render(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={bereiche()}
        handy
        lupe={lupe}
        onNochmal={() => {}}
      >
        <p>Inhalt</p>
      </ErweiterungsSeite>,
    );
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    expect(nav.closest('header')).toBeNull();
    expect(nav.closest('main')).toBeNull();
    const knopf = screen.getByRole('button', { name: 'Lupe' });
    expect(knopf.closest('header')).not.toBeNull();
    expect(knopf.parentElement?.contains(screen.getByText('Test'))).toBe(true);
  });

  it('ohne Reiter: Lupe neben dem App-Namen, keine Leiste', () => {
    render(<ErweiterungsSeite zustand={zustand} app="Test" lupe={lupe} onNochmal={() => {}} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Lupe' })
        .parentElement?.contains(screen.getByText('Test')),
    ).toBe(true);
  });
});
