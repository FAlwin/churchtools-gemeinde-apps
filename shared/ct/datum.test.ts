import { describe, expect, it } from 'vitest';
import { datumText, kachel, monatTitel, tagKurz, tageBis } from './datum';

describe('Tage anzeigen', () => {
  it('Datum, kurzes Datum, Kachel und Monat', () => {
    expect(datumText('2026-11-14')).toBe('Sa, 14.11.2026');
    expect(tagKurz('2026-10-18')).toBe('So, 18.10.');
    expect(kachel('2026-11-04')).toEqual({ tag: '4', monat: 'NOV' });
    expect(kachel('2026-03-01')).toEqual({ tag: '1', monat: 'MÄR' });
    expect(monatTitel('2026-12-31')).toBe('Dezember 2026');
    expect(monatTitel(null)).toBe('Ohne Datum');
  });

  it('Tage bis – auch über die Zeitumstellung (Ende Oktober) genau', () => {
    expect(tageBis('2026-10-12', '2026-11-07')).toBe(26);
    expect(tageBis('2026-10-24', '2026-10-26')).toBe(2);
  });
});
