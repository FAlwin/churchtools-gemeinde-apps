import { describe, expect, it } from 'vitest';
import {
  AB_HEUTE,
  ladeGrenzen,
  LETZTE_3,
  mitDazu,
  ohneDazu,
  zeitraumAus,
  zeitraumDazu,
  zeitraumGrenzen,
  zeitraumGueltig,
  spanneText,
  zeitraumText,
  zeitraumVerschieben,
} from './zeitraum';

describe('zeitraumGrenzen', () => {
  it('Monat: erster bis letzter Tag, Schaltjahr inklusive; ab heute: keine', () => {
    expect(zeitraumGrenzen({ art: 'monat', monat: '2026-10' }, '2026-11-05')).toEqual({
      von: '2026-10-01',
      bis: '2026-10-31',
    });
    expect(zeitraumGrenzen({ art: 'monat', monat: '2028-02' }, '2026-11-05')).toEqual({
      von: '2028-02-01',
      bis: '2028-02-29',
    });
    expect(
      zeitraumGrenzen({ art: 'eigen', von: '2026-10-05', bis: '2026-11-01' }, '2026-11-05'),
    ).toEqual({
      von: '2026-10-05',
      bis: '2026-11-01',
    });
    expect(zeitraumGrenzen(AB_HEUTE, '2026-11-05')).toBeNull();
  });
});

