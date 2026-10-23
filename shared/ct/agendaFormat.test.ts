import { describe, expect, it } from 'vitest';
import { kuerzelAus, responsibleEntries } from './agendaFormat';

/**
 * Die Zuständigen einer Zeile (E6-O1): Kürzel und Foto für die Kreise rechts kommen mit dem Ablauf (gemessen E6-O0).
 */
describe('responsibleEntries – Kürzel und Foto (E6-O1)', () => {
  it('Kürzel von ChurchTools, sonst aus dem Namen; Foto nur, wo eins da ist; offene Dienste ohne beides', () => {
    expect(
      responsibleEntries({
        responsible: {
          persons: [
            {
              service: '[Musik]',
              person: { title: 'Anna Feld', initials: 'AF', imageUrl: 'https://ct.test/a.jpg' },
            },
            { service: '[Musik]', person: { title: 'Lea Fromm', initials: '', imageUrl: null } },
            { service: '[Gesang]?' },
          ],
        },
      }),
    ).toEqual([
      { label: 'Anna Feld', open: false, kuerzel: 'AF', bild: 'https://ct.test/a.jpg' },
      { label: 'Lea Fromm', open: false, kuerzel: 'LF' },
      { label: 'Gesang', open: true },
    ]);
  });

  it('das Kürzel von ChurchTools gilt, auch wenn es anders wäre als aus dem Namen gebildet', () => {
    expect(
      responsibleEntries({
        responsible: {
          persons: [{ service: '[Predigt]', person: { title: 'Dr. Anna Feld', initials: 'AF' } }],
        },
      })[0].kuerzel,
    ).toBe('AF'); // gebildet wäre es „DF“
  });

  it('Freitext-Zuständige bleiben wie bisher (ohne Kreis)', () => {
    expect(responsibleEntries({ responsible: { text: 'Gastprediger, [Predigt]' } })).toEqual([
      { label: 'Gastprediger', open: false },
    ]);
  });
});

describe('kuerzelAus', () => {
  it('erster und letzter Name, groß; ein Name allein ein Buchstabe; Leerzeichen egal', () => {
    expect(kuerzelAus('Anna Feld')).toBe('AF');
    expect(kuerzelAus('  anna  maria   feld ')).toBe('AF');
    expect(kuerzelAus('Anna')).toBe('A');
    expect(kuerzelAus('')).toBe('');
  });
});
