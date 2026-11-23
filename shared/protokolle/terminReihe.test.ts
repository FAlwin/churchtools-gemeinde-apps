import { describe, expect, it } from 'vitest';
import { eintragVorbelegung } from './termine';
import { einzeltermine, einzelterminBeginn, MAX_EINZELTERMINE, type Reihe } from './terminReihe';
import { WIEDERHOLUNG } from './terminWiederholung';

/**
 * Die Einzeltermine einer Reihe (W15-3). Gerechnet wird auf Kalendertagen in UTC – die Tests laufen darum mit `TZ=UTC` und
 * `TZ=Europe/Berlin` gleich. Die Zahlen unten sind von Hand nachgerechnet (Kalender 2027/2028), nicht aus dem Code.
 */
const reihe = (r: Partial<Reihe>): Reihe => ({
  tag: '2027-02-02',
  art: WIEDERHOLUNG.woechentlich,
  frequenz: 1,
  option: 1,
  wiederBis: '2027-02-23',
  weitere: [],
  ausnahmen: [],
  ...r,
});
const tage = (r: Partial<Reihe>) => einzeltermine(reihe(r)).tage;

describe('einzeltermine: Arten', () => {
  it('ohne Wiederholung genau der Beginn – Weitere/Ausnahmen/Bis zählen dann nicht', () => {
    expect(
      tage({
        art: WIEDERHOLUNG.keine,
        weitere: ['2027-03-01'],
        ausnahmen: ['2027-02-02'],
        wiederBis: '2027-12-31',
      }),
    ).toEqual(['2027-02-02']);
  });

  it('wöchentlich: alle sieben Tage, „Bis“ ist einschließlich', () => {
    expect(tage({})).toEqual(['2027-02-02', '2027-02-09', '2027-02-16', '2027-02-23']);
    expect(tage({ wiederBis: '2027-02-22' })).toEqual(['2027-02-02', '2027-02-09', '2027-02-16']);
  });

  it('wöchentlich alle 2 Wochen', () => {
    expect(tage({ frequenz: 2, wiederBis: '2027-03-16' })).toEqual([
      '2027-02-02',
      '2027-02-16',
      '2027-03-02',
      '2027-03-16',
    ]);
  });

  it('täglich, auch alle 3 Tage und über das Monatsende', () => {
    expect(
      tage({ art: WIEDERHOLUNG.taeglich, tag: '2027-02-26', wiederBis: '2027-03-02' }),
    ).toEqual(['2027-02-26', '2027-02-27', '2027-02-28', '2027-03-01', '2027-03-02']);
    expect(
      tage({ art: WIEDERHOLUNG.taeglich, frequenz: 3, tag: '2027-02-26', wiederBis: '2027-03-05' }),
    ).toEqual(['2027-02-26', '2027-03-01', '2027-03-04']);
  });

  it('„Bis“ vor dem Beginn oder leer: nur der Beginn', () => {
    expect(tage({ wiederBis: '2027-01-01' })).toEqual(['2027-02-02']);
    expect(tage({ wiederBis: '' })).toEqual(['2027-02-02']);
  });

  it('monatlich nach Datum: am selben Tag; den 31. gibt es nicht in jedem Monat – dann fällt der Monat aus', () => {
    expect(
      tage({ art: WIEDERHOLUNG.monatlichDatum, tag: '2027-01-31', wiederBis: '2027-06-30' }),
    ).toEqual(['2027-01-31', '2027-03-31', '2027-05-31']);
    expect(
      tage({ art: WIEDERHOLUNG.monatlichDatum, tag: '2027-01-15', wiederBis: '2027-04-15' }),
    ).toEqual(['2027-01-15', '2027-02-15', '2027-03-15', '2027-04-15']);
  });

  it('monatlich nach Datum, alle 2 Monate und über den Jahreswechsel', () => {
    expect(
      tage({
        art: WIEDERHOLUNG.monatlichDatum,
        frequenz: 2,
        tag: '2027-11-10',
        wiederBis: '2028-05-10',
      }),
    ).toEqual(['2027-11-10', '2028-01-10', '2028-03-10', '2028-05-10']);
  });

  it('monatlich nach Wochentag: der n-te Wochentag (Beginn Do 04.02.2027 = erster Donnerstag)', () => {
    const w = { art: WIEDERHOLUNG.monatlichWochentag, tag: '2027-02-04', wiederBis: '2027-05-31' };
    expect(tage({ ...w, option: 1 })).toEqual([
      '2027-02-04',
      '2027-03-04',
      '2027-04-01',
      '2027-05-06',
    ]);
    // zweiter Donnerstag: Beginn zählt trotzdem mit, danach 11.03., 08.04., 13.05.
    expect(tage({ ...w, option: 2 })).toEqual([
      '2027-02-04',
      '2027-02-11',
      '2027-03-11',
      '2027-04-08',
      '2027-05-13',
    ]);
  });

  it('monatlich nach Wochentag: der fünfte nur, wenn es ihn gibt; 6 = der letzte', () => {
    // Donnerstage: Feb 2027 = 4/11/18/25 (kein fünfter), Mär = 4/11/18/25 (kein fünfter), Apr = 1/8/15/22/29 (fünfter).
    const w = { art: WIEDERHOLUNG.monatlichWochentag, tag: '2027-04-29', wiederBis: '2027-08-31' };
    // Mai 2027: 6/13/20/27 → kein fünfter; Jun: 3/10/17/24 → kein fünfter; Jul: 1/8/15/22/29 → fünfter; Aug: 5/12/19/26.
    expect(tage({ ...w, option: 5 })).toEqual(['2027-04-29', '2027-07-29']);
    expect(tage({ ...w, option: 6 })).toEqual([
      '2027-04-29',
      '2027-05-27',
      '2027-06-24',
      '2027-07-29',
      '2027-08-26',
    ]);
  });

  it('jährlich: gleicher Tag; der 29.02. nur in Schaltjahren', () => {
    expect(
      tage({ art: WIEDERHOLUNG.jaehrlich, tag: '2027-05-01', wiederBis: '2029-05-01' }),
    ).toEqual(['2027-05-01', '2028-05-01', '2029-05-01']);
    expect(
      tage({ art: WIEDERHOLUNG.jaehrlich, tag: '2028-02-29', wiederBis: '2036-12-31' }),
    ).toEqual(['2028-02-29', '2032-02-29', '2036-02-29']);
    expect(
      tage({
        art: WIEDERHOLUNG.jaehrlich,
        frequenz: 2,
        tag: '2027-05-01',
        wiederBis: '2032-01-01',
      }),
    ).toEqual(['2027-05-01', '2029-05-01', '2031-05-01']);
  });

  it('manuell: nur Beginn + weitere Termine (Bis und Alle-x spielen keine Rolle)', () => {
    expect(
      tage({
        art: WIEDERHOLUNG.manuell,
        weitere: ['2027-03-10', '2027-02-20'],
        wiederBis: '2030-01-01',
      }),
    ).toEqual(['2027-02-02', '2027-02-20', '2027-03-10']);
  });
});

