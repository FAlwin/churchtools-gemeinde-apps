// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ZeitraumLeiste } from './ZeitraumLeiste';

afterEach(cleanup);

const pfeil = (name: string, aktiv = true) => ({ aktiv, label: name, onClick: vi.fn() });

describe('ZeitraumLeiste (R5, B3/B4)', () => {
  it('ein Rahmen „Zeitraum“: ‹ Knopf ›, die Pfeile tun, was ihr Aufrufer sagt', () => {
    const davor = pfeil('Zurück');
    const danach = pfeil('Weiter');
    render(
      <ZeitraumLeiste
        knopf={<button type="button">19.11.</button>}
        davor={davor}
        danach={danach}
        dataTour="ziel"
      />,
    );
    const gruppe = screen.getByRole('group', { name: 'Zeitraum' });
    expect(gruppe.getAttribute('data-tour')).toBe('ziel');
    expect(
      within(gruppe)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['Zurück', '19.11.', 'Weiter']);
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(davor.onClick).toHaveBeenCalledTimes(1);
    expect(danach.onClick).toHaveBeenCalledTimes(1);
  });

  it('ein Pfeil ohne Ziel ist gesperrt', () => {
    render(
      <ZeitraumLeiste
        knopf={<button type="button">x</button>}
        davor={pfeil('Zurück', false)}
        danach={pfeil('Weiter')}
      />,
    );
    expect(screen.getByRole('button', { name: 'Zurück' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Weiter' })).toHaveProperty('disabled', false);
  });

  it('ohne `blaettern` gibt es nur den Knopf', () => {
    render(
      <ZeitraumLeiste
        knopf={<button type="button">x</button>}
        blaettern={false}
        davor={pfeil('Zurück')}
        danach={pfeil('Weiter')}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['x']);
  });
});
