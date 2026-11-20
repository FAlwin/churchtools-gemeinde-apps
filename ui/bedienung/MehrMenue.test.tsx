// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MehrMenue } from './MehrMenue';
import { Icon } from '../icons/icons';

afterEach(cleanup);

/**
 * Wie Planen: jeder Eintrag öffnet etwas, das dem Menü nicht gehört (Fenster-Zustand der Seite). Läuft die Aktion vor dem
 * Schließen, bleibt sie bestehen – kehrte das Schließen sie um, bliebe das Fenster zu (Lehre 05.08.2026).
 */
function Seite({ handy }: { handy: boolean }) {
  const [fenster, setFenster] = useState<string | null>(null);
  const zu = vi.fn();
  return (
    <>
      <MehrMenue
        handy={handy}
        optionen={[
          {
            label: 'Ablauf bearbeiten',
            symbol: <Icon name="pencil" />,
            onClick: () => setFenster('A'),
          },
          { label: 'Erinnern', symbol: <Icon name="brief" />, onClick: () => setFenster('E') },
          {
            label: 'Teilen',
            symbol: <Icon name="share" />,
            onClick: () => setFenster('T'),
            trenner: true,
          },
          { label: 'Gesperrt', gesperrt: true, onClick: zu },
        ]}
      />
      <output>{fenster ?? 'nichts'}</output>
    </>
  );
}
const ausgabe = () => screen.getByRole('status').textContent;

describe('MehrMenue (R6/E3, B3)', () => {
  it('ohne Einträge gibt es auch den Knopf nicht', () => {
    render(<MehrMenue handy={false} optionen={[]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  describe.each([
    ['Rechner', false, 'menu', 'menuitem'],
    ['Handy', true, 'dialog', 'button'],
  ] as const)('%s', (_n, handy, menueRolle, eintragRolle) => {
    it('der Knopf ist still, trägt den Namen „Mehr“ und öffnet erst beim Tipp', () => {
      render(<Seite handy={handy} />);
      expect(screen.queryByRole(menueRolle, { name: 'Mehr' })).toBeNull();
      const knopf = screen.getByRole('button', { name: 'Mehr' });
      expect(knopf.getAttribute('aria-haspopup')).toBe('menu');
      fireEvent.click(knopf);
      expect(screen.getByRole(menueRolle, { name: 'Mehr' })).toBeTruthy();
    });

    it.each([
      ['Ablauf bearbeiten', 'A'],
      ['Erinnern', 'E'],
      ['Teilen', 'T'],
    ])('„%s“ läuft und bleibt – das Menü geht dabei zu', (name, erwartet) => {
      render(<Seite handy={handy} />);
      fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
      const menue = screen.getByRole(menueRolle, { name: 'Mehr' });
      fireEvent.click(within(menue).getByRole(eintragRolle, { name }));
      expect(ausgabe()).toBe(erwartet);
      expect(screen.queryByRole(menueRolle, { name: 'Mehr' })).toBeNull();
    });

    it('ein gesperrter Eintrag tut nichts; jeder Eintrag zeigt sein Symbol', () => {
      render(<Seite handy={handy} />);
      fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
      const menue = screen.getByRole(menueRolle, { name: 'Mehr' });
      const gesperrt = within(menue).getByRole<HTMLButtonElement>(eintragRolle, {
        name: 'Gesperrt',
      });
      expect(gesperrt.disabled).toBe(true);
      expect(
        within(menue).getByRole(eintragRolle, { name: 'Teilen' }).querySelector('svg'),
      ).not.toBeNull();
    });
  });

  it('Rechner: Tipp daneben und Esc schließen', () => {
    render(<Seite handy={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
