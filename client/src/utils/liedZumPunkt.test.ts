import { describe, expect, it } from 'vitest';
import { liedZumPunkt } from './liedZumPunkt';

const lied = { title: 'x' };
const ABLAUF = [
  { id: 1, song: null },
  { id: 2, song: lied },
  { id: 3, song: null },
  { id: 4, song: lied },
];

describe('liedZumPunkt (E6-O O4)', () => {
  it('zählt nur Punkte mit Lied – wie die Blätter in der App', () => {
    expect(liedZumPunkt(ABLAUF, 2)).toBe(0);
    expect(liedZumPunkt(ABLAUF, 4)).toBe(1);
  });

  it('Punkt ohne Lied oder gar nicht da → null (die App zeigt dann den Ablauf)', () => {
    expect(liedZumPunkt(ABLAUF, 3)).toBeNull();
    expect(liedZumPunkt(ABLAUF, 99)).toBeNull();
  });
});
