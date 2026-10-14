import { describe, expect, it } from 'vitest';
import {
  AB_HEUTE,
  zeitraumAus,
  zeitraumGrenzen,
  zeitraumGueltig,
  spanneText,
  zeitraumText,
  zeitraumVerschieben,
} from './zeitraum';

describe('zeitraumGrenzen', () => {
  it('Monat: erster bis letzter Tag, Schaltjahr inklusive; ab heute: keine', () => {
    expect(zeitraumGrenzen({ art: 'monat', monat: '2026-10' })).toEqual({
      von: '2026-10-01',
      bis: '2026-10-31',
    });
    expect(zeitraumGrenzen({ art: 'monat', monat: '2028-02' })).toEqual({
      von: '2028-02-01',
      bis: '2028-02-29',
    });
    expect(zeitraumGrenzen({ art: 'eigen', von: '2026-10-05', bis: '2026-11-01' })).toEqual({
      von: '2026-10-05',
      bis: '2026-11-01',
    });
    expect(zeitraumGrenzen(AB_HEUTE)).toBeNull();
  });
});

describe('zeitraumVerschieben', () => {
  it('Monat um einen Monat, über den Jahreswechsel', () => {
    expect(zeitraumVerschieben({ art: 'monat', monat: '2026-12' }, 1)).toEqual({
      art: 'monat',
      monat: '2027-01',
    });
    expect(zeitraumVerschieben({ art: 'monat', monat: '2026-01' }, -1)).toEqual({
      art: 'monat',
      monat: '2025-12',
    });
  });

  it('eigener Zeitraum um seine Länge – vier Wochen weiter sind die nächsten vier Wochen', () => {
    expect(zeitraumVerschieben({ art: 'eigen', von: '2026-10-05', bis: '2026-11-01' }, 1)).toEqual({
      art: 'eigen',
      von: '2026-11-02',
      bis: '2026-11-29',
    });
    expect(zeitraumVerschieben({ art: 'eigen', von: '2026-10-05', bis: '2026-10-05' }, -1)).toEqual(
      {
        art: 'eigen',
        von: '2026-10-04',
        bis: '2026-10-04',
      },
    );
  });

  it('ab heute bleibt ab heute', () => {
    expect(zeitraumVerschieben(AB_HEUTE, 1)).toBe(AB_HEUTE);
  });
});

describe('zeitraumText', () => {
  it('Monat ausgeschrieben; eigener Zeitraum mit Jahr am Ende, beim Jahreswechsel an beiden Enden', () => {
    expect(zeitraumText({ art: 'monat', monat: '2026-03' })).toBe('März 2026');
    expect(zeitraumText({ art: 'eigen', von: '2026-10-01', bis: '2026-10-31' })).toBe(
      '01.10. – 31.10.2026',
    );
    expect(zeitraumText({ art: 'eigen', von: '2026-12-20', bis: '2027-01-10' })).toBe(
      '20.12.2026 – 10.01.2027',
    );
  });

  it('ein einzelner Tag ohne „18.10. – 18.10.“ – und dieselbe Regel für das, was „ab heute“ zeigt', () => {
    expect(zeitraumText({ art: 'eigen', von: '2026-10-18', bis: '2026-10-18' })).toBe('18.10.2026');
    expect(spanneText('2026-10-18', '2026-10-18')).toBe('18.10.2026');
    // Vorher eine eigene Kopie in Planen.tsx – ohne Jahreswechsel („20.12. – 10.01.2027“).
    expect(spanneText('2026-12-20', '2027-01-10')).toBe('20.12.2026 – 10.01.2027');
  });
});

describe('zeitraumGueltig / zeitraumAus', () => {
  it('nur echte Tage, von nicht nach bis', () => {
    expect(zeitraumGueltig('2026-10-01', '2026-10-01')).toBe(true);
    expect(zeitraumGueltig('2026-10-02', '2026-10-01')).toBe(false);
    expect(zeitraumGueltig('2026-02-30', '2026-03-01')).toBe(false);
    expect(zeitraumGueltig('', '2026-03-01')).toBe(false);
  });

  it('aus dem Gerät: Gültiges bleibt, Unsinn wird „ab heute“', () => {
    expect(zeitraumAus({ art: 'monat', monat: '2026-10' })).toEqual({
      art: 'monat',
      monat: '2026-10',
    });
    expect(zeitraumAus({ art: 'eigen', von: '2026-10-01', bis: '2026-10-31' })).toEqual({
      art: 'eigen',
      von: '2026-10-01',
      bis: '2026-10-31',
    });
    for (const unsinn of [
      null,
      'x',
      { art: 'monat', monat: '2026-13' },
      { art: 'eigen', von: '2026-11-01', bis: '2026-10-01' },
      { art: 'woche' },
    ]) {
      expect(zeitraumAus(unsinn)).toEqual(AB_HEUTE);
    }
  });
});
