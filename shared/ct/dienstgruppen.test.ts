import { describe, expect, it } from 'vitest';
import { dienstgruppenAus } from './dienstgruppen';

describe('dienstgruppenAus', () => {
  it('Reihenfolge nach sortKey wie in ChurchTools, nicht nach ID oder Name', () => {
    // Form wie an der Test-Instanz gemessen (13.10.2026), absichtlich durcheinander.
    const roh = [
      { id: 4, name: 'Musik', nameTranslated: 'Musik', sortKey: 40 },
      { id: 1, name: 'Programm', nameTranslated: 'Programm', sortKey: 10 },
      { id: 3, name: 'Technik', nameTranslated: 'Technik', sortKey: 30 },
    ];
    expect(dienstgruppenAus(roh)).toEqual([
      { id: 1, name: 'Programm', fuerAlle: false },
      { id: 3, name: 'Technik', fuerAlle: false },
      { id: 4, name: 'Musik', fuerAlle: false },
    ]);
  });

  it('übersetzter Name vor dem Grundnamen; leerer übersetzter Name zählt nicht', () => {
    expect(dienstgruppenAus([{ id: 1, name: 'Tech', nameTranslated: 'Technik' }])[0].name).toBe(
      'Technik',
    );
    expect(dienstgruppenAus([{ id: 1, name: 'Tech', nameTranslated: ' ' }])[0].name).toBe('Tech');
  });

  it('ohne ID oder Namen fällt der Eintrag weg; null-Antwort → leere Liste', () => {
    expect(dienstgruppenAus([{ id: null, name: 'X' }, { id: 2 }])).toEqual([]);
    expect(dienstgruppenAus(null)).toEqual([]);
  });

  it('ohne sortKey ans Ende, dann nach Name', () => {
    const roh = [
      { id: 9, name: 'Zeta', fuerAlle: false },
      { id: 8, name: 'Alpha', fuerAlle: false },
      { id: 1, name: 'Mitte', sortKey: 5 },
    ];
    expect(dienstgruppenAus(roh).map((g) => g.name)).toEqual(['Mitte', 'Alpha', 'Zeta']);
  });
});

describe('dienstgruppenAus – „für alle sichtbar“', () => {
  it('`viewAll: true` → fuerAlle; fehlt es oder ist es kein echtes true → nein', () => {
    const g = dienstgruppenAus([
      { id: 1, name: 'Programm', viewAll: true },
      { id: 3, name: 'Technik', viewAll: false },
      { id: 4, name: 'Musik' },
      { id: 5, name: 'Deko', viewAll: 'true' },
    ]);
    expect(Object.fromEntries(g.map((x) => [x.name, x.fuerAlle]))).toEqual({
      Programm: true,
      Technik: false,
      Musik: false,
      Deko: false,
    });
  });
});
