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
      { id: 1, name: 'Programm' },
      { id: 3, name: 'Technik' },
      { id: 4, name: 'Musik' },
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
      { id: 9, name: 'Zeta' },
      { id: 8, name: 'Alpha' },
      { id: 1, name: 'Mitte', sortKey: 5 },
    ];
    expect(dienstgruppenAus(roh).map((g) => g.name)).toEqual(['Mitte', 'Alpha', 'Zeta']);
  });
});
