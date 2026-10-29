import { describe, expect, it } from 'vitest';
import { kuerzenAuf, nachKommasUmbrechen } from './umbruch';

const breite = (t: string) => t.length;

describe('Namen umbrechen (O7b-6)', () => {
  it('nur nach einem Komma, das Komma bleibt am Zeilenende; kein Name wird geteilt', () => {
    expect(nachKommasUmbrechen(['Anna', 'Ben', 'Clara', 'David'], 12, breite)).toEqual([
      'Anna, Ben,',
      'Clara, David',
    ]);
  });

  it('ein Name, der allein nicht passt, wird mit „…“ gekürzt', () => {
    expect(nachKommasUmbrechen(['Maximilian-Alexander'], 8, breite)).toEqual(['Maximil…']);
    expect(kuerzenAuf('Kurz', 8, breite)).toBe('Kurz');
  });

  it('nichts → keine Zeile', () => {
    expect(nachKommasUmbrechen([], 10, breite)).toEqual([]);
  });
});
