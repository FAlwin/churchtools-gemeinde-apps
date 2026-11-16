import { describe, expect, it } from 'vitest';
import { ALLES_SICHTBAR, etwasAusgeblendet, sichtbarkeitAus } from './sichtbarkeit';

describe('sichtbarkeitAus – was gespeichert ist (O7b-7)', () => {
  it('IDs von Typen und Gruppen, sortiert und ohne Doppelte', () => {
    expect(sichtbarkeitAus({ typen: [9, 4, 9], gruppen: [12, 7] })).toEqual({
      typen: [4, 9],
      gruppen: [7, 12],
      personen: 'alle',
    });
  });

  it('Personen ohne Leitung (#915 C): von vorher ohne Feld = alle Namen; Unbekanntes vorsichtshalber ohne Namen', () => {
    for (const st of ['aus', 'zahl', 'rollen', 'alle'] as const)
      expect(sichtbarkeitAus({ typen: [], gruppen: [], personen: st })?.personen).toBe(st);
    expect(sichtbarkeitAus({ typen: [], gruppen: [] })?.personen).toBe('alle');
    for (const roh of ['nur-leitung', 3, null, ''])
      expect(sichtbarkeitAus({ typen: [1], gruppen: [], personen: roh })).toEqual({
        typen: [1],
        gruppen: [],
        personen: 'zahl',
      });
  });

  it('alles andere ist keine Einstellung – dann gilt „nichts ausgeblendet“ beim Aufrufer', () => {
    for (const roh of [
      null,
      'x',
      {},
      { typen: [1] },
      { typen: [1], gruppen: ['2'] },
      { typen: [0], gruppen: [] },
    ])
      expect(sichtbarkeitAus(roh)).toBeNull();
  });

  it('etwasAusgeblendet', () => {
    expect(etwasAusgeblendet(ALLES_SICHTBAR)).toBe(false);
    expect(etwasAusgeblendet({ typen: [], gruppen: [3], personen: 'alle' })).toBe(true);
  });
});
