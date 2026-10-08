import { describe, it, expect } from 'vitest';
import { liedStatistik, nutzungAus } from '@shared/ct/liedStatistik';

/**
 * Die Auswertung der ChurchTools-Lied-Statistik (`@shared/ct/liedStatistik`) – für Server und
 * Erweiterung. Die Rohform ist gemessen (08.10.2026): je Arrangement-ID eine Liste
 * `{ date: 'YYYY-MM-DD HH:MM:SS', category_id }`, Ortszeit ohne Zonen-Angabe.
 */
const ZONE = 'Europe/Berlin';
const LIEDER = [
  { id: 1, arrangements: [{ id: 11 }, { id: 12 }] },
  { id: 2, arrangements: [{ id: 21 }] },
];

describe('nutzungAus', () => {
  it('Arrangement → Lied, alle Arrangements eines Lieds zusammen, neuester Tag zuerst', () => {
    const r = nutzungAus(
      {
        '11': [{ date: '2026-06-01 10:00:00' }],
        '12': [{ date: '2026-07-05 10:00:00' }],
        '21': [{ date: '2026-06-14 18:30:00' }],
      },
      LIEDER,
      '2026-10-08',
      ZONE,
    );
    expect(r).toEqual({ 1: { dates: ['2026-07-05', '2026-06-01'] }, 2: { dates: ['2026-06-14'] } });
  });

  it('nur bis heute – ein geplanter Termin ist nicht „gespielt"; heute zählt', () => {
    const r = nutzungAus(
      { '11': [{ date: '2026-10-08 10:00:00' }, { date: '2026-10-11 10:00:00' }] },
      LIEDER,
      '2026-10-08',
      ZONE,
    );
    expect(r[1].dates).toEqual(['2026-10-08']);
  });

  it('kein Rückblick-Limit mehr – auch Einsätze vor vier Jahren zählen', () => {
    const r = nutzungAus({ '21': [{ date: '2019-03-03 10:00:00' }] }, LIEDER, '2026-10-08', ZONE);
    expect(r[2].dates).toEqual(['2019-03-03']);
  });

  it('unbekannte Arrangements und kaputte Einträge fallen weg, statt etwas zu erfinden', () => {
    const r = nutzungAus(
      { '99': [{ date: '2026-06-01 10:00:00' }], '11': [{ date: '' }, {}, null], '21': 'x' },
      LIEDER,
      '2026-10-08',
      ZONE,
    );
    expect(r).toEqual({});
  });

  it('keine lesbare Antwort → leere Statistik', () => {
    expect(nutzungAus(null, LIEDER, '2026-10-08', ZONE)).toEqual({});
    expect(nutzungAus('kaputt', LIEDER, '2026-10-08', ZONE)).toEqual({});
  });
});

describe('liedStatistik', () => {
  it('fragt getSongStatistic ohne Felder, „heute" in der Zeitzone der Gemeinde', async () => {
    const aufrufe: unknown[] = [];
    const port = {
      anfrage: (func: string, felder: Record<string, string>) => {
        aufrufe.push([func, felder]);
        // 22:30 UTC am 08.10. ist in Deutschland schon der 09.10. (00:30) – ein Termin vom 09.10. um
        // 00:15 ist damit schon vorbei und muss zählen, obwohl es in UTC noch der 08.10. ist.
        return Promise.resolve({ '11': [{ date: '2026-10-09 00:15:00' }] });
      },
      fehler: (s: number, m: string) => new Error(`${s} ${m}`),
    };
    const r = await liedStatistik(port, LIEDER, ZONE, new Date('2026-10-08T22:30:00Z'));
    expect(aufrufe).toEqual([['getSongStatistic', {}]]);
    expect(r[1].dates).toEqual(['2026-10-09']);
  });
});
