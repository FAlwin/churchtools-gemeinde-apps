import { describe, expect, it } from 'vitest';
import { loslassen, ziehId, type Daten } from './toDoZiehenRegel';

/** S7-3: Was beim Loslassen einer Karte geschieht. */
const spalten = new Map([
  ['offen', ['a', 'b', 'c']],
  ['arbeit', ['d']],
]);
const karte = (spalte: string, k: string): Daten => ({ art: 'karte', spalte, karte: k });
const q = (x: Partial<Parameters<typeof loslassen>[0]>) =>
  loslassen({
    von: karte('offen', 'c'),
    ueber: karte('offen', 'a'),
    zwischen: true,
    manuell: true,
    spalten,
    ...x,
  });

describe('loslassen', () => {
  it('über einer anderen Spalte (oder einer Karte dort): ablegen – nur im Board', () => {
    const anders = { ueber: { art: 'spalte' as const, spalte: 'arbeit' } };
    expect(q(anders)).toEqual({ art: 'ablegen', karte: 'c', von: 'offen', nach: 'arbeit' });
    expect(q({ ueber: karte('arbeit', 'd') })).toMatchObject({ art: 'ablegen', nach: 'arbeit' });
    expect(q({ ...anders, zwischen: false })).toBeNull();
  });
  it('in derselben Spalte über einer Karte: umordnen – nur bei „Manuell“; `vor` = die Karte danach', () => {
    expect(q({})).toEqual({ art: 'umordnen', spalte: 'offen', karte: 'c', vor: 'a' });
    expect(q({ von: karte('offen', 'a'), ueber: karte('offen', 'c') })).toEqual({
      art: 'umordnen',
      spalte: 'offen',
      karte: 'a',
      vor: null,
    });
    expect(q({ manuell: false })).toBeNull();
  });
  it('nichts: über sich selbst, über der eigenen Spalte, ins Leere', () => {
    expect(q({ ueber: karte('offen', 'c') })).toBeNull();
    expect(q({ ueber: { art: 'spalte', spalte: 'offen' } })).toBeNull();
    expect(q({ ueber: null })).toBeNull();
  });
  it('dasselbe To-Do in zwei Spalten (nach Person, zwei Zuständige): die Spalte zählt, aus der gezogen wird (Fund 30.10.)', () => {
    const personen = new Map([
      ['p1', ['x', 'c']],
      ['p19', ['c']],
    ]);
    // Umordnen in Alwins Spalte bleibt Umordnen – vorher wurde daraus „von Spike zu Alwin“ und Spike fiel weg.
    expect(
      loslassen({
        von: karte('p1', 'c'),
        ueber: karte('p1', 'x'),
        zwischen: true,
        manuell: true,
        spalten: personen,
      }),
    ).toEqual({ art: 'umordnen', spalte: 'p1', karte: 'c', vor: 'x' });
    expect(ziehId('p1', 'c')).not.toBe(ziehId('p19', 'c'));
  });
});
