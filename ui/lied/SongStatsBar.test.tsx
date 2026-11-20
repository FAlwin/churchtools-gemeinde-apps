// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SongStatsBar } from './SongStatsBar';

afterEach(cleanup);

const BASIS = {
  sort: 'name' as const,
  from: '',
  to: '',
  allRange: true,
  statMode: false,
};

/**
 * **Die Sortierung im Liederheft** (B8): als Werkzeugzeile (`werkzeug`), in den Fenstern „Lied hinzufügen“/„Lied verknüpfen“
 * weiter als Kasten-Umschalter (Fenster werden nicht umgebaut, E18).
 */
describe('SongStatsBar', () => {
  it('ohne `werkzeug` (Fenster): der Kasten-Umschalter, keine Werkzeugzeile', () => {
    render(<SongStatsBar {...BASIS} setSort={vi.fn()} setFrom={vi.fn()} setTo={vi.fn()} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'A–Z',
      'Häufigkeit',
      'Zuletzt',
    ]);
  });

  it('Rechner: Werkzeugzeile mit dem verbundenen Umschalter; die Wahl sortiert', () => {
    const setSort = vi.fn();
    render(
      <SongStatsBar
        {...BASIS}
        setSort={setSort}
        setFrom={vi.fn()}
        setTo={vi.fn()}
        werkzeug={{ handy: false }}
      />,
    );
    const zeile = within(screen.getByRole('toolbar', { name: 'Sortierung' }));
    fireEvent.click(zeile.getByRole('button', { name: 'Häufigkeit' }));
    expect(setSort).toHaveBeenCalledWith('count');
  });

  it('Handy: ein Auswahlknopf mit der gewählten Sortierung; das Blatt bietet alle drei', () => {
    const setSort = vi.fn();
    render(
      <SongStatsBar
        {...BASIS}
        setSort={setSort}
        setFrom={vi.fn()}
        setTo={vi.fn()}
        werkzeug={{ handy: true }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sortierung: A–Z' }));
    const blatt = within(screen.getByRole('dialog', { name: 'Sortierung' }));
    expect(blatt.getAllByRole('button').map((b) => b.textContent)).toEqual(
      expect.arrayContaining(['A–Z', 'Häufigkeit', 'Zuletzt']),
    );
    fireEvent.click(blatt.getByRole('button', { name: 'Zuletzt' }));
    expect(setSort).toHaveBeenCalledWith('recent');
  });

  it('der Zeitraum (Von–Bis, Alle) steht bei Häufigkeit/Zuletzt unter der Zeile – in beiden Fassungen', () => {
    for (const werkzeug of [undefined, { handy: false }]) {
      render(
        <SongStatsBar
          {...BASIS}
          statMode
          setSort={vi.fn()}
          setFrom={vi.fn()}
          setTo={vi.fn()}
          werkzeug={werkzeug}
        />,
      );
      expect(screen.getByLabelText('Zeitraum von')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Alle' })).toBeTruthy();
      cleanup();
    }
  });
});
