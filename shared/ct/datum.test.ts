import { describe, expect, it } from 'vitest';
import {
  datumText,
  monateBis,
  kachel,
  MONATE,
  MONATE_KURZ,
  monatName,
  monatTitel,
  tagKurz,
  tageBis,
} from './datum';

describe('Tage anzeigen', () => {
  it('Datum, kurzes Datum, Kachel und Monat', () => {
    expect(datumText('2026-11-14')).toBe('Sa, 14.11.2026');
    expect(tagKurz('2026-10-18')).toBe('So, 18.10.');
    expect(kachel('2026-11-04')).toEqual({ tag: '4', monat: 'NOV' });
    expect(kachel('2026-03-01')).toEqual({ tag: '1', monat: 'MÄR' });
    expect(monatTitel('2026-12-31')).toBe('Dezember 2026');
    expect(monatTitel(null)).toBe('Ohne Datum');
    expect(monatName('2026-11-08')).toBe('November');
    expect(monatName('2027-03-01')).toBe('März');
  });

  it('Tage bis – auch über die Zeitumstellung (Ende Oktober) genau', () => {
    expect(tageBis('2026-10-12', '2026-11-07')).toBe(26);
    expect(tageBis('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('Monatsnamen – eine Quelle für alle Apps', () => {
  // So standen sie bis 14.10.2026 in vier Listen (datum, monate, Agenda, mapEvent) – die Anzeige bleibt gleich.
  const LANG =
    'Januar Februar März April Mai Juni Juli August September Oktober November Dezember'.split(' ');
  const KURZ = 'Jan Feb Mär Apr Mai Jun Jul Aug Sep Okt Nov Dez'.split(' ');
  const tag = (m: number) => `2027-${String(m + 1).padStart(2, '0')}-15`;

  it('lang und kurz, alle zwölf', () => {
    expect([...MONATE]).toEqual(LANG);
    expect([...MONATE_KURZ]).toEqual(KURZ);
  });

  it('monatName, monatTitel und die Datumskachel über alle zwölf Monate', () => {
    for (let m = 0; m < 12; m++) {
      expect(monatName(tag(m))).toBe(LANG[m]);
      expect(monatTitel(tag(m))).toBe(`${LANG[m]} 2027`);
      expect(kachel(tag(m)).monat).toBe(KURZ[m].toUpperCase());
    }
    expect(kachel('2027-03-01').monat).toBe('MÄR');
  });
});

describe('monateBis (Zauberstab E5-1)', () => {
  it('zählt nur den Monat, auch über den Jahreswechsel und rückwärts', () => {
    expect(monateBis('2026-11-30', '2026-11-01')).toBe(0);
    expect(monateBis('2026-10-31', '2026-11-01')).toBe(1);
    expect(monateBis('2026-11', '2027-01')).toBe(2);
    expect(monateBis('2027-01-15', '2026-11-15')).toBe(-2);
  });
});
