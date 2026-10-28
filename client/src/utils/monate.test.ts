import { describe, it, expect } from 'vitest';
import { letzterTag, monatLabel, monatNurKurz, monatPlus, monatVon } from './monate';

describe('monate – die Monatsansicht rechnet in Strings, nicht in Zeitzonen', () => {
  it('addiert über den Jahreswechsel und zurück', () => {
    expect(monatPlus('2026-10', 3)).toBe('2027-01');
    expect(monatPlus('2026-10', 12)).toBe('2027-10');
    expect(monatPlus('2026-01', -1)).toBe('2025-12');
    expect(monatPlus('2026-01', -13)).toBe('2024-12');
  });
  it('beschriftet lang', () => {
    expect(monatLabel('2026-10')).toBe('Oktober 2026');
  });
  it('kennt den Monat eines Tages', () => {
    expect(monatVon('2026-11-19')).toBe('2026-11');
  });
  it('kennt den letzten Tag – auch im Schaltjahr', () => {
    expect(letzterTag('2026-02')).toBe('2026-02-28');
    expect(letzterTag('2028-02')).toBe('2028-02-29');
    expect(letzterTag('2026-12')).toBe('2026-12-31');
  });
});

describe('Monatsnamen aus der gemeinsamen Quelle (14.10.2026) – Anzeige wie vorher', () => {
  const LANG =
    'Januar Februar März April Mai Juni Juli August September Oktober November Dezember'.split(' ');
  const KURZ = 'Jan Feb Mär Apr Mai Jun Jul Aug Sep Okt Nov Dez'.split(' ');
  it('monatLabel und monatNurKurz über alle zwölf Monate', () => {
    for (let m = 0; m < 12; m++) {
      const monat = `2027-${String(m + 1).padStart(2, '0')}`;
      expect(monatLabel(monat)).toBe(`${LANG[m]} 2027`);
      expect(monatNurKurz(monat)).toBe(KURZ[m]);
    }
  });
});