describe('einzeltermine: Ausnahmen, weitere Termine, Ordnung', () => {
  it('Ausnahmen fallen weg – auch der Beginn selbst', () => {
    expect(tage({ ausnahmen: ['2027-02-09'] })).toEqual(['2027-02-02', '2027-02-16', '2027-02-23']);
    expect(tage({ ausnahmen: ['2027-02-02'] })).toEqual(['2027-02-09', '2027-02-16', '2027-02-23']);
  });

  it('weitere Termine kommen dazu: sortiert, ohne Doppelte; eine Ausnahme schlägt auch einen weiteren', () => {
    expect(tage({ weitere: ['2027-02-10', '2027-02-09', '2027-01-01'] })).toEqual([
      '2027-01-01',
      '2027-02-02',
      '2027-02-09',
      '2027-02-10',
      '2027-02-16',
      '2027-02-23',
    ]);
    expect(tage({ weitere: ['2027-02-10'], ausnahmen: ['2027-02-10'] })).toEqual([
      '2027-02-02',
      '2027-02-09',
      '2027-02-16',
      '2027-02-23',
    ]);
  });

  it('ein kaputter Beginn gibt keine Zeilen', () => {
    expect(einzeltermine(reihe({ tag: '' }))).toEqual({ tage: [], abgeschnitten: false });
  });
});

