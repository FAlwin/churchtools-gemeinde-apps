// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useSortable } from '@dnd-kit/sortable';
import { ToDoZiehBereich, ZiehKarte, ZiehSpalte } from './ToDoZiehen';

/**
 * Fund in der Test-Instanz (30.10.2026): Ein To-Do mit zwei Zuständigen steht nach Person in zwei Spalten. Mit derselben
 * Zieh-Kennung verwechselte das Ziehen die Spalten – Umordnen trug eine Person aus. Jede Karte braucht eine je Spalte
 * eindeutige Kennung und muss in ihren Daten sagen, welches To-Do und welche Spalte sie ist.
 */
vi.mock('@dnd-kit/sortable', async (orig) => {
  const echt = await orig<typeof import('@dnd-kit/sortable')>();
  return { ...echt, useSortable: vi.fn(echt.useSortable) };
});
afterEach(cleanup);

describe('ZiehKarte', () => {
  it('dasselbe To-Do in zwei Spalten: zwei Kennungen, jede mit ihrer Spalte', () => {
    const spalten = new Map([
      ['p1', ['11:c']],
      ['p19', ['11:c']],
    ]);
    render(
      <ToDoZiehBereich
        zwischen
        manuell
        spalten={spalten}
        onAblegen={vi.fn()}
        onUmordnen={vi.fn()}
        bild={() => null}
      >
        {['p1', 'p19'].map((s) => (
          <ZiehSpalte key={s} schluessel={s} nimmtAn karten={['11:c']}>
            <ul>
              <ZiehKarte schluessel="11:c" spalte={s} darf>
                c
              </ZiehKarte>
            </ul>
          </ZiehSpalte>
        ))}
      </ToDoZiehBereich>,
    );
    const aufrufe = vi.mocked(useSortable).mock.calls.map(([a]) => a);
    const ids = new Set(aufrufe.map((a) => a.id));
    expect(ids.size).toBe(2);
    expect(aufrufe.map((a) => a.data)).toEqual(
      expect.arrayContaining([
        { art: 'karte', spalte: 'p1', karte: '11:c' },
        { art: 'karte', spalte: 'p19', karte: '11:c' },
      ]),
    );
  });
});
