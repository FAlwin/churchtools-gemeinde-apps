// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HinzufuegenMenue } from './OptionWaehlen';

afterEach(cleanup);

/**
 * „Neu ⌄“ (R3/E14, Protokolle B6): ein grüner Knopf für alles, was etwas hinzufügt. Wie bei „⋯“ läuft die Aktion eines
 * Eintrags, nachdem das Menü zu ist – eine Aktion, die ein Fenster öffnet, wird vom Schließen nicht zurückgesetzt
 * (Lehre 05.08.2026). Jeder Eintrag hat einen eigenen Test.
 */
function Seite({ handy }: { handy: boolean }) {
  const [fenster, setFenster] = useState<string | null>(null);
  return (
    <>
      <HinzufuegenMenue
        label="Neu"
        titel="Neu"
        pfeil
        handy={handy}
        optionen={[
          { label: 'Neues Protokoll', onClick: () => setFenster('P') },
          { label: 'Neue Sitzung', onClick: () => setFenster('S') },
          { label: 'Punkt vorschlagen', onClick: () => setFenster('V') },
          { label: 'Protokoll nachtragen', trenner: true, onClick: () => setFenster('N') },
        ]}
      />
      <output>{fenster ?? 'nichts'}</output>
    </>
  );
}
const ausgabe = () => screen.getByRole('status').textContent;

describe('HinzufuegenMenue als „Neu ⌄“', () => {
  it('ohne Möglichkeiten gibt es auch den Knopf nicht – mit `gesperrt` schon', () => {
    const { unmount } = render(<HinzufuegenMenue label="Neu" optionen={[]} />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    render(<HinzufuegenMenue label="Neu" optionen={[]} gesperrt={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Neu' })).toBeTruthy();
  });

  it('der Knopf ist grün, hat einen Pfeil und kündigt ein Menü an', () => {
    render(<Seite handy={false} />);
    const knopf = screen.getByRole('button', { name: 'Neu' });
    expect(knopf.className).toMatch(/neu/);
    expect(knopf.getAttribute('aria-haspopup')).toBe('menu');
    expect(knopf.querySelectorAll('svg')).toHaveLength(2); // Plus vorn, Pfeil hinten
  });

  it('Handy: statt des grünen Knopfs im Kopf das schwebende Plus (R3) – ohne Pfeil, mit Tour-Ziel', () => {
    render(
      <HinzufuegenMenue
        label="Neu"
        pfeil
        handy
        dataTour="neu"
        optionen={[{ label: 'Neue Sitzung', onClick: vi.fn() }]}
      />,
    );
    const plus = screen.getByRole('button', { name: 'Neu' });
    expect(plus.className).toMatch(/plus/);
    expect(plus.className).not.toMatch(/neu/);
    expect(plus.getAttribute('data-tour')).toBe('neu');
    expect(plus.querySelectorAll('svg')).toHaveLength(1);
  });

  describe.each([
    ['Rechner', false, 'menu', 'menuitem'],
    ['Handy', true, 'dialog', 'button'],
  ] as const)('%s', (_n, handy, menueRolle, eintragRolle) => {
    it('öffnet erst beim Tipp', () => {
      render(<Seite handy={handy} />);
      expect(screen.queryByRole(menueRolle, { name: 'Neu' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Neu' }));
      expect(screen.getByRole(menueRolle, { name: 'Neu' })).toBeTruthy();
    });

    it.each([
      ['Neues Protokoll', 'P'],
      ['Neue Sitzung', 'S'],
      ['Punkt vorschlagen', 'V'],
      ['Protokoll nachtragen', 'N'],
    ])('„%s“: die Aktion läuft, das Menü ist zu, die Aktion bleibt bestehen', (name, kennung) => {
      render(<Seite handy={handy} />);
      fireEvent.click(screen.getByRole('button', { name: 'Neu' }));
      fireEvent.click(
        within(screen.getByRole(menueRolle, { name: 'Neu' })).getByRole(eintragRolle, { name }),
      );
      expect(screen.queryByRole(menueRolle, { name: 'Neu' })).toBeNull();
      expect(ausgabe()).toBe(kennung);
    });
  });

  it('Rechner: „Protokoll nachtragen“ steht hinter einer Linie', () => {
    render(<Seite handy={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Neu' }));
    const menue = within(screen.getByRole('menu', { name: 'Neu' }));
    expect(menue.getByRole('menuitem', { name: 'Protokoll nachtragen' }).className).toMatch(
      /trenner/,
    );
    expect(menue.getByRole('menuitem', { name: 'Neue Sitzung' }).className).not.toMatch(/trenner/);
  });

  it('Handy: ✕ schließt das Blatt, ohne etwas auszulösen', () => {
    render(<Seite handy />);
    fireEvent.click(screen.getByRole('button', { name: 'Neu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog', { name: 'Neu' })).toBeNull();
    expect(ausgabe()).toBe('nichts');
  });

  it('mit `gesperrt` öffnet sich kein Menü, sondern der Hinweis des Aufrufers (Ablauf abgeschlossen)', () => {
    const hinweis = vi.fn();
    render(
      <HinzufuegenMenue
        label="Eintrag hinzufügen"
        optionen={[{ label: 'Lied', onClick: vi.fn() }]}
        gesperrt={hinweis}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Eintrag hinzufügen' }));
    expect(hinweis).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
