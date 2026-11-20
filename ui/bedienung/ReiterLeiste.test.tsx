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

  it('am Rand (12.11.2026): nur mit „oben“ bekommt die Leiste den Platz für die Statusleiste', () => {
    const { container, rerender } = render(
      <ReiterLeiste reiter={REITER} aktiv="a" onWechsel={() => {}} oben amRand />,
    );
    expect(container.querySelector('nav')?.className).toMatch(/oben.*rand/);
    // Reiter in einer Seite (Anmeldungen) bleiben ohne Polster.
    rerender(<ReiterLeiste reiter={REITER} aktiv="a" onWechsel={() => {}} oben />);
    expect(container.querySelector('nav')?.className).not.toMatch(/rand/);
    // Unten gibt es den Rand oben nicht.
    rerender(<ReiterLeiste reiter={REITER} aktiv="a" onWechsel={() => {}} amRand />);
    expect(container.querySelector('nav')?.className).not.toMatch(/rand/);
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

  it('roter Zähler: neben dem Text, Name für Vorleser mit Klartext; 0 oder ohne = kein Zähler; ab 100 „99+“', () => {
    const { rerender } = render(
      <ReiterLeiste
        reiter={[REITER[0], { ...REITER[1], zaehler: 3, zaehlerName: 'Zwei, 3 fällig' }]}
        aktiv="a"
        onWechsel={vi.fn()}
      />,
    );
    const zwei = screen.getByRole('button', { name: 'Zwei, 3 fällig' });
    expect(zwei.querySelector('[data-zaehler]')!.textContent).toBe('3');
    expect(screen.getByRole('button', { name: 'Eins' }).querySelector('[data-zaehler]')).toBeNull();

    rerender(
      <ReiterLeiste
        reiter={[REITER[0], { ...REITER[1], zaehler: 0, zaehlerName: 'Zwei, 0 fällig' }]}
        aktiv="a"
        onWechsel={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Zwei' }).querySelector('[data-zaehler]')).toBeNull();

    rerender(
      <ReiterLeiste
        reiter={[REITER[0], { ...REITER[1], zaehler: 120, zaehlerName: 'Zwei, viele' }]}
        aktiv="a"
        onWechsel={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Zwei, viele' }).querySelector('[data-zaehler]')!
        .textContent,
    ).toBe('99+');
  });

  it('rechts (Vollbild der Musik-App, B8): nur oben, am Ende der Zeile – unten (Handy) nicht', () => {
    const { container, rerender } = render(
      <ReiterLeiste
        reiter={REITER}
        aktiv="a"
        onWechsel={() => {}}
        oben
        rechts={<button>Vollbild</button>}
      />,
    );
    const nav = container.querySelector('nav')!;
    expect(nav.lastElementChild?.contains(screen.getByRole('button', { name: 'Vollbild' }))).toBe(
      true,
    );
    rerender(
      <ReiterLeiste
        reiter={REITER}
        aktiv="a"
        onWechsel={() => {}}
        rechts={<button>Vollbild</button>}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Vollbild' })).toBeNull();
  });

  it('App-Name (R8/E24, B8c): klein über den Reitern, nur oben und nicht flach; unten nie', () => {
    const { container, rerender } = render(
      <ReiterLeiste
        reiter={REITER}
        aktiv="a"
        onWechsel={() => {}}
        oben
        amRand
        appName="Musik-App"
      />,
    );
    const name = screen.getByText('Musik-App');
    // Der Name steht vor der Leiste, beide im selben Block (der trägt Rand und Polster für die Statusleiste).
    const nav = container.querySelector('nav')!;
    expect(name.nextElementSibling).toBe(nav);
    expect(nav.parentElement?.className).toMatch(/block.*rand|rand.*block/);
    expect(nav.className).not.toMatch(/rand/);
    // Die Reiter bleiben bedienbar und die Leiste behält ihren Namen für Vorleser.
    expect(screen.getByRole('navigation', { name: 'Bereiche' })).toBe(nav);

    rerender(<ReiterLeiste reiter={REITER} aktiv="a" onWechsel={() => {}} appName="Musik-App" />);
    expect(screen.queryByText('Musik-App')).toBeNull();
    rerender(
      <ReiterLeiste
        reiter={REITER}
        aktiv="a"
        onWechsel={() => {}}
        oben
        flach
        appName="Musik-App"
      />,
    );
    expect(screen.queryByText('Musik-App')).toBeNull();
  });

  it('Kurzbeschriftung: unten (Handy) steht `kurz`, oben immer `label`; der Name für Vorleser bleibt der lange', () => {
    const reiter = [
      { id: 'a', label: 'Organigramm', icon: 'home' as const },
      { id: 'b', label: 'Kinder & Jugend', kurz: 'Kinder', icon: 'people' as const },
    ];
    const { unmount } = render(<ReiterLeiste reiter={reiter} aktiv="a" onWechsel={vi.fn()} />);
    const unten = screen.getByRole('button', { name: 'Kinder & Jugend' });
    expect(unten.textContent).toBe('Kinder');
    expect(
      screen.getByRole('button', { name: 'Organigramm' }).getAttribute('aria-label'),
    ).toBeNull();
    unmount();
    render(<ReiterLeiste reiter={reiter} aktiv="a" onWechsel={vi.fn()} oben />);
    const oben = screen.getByRole('button', { name: 'Kinder & Jugend' });
    expect(oben.textContent).toBe('Kinder & Jugend');
    expect(oben.getAttribute('aria-label')).toBeNull();
  });
});