describe('einzeltermine: Obergrenze', () => {
  it('höchstens 200 Zeilen, danach „abgeschnitten“ – genau 200 sind noch nicht abgeschnitten', () => {
    const t = einzeltermine(
      reihe({ art: WIEDERHOLUNG.taeglich, tag: '2027-01-01', wiederBis: '2027-12-31' }),
    );
    expect(t.tage).toHaveLength(MAX_EINZELTERMINE);
    expect(t.tage[199]).toBe('2027-07-19');
    expect(t.abgeschnitten).toBe(true);
    const genau = einzeltermine(
      reihe({ art: WIEDERHOLUNG.taeglich, tag: '2027-01-01', wiederBis: '2027-07-19' }),
    );
    expect(genau.tage).toHaveLength(200);
    expect(genau.abgeschnitten).toBe(false);
  });

  it('Jahrzehnte täglicher Termine bleiben schnell und werden abgeschnitten', () => {
    const t = einzeltermine(
      reihe({ art: WIEDERHOLUNG.taeglich, tag: '2027-01-01', wiederBis: '2300-01-01' }),
    );
    expect(t.tage).toHaveLength(MAX_EINZELTERMINE);
    expect(t.abgeschnitten).toBe(true);
  });
});

describe('einzelterminBeginn: exakter UTC-Beginn', () => {
  const ZONE = 'Europe/Berlin';
  it('Winterzeit: 18:00 Ortszeit = 17:00Z; Sommerzeit: 16:00Z', () => {
    expect(einzelterminBeginn({ ganztaegig: false, von: '18:00' }, '2027-02-09', ZONE)).toBe(
      '2027-02-09T17:00:00Z',
    );
    expect(einzelterminBeginn({ ganztaegig: false, von: '18:00' }, '2027-07-13', ZONE)).toBe(
      '2027-07-13T16:00:00Z',
    );
  });

  it('Umstellung: Sommerzeit beginnt am 28.03.2027 (02:00→03:00), endet am 31.10.2027 (03:00→02:00)', () => {
    const b = { ganztaegig: false, von: '10:00' };
    expect(einzelterminBeginn(b, '2027-03-27', ZONE)).toBe('2027-03-27T09:00:00Z');
    expect(einzelterminBeginn(b, '2027-03-28', ZONE)).toBe('2027-03-28T08:00:00Z');
    expect(einzelterminBeginn(b, '2027-10-30', ZONE)).toBe('2027-10-30T08:00:00Z');
    expect(einzelterminBeginn(b, '2027-10-31', ZONE)).toBe('2027-10-31T09:00:00Z');
  });

  it('ganztägig: 00:00 Ortszeit des Tages (gemessen: 10.02.2027 → 2027-02-09T23:00:00Z), egal welche Uhrzeit im Fenster steht', () => {
    expect(einzelterminBeginn({ ganztaegig: true, von: '10:00' }, '2027-02-10', ZONE)).toBe(
      '2027-02-09T23:00:00Z',
    );
    expect(einzelterminBeginn({ ganztaegig: true, von: '10:00' }, '2027-07-10', ZONE)).toBe(
      '2027-07-09T22:00:00Z',
    );
  });

  it('eine Reihe über die Umstellung: jede Zeile hat den Abstand ihres eigenen Tages', () => {
    const r = einzeltermine(
      reihe({ tag: '2027-03-23', wiederBis: '2027-04-06', art: WIEDERHOLUNG.woechentlich }),
    );
    const e = eintragVorbelegung({ text: 'X, 10 Uhr', datum: '2027-03-23' }, 4);
    expect(r.tage.map((t) => einzelterminBeginn(e, t, ZONE))).toEqual([
      '2027-03-23T09:00:00Z',
      '2027-03-30T08:00:00Z',
      '2027-04-06T08:00:00Z',
    ]);
  });
});
