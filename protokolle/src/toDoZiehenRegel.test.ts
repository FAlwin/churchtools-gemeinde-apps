import { describe, expect, it } from 'vitest';
import { loslassen } from './toDoZiehenRegel';

/** S7-3: Was beim Loslassen einer Karte geschieht. */
const spalten = new Map([
  ['offen', ['a', 'b', 'c']],
  ['arbeit', ['d']],
]);
const q = (x: Partial<Parameters<typeof loslassen>[0]>) =>
  loslassen({
    karte: 'c',
    von: { art: 'karte', spalte: 'offen' },
    ueber: { art: 'karte', spalte: 'offen' },
    ueberId: 'a',
    zwischen: true,
    manuell: true,
    spalten,
    ...x,
  });

describe('loslassen', () => {
  it('über einer anderen Spalte (oder einer Karte dort): ablegen – nur im Board', () => {
    const anders = {
      ueber: { art: 'spalte' as const, spalte: 'arbeit' },
      ueberId: 'spalte:arbeit',
    };
    expect(q(anders)).toEqual({ art: 'ablegen', karte: 'c', von: 'offen', nach: 'arbeit' });
    expect(q({ ueber: { art: 'karte', spalte: 'arbeit' }, ueberId: 'd' })).toMatchObject({
      art: 'ablegen',
      nach: 'arbeit',
    });
    expect(q({ ...anders, zwischen: false })).toBeNull();
  });
  it('in derselben Spalte über einer Karte: umordnen – nur bei „Manuell“; `vor` = die Karte danach', () => {
    expect(q({})).toEqual({ art: 'umordnen', spalte: 'offen', karte: 'c', vor: 'a' });
    expect(q({ karte: 'a', ueberId: 'c' })).toEqual({
      art: 'umordnen',
      spalte: 'offen',
      karte: 'a',
      vor: null,
    });
    expect(q({ manuell: false })).toBeNull();
  });
  it('nichts: über sich selbst, über der eigenen Spalte, ins Leere', () => {
    expect(q({ ueberId: 'c' })).toBeNull();
    expect(q({ ueber: { art: 'spalte', spalte: 'offen' }, ueberId: 'spalte:offen' })).toBeNull();
    expect(q({ ueber: null, ueberId: null })).toBeNull();
  });
});
