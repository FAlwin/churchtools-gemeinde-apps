import { describe, expect, it } from 'vitest';
import { AUFZAEHLUNG, aufzaehlungsZeichen } from './aufzaehlung';

describe('aufzaehlungsZeichen', () => {
  it('Ebene 1 •, Ebene 2 ◦, ab Ebene 3 –', () => {
    expect([0, 1, 2, 3, 4, 9].map(aufzaehlungsZeichen)).toEqual(['•', '◦', '–', '–', '–', '–']);
  });

  it('Ungültiges zählt als oberste Ebene', () => {
    expect([-1, NaN, Infinity].map(aufzaehlungsZeichen)).toEqual(['•', '•', '•']);
  });

  it('die Liste und die Funktion sind dieselbe Quelle', () => {
    AUFZAEHLUNG.forEach((z, i) => expect(aufzaehlungsZeichen(i)).toBe(z));
  });
});
