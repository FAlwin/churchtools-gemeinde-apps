import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { GRUNDWERTE } from '@shared/organigramm/gruppenwechsel';
import { einrichtungAus, type Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import type { RohMitglied } from '@shared/organigramm/mitglieder';
import { ladeFerien, ladeKjDaten } from './ladeKinderJugend';

const KALENDER = [
  { id: 4, name: 'Gemeindeleitung' },
  { id: 6, name: 'Schulferien NRW' },
];
const TERMINE = [
  {
    base: { id: 1, title: 'Sommerferien Nordrhein-Westfalen 2027' },
    calculated: { startDate: '2027-07-19', endDate: '2027-08-31' },
  },
  {
    base: { id: 2, title: 'Herbstferien Nordrhein-Westfalen 2027' },
    calculated: { startDate: '2027-10-11', endDate: '2027-10-23' },
  },
];

/** Antwortet je Pfad – ein `Error` wird geworfen. */
const antworten =
  (je: Record<string, unknown>) =>
  <T>(pfad: string): Promise<T> => {
    const schluessel = Object.keys(je).find((k) => pfad.startsWith(k));
    const a = schluessel === undefined ? new Error(`unerwartet: ${pfad}`) : je[schluessel];
    return a instanceof Error ? Promise.reject(a) : Promise.resolve(a as T);
  };

describe('ladeFerien', () => {
  it('sucht den Kalender nach Namen und liest die Sommerferien als Wechseljahre', async () => {
    const pfade: string[] = [];
    const holen = antworten({ '/calendars/appointments': TERMINE, '/calendars': KALENDER });
    const f = await ladeFerien(GRUNDWERTE, '2026-11-12', <T>(p: string) => {
      pfade.push(p);
      return holen<T>(p);
    });
    expect(f).toEqual({
      art: 'da',
      jahre: [expect.objectContaining({ jahr: 2027, wechseltag: '2027-09-06' })],
    });
    expect(pfade[1]).toBe('/calendars/appointments?calendar_ids[]=6&from=2026-01-01&to=2031-12-31');
  });

  it('Kalender nicht in der Liste (nicht freigegeben) → keinKalender', async () => {
    const holen = antworten({ '/calendars': [{ id: 4, name: 'Gemeindeleitung' }] });
    expect(await ladeFerien(GRUNDWERTE, '2026-11-12', holen)).toEqual({ art: 'keinKalender' });
  });

  it('Termine verboten (403) → keinKalender, nicht „Fehler“', async () => {
    const holen = antworten({
      '/calendars/appointments': new ApiError(403, 'Forbidden to view calendars: [6].'),
      '/calendars': KALENDER,
    });
    expect(await ladeFerien(GRUNDWERTE, '2026-11-12', holen)).toEqual({ art: 'keinKalender' });
  });

  it('vorübergehender Fehler (Netz, 502) → fehler, nicht „kein Kalender“', async () => {
    for (const x of [new TypeError('Failed to fetch'), new ApiError(502, 'Bad Gateway')]) {
      const holen = antworten({ '/calendars': x });
      expect(await ladeFerien(GRUNDWERTE, '2026-11-12', holen)).toEqual({ art: 'fehler' });
    }
  });

  it('abgemeldet (401) wird geworfen', async () => {
    const holen = antworten({ '/calendars': new ApiError(401, 'abgemeldet') });
    await expect(ladeFerien(GRUNDWERTE, '2026-11-12', holen)).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('ladeKjDaten', () => {
  const E: Einrichtung = einrichtungAus({
    einstellung: {
      ...GRUNDWERTE,
      stufen: [
        { gruppeId: 1, name: 'Fische', abAlter: 7 },
        { gruppeId: 2, name: 'Jungschar', abAlter: 10 },
      ],
    },
    bereichGruppeId: 9,
    wechselGruppen: [{ vonGruppeId: 1, nachGruppeId: 2, gruppeId: 12 }],
  })!;
  const LEITER = 48;
  const zeile = (personId: number, status = 'active', rolle = 45): RohMitglied => ({
    personId,
    person: { title: `P ${personId}` },
    groupTypeRoleId: rolle,
    groupMemberStatus: status,
  });
  const mitglieder = (pfad: string): Promise<RohMitglied[]> =>
    pfad === '/groups/1/members'
      ? Promise.resolve([zeile(101), zeile(102), zeile(5, 'active', LEITER)])
      : pfad === '/groups/12/members'
        ? Promise.resolve([zeile(102, 'to_delete')])
        : Promise.reject(new ApiError(403, 'verboten'));
  const istLeitung = (r: number | null) => r === LEITER;

  it('lädt Stufen und Wechsel-Gruppen mit Status und holt die Geburtstage nur der Kinder', async () => {
    const gefragt: number[][] = [];
    const s = await ladeKjDaten(E, istLeitung, mitglieder, (ids) => {
      gefragt.push(ids);
      return Promise.resolve([
        { id: 101, birthday: '2017-09-30T00:00:00Z' },
        { id: 102, birthday: null },
      ]);
    });
    expect(gefragt).toEqual([[101, 102]]);
    if (s.art !== 'da') throw new Error('erwartet: da');
    expect(s.daten.gruppen.get(2)).toEqual({ art: 'verborgen' });
    expect(s.daten.gruppen.get(12)).toEqual({
      art: 'sichtbar',
      mitglieder: [{ personId: 102, name: 'P 102', leitung: false, status: 'to_delete' }],
    });
    expect([...s.daten.geburtstage]).toEqual([
      [101, '2017-09-30'],
      [102, null],
    ]);
  });

  it('scheitern die Geburtstage vorübergehend, scheitert alles – sonst hieße es „Geburtstag fehlt“', async () => {
    const s = await ladeKjDaten(E, istLeitung, mitglieder, () =>
      Promise.reject(new TypeError('Failed to fetch')),
    );
    expect(s).toEqual({ art: 'fehler' });
  });

  it('abgemeldet beim Geburtstag wird geworfen', async () => {
    await expect(
      ladeKjDaten(E, istLeitung, mitglieder, () => Promise.reject(new ApiError(401, 'x'))),
    ).rejects.toMatchObject({ status: 401 });
  });
});