describe('zeitraumVerschieben', () => {
  it('Monat um einen Monat, über den Jahreswechsel', () => {
    expect(zeitraumVerschieben({ art: 'monat', monat: '2026-12' }, 1, '2026-11-05')).toEqual({
      art: 'monat',
      monat: '2027-01',
    });
    expect(zeitraumVerschieben({ art: 'monat', monat: '2026-01' }, -1, '2026-11-05')).toEqual({
      art: 'monat',
      monat: '2025-12',
    });
  });

  it('eigener Zeitraum um seine Länge – vier Wochen weiter sind die nächsten vier Wochen', () => {
    expect(
      zeitraumVerschieben({ art: 'eigen', von: '2026-10-05', bis: '2026-11-01' }, 1, '2026-11-05'),
    ).toEqual({
      art: 'eigen',
      von: '2026-11-02',
      bis: '2026-11-29',
    });
    expect(
      zeitraumVerschieben({ art: 'eigen', von: '2026-10-05', bis: '2026-10-05' }, -1, '2026-11-05'),
    ).toEqual({
      art: 'eigen',
      von: '2026-10-04',
      bis: '2026-10-04',
    });
  });

  it('ab heute bleibt ab heute', () => {
    expect(zeitraumVerschieben(AB_HEUTE, 1, '2026-11-05')).toBe(AB_HEUTE);
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

describe('Letzte N Monate (E9-3, „Wer wie oft?“)', () => {
  it('bis heute, ab demselben Tag N Monate früher – gibt es den Tag dort nicht, der letzte des Monats', () => {
    expect(zeitraumGrenzen(LETZTE_3, '2026-11-05')).toEqual({
      von: '2026-08-05',
      bis: '2026-11-05',
    });
    expect(zeitraumGrenzen({ art: 'letzte', monate: 12 }, '2026-11-05')).toEqual({
      von: '2025-11-05',
      bis: '2026-11-05',
    });
    expect(zeitraumGrenzen({ art: 'letzte', monate: 3 }, '2026-05-31')).toEqual({
      von: '2026-02-28',
      bis: '2026-05-31',
    });
    expect(zeitraumText({ art: 'letzte', monate: 6 })).toBe('Letzte 6 Monate');
  });

  it('‹ macht daraus einen eigenen Zeitraum gleicher Länge direkt davor', () => {
    expect(zeitraumVerschieben(LETZTE_3, -1, '2026-11-05')).toEqual({
      art: 'eigen',
      von: '2026-05-04',
      bis: '2026-08-04',
    });
  });

  it('aus dem Gerät: bleibt; Unsinn wird die übergebene Vorgabe, nicht „ab heute“', () => {
    expect(zeitraumAus({ art: 'letzte', monate: 6 }, LETZTE_3)).toEqual({
      art: 'letzte',
      monate: 6,
    });
    expect(zeitraumAus({ art: 'letzte', monate: 5 }, LETZTE_3)).toEqual(LETZTE_3);
    expect(zeitraumAus(undefined, LETZTE_3)).toEqual(LETZTE_3);
    expect(zeitraumAus({ art: 'abHeute' }, LETZTE_3)).toEqual(AB_HEUTE);
  });
});

describe('＋ bei gewähltem Zeitraum (E9-3): einzelne Veranstaltungen davor/danach', () => {
  const dez = { art: 'monat', monat: '2026-12' } as const;
  const g = { von: '2026-12-01', bis: '2026-12-31' };
  const tage = [
    { tag: '2026-11-22', sichtbar: true },
    { tag: '2026-11-25', sichtbar: false }, // vom Filter ausgeblendet – zählt nicht
    { tag: '2026-11-29', sichtbar: true },
    { tag: '2026-12-06', sichtbar: true },
    { tag: '2026-12-27', sichtbar: true },
    { tag: '2027-01-03', sichtbar: true },
    { tag: '2027-01-03', sichtbar: true }, // zwei Termine am selben Tag – ein Tag
    { tag: '2027-01-10', sichtbar: true },
  ];

  it('＋ zählt hoch, ‹ › und eine neue Wahl werfen es weg', () => {
    const zweiDavor = zeitraumDazu(zeitraumDazu(dez, -1), -1);
    expect(zeitraumDazu(zweiDavor, 1)).toEqual({ ...dez, dazu: { davor: 2, danach: 1 } });
    expect(zeitraumVerschieben(zweiDavor, 1, '2026-11-05')).toEqual({
      art: 'monat',
      monat: '2027-01',
    });
    expect(ohneDazu(zweiDavor)).toEqual(dez);
    expect(zeitraumDazu(AB_HEUTE, 1)).toBe(AB_HEUTE);
  });

  it('geladen wird neun Wochen je ＋ weiter – ohne ＋ genau der Zeitraum', () => {
    expect(ladeGrenzen(dez, '2026-11-05')).toEqual(g);
    expect(ladeGrenzen({ ...dez, dazu: { davor: 1, danach: 2 } }, '2026-11-05')).toEqual({
      von: '2026-09-29',
      bis: '2027-05-06',
    });
  });

  it('die Grenzen rücken bis zur N-ten sichtbaren Veranstaltung – ausgeblendete zählen nicht', () => {
    expect(mitDazu(tage, g, undefined)).toEqual({ ...g, davor: 0, danach: 0 });
    expect(mitDazu(tage, g, { davor: 1, danach: 0 })).toEqual({
      von: '2026-11-29',
      bis: '2026-12-31',
      davor: 1,
      danach: 0,
    });
    // Der 25.11. ist ausgeblendet: zwei davor sind der 29. und der 22.11.
    expect(mitDazu(tage, g, { davor: 2, danach: 2 })).toEqual({
      von: '2026-11-22',
      bis: '2027-01-10',
      davor: 2,
      danach: 2,
    });
  });

  it('gibt es weniger als verlangt, kommen die vorhandenen dazu', () => {
    expect(mitDazu(tage, g, { davor: 5, danach: 0 })).toMatchObject({
      von: '2026-11-22',
      davor: 2,
    });
  });

  it('aus dem Gerät: ＋ bleibt erhalten, Unsinn darin fällt weg', () => {
    expect(zeitraumAus({ ...dez, dazu: { davor: 1, danach: 0 } })).toEqual({
      ...dez,
      dazu: { davor: 1, danach: 0 },
    });
    expect(zeitraumAus({ ...dez, dazu: { davor: -3, danach: 'x' } })).toEqual(dez);
  });
});
