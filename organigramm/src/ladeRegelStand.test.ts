import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import {
  GRUNDWERTE,
  sommerferienAus,
  uebergaenge,
  wechselGruppenRegeln,
  wechseljahre,
} from '@shared/organigramm/gruppenwechsel';
import { einrichtungAus, type Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { ladeRegelStand } from './ladeRegelStand';

const E: Einrichtung = einrichtungAus({
  einstellung: {
    ...GRUNDWERTE,
    stufen: [
      { gruppeId: 1, name: 'Schäfchen', abAlter: 4 },
      { gruppeId: 2, name: 'Fische', abAlter: 7 },
      { gruppeId: 3, name: 'Jungschar', abAlter: 10 },
    ],
  },
  bereichGruppeId: 9,
  wechselGruppen: [
    { vonGruppeId: 1, nachGruppeId: 2, gruppeId: 11 },
    { vonGruppeId: 2, nachGruppeId: 3, gruppeId: 12 },
  ],
})!;
const JAHRE = wechseljahre(
  sommerferienAus(
    [
      { titel: 'Sommerferien NRW 2027', beginn: '2027-07-19', ende: '2027-08-31' },
      { titel: 'Sommerferien NRW 2028', beginn: '2028-07-10', ende: '2028-08-22' },
      { titel: 'Sommerferien NRW 2029', beginn: '2029-07-16', ende: '2029-08-28' },
    ],
    GRUNDWERTE.ferienStichwort,
  ),
  GRUNDWERTE,
);
const [U1, U2] = uebergaenge(E.einstellung);
const ROLLEN = { teilnehmer: 1, leiter: 2 };
/** Die Regeln, die „Einrichten“ bis zu diesem Jahr schreiben würde – vom Erzeuger. */
const regeln = (u: typeof U1, bis: number) =>
  wechselGruppenRegeln(
    u,
    JAHRE.filter((j) => j.jahr <= bis),
    ROLLEN,
  );

/** Antwortet je Pfad; ein `Error` wird geworfen. */
const antworten =
  (je: Record<string, unknown>) =>
  <T>(pfad: string): Promise<T> => {
    const a = pfad in je ? je[pfad] : new Error(`unerwartet: ${pfad}`);
    return a instanceof Error ? Promise.reject(a) : Promise.resolve(a as T);
  };
const arten = (r: Awaited<ReturnType<typeof ladeRegelStand>>) =>
  r.art === 'da' ? r.staende.map((s) => [s.jahr, s.stand.art]) : r.art;

describe('ladeRegelStand', () => {
  it('fragt je Wechsel-Gruppe die Regel-Liste; Regeln vom Erzeuger → die Jahre bis dahin sind eingetragen', async () => {
    const pfade: string[] = [];
    const holen = antworten({
      '/dynamicgroups/11/ruleset': regeln(U1, 2028),
      '/dynamicgroups/12/ruleset': regeln(U2, 2028),
    });
    const r = await ladeRegelStand(E, JAHRE, 2027, <T>(p: string) => {
      pfade.push(p);
      return holen<T>(p);
    });
    expect(pfade.sort()).toEqual(['/dynamicgroups/11/ruleset', '/dynamicgroups/12/ruleset']);
    expect(arten(r)).toEqual([
      [2027, 'eingetragen'],
      [2028, 'eingetragen'],
      [2029, 'fehlt'],
    ]);
    expect(r).toMatchObject({ bis: 2028 });
  });

  it('404 = keine Regeln (kein Fehler): alle Jahre „fehlt“, die Regeln reichen nur bis vor das nächste Jahr', async () => {
    const holen = antworten({
      '/dynamicgroups/11/ruleset': new ApiError(404, 'dynamic group ruleset 11 not found'),
      '/dynamicgroups/12/ruleset': new ApiError(404, 'dynamic group ruleset 12 not found'),
    });
    const r = await ladeRegelStand(E, JAHRE, 2027, holen);
    expect(arten(r)).toEqual([
      [2027, 'fehlt'],
      [2028, 'fehlt'],
      [2029, 'fehlt'],
    ]);
    expect(r).toMatchObject({ bis: 2026 });
  });

  it('nur in einem Teil der Wechsel-Gruppen → „unvollständig“ mit den fehlenden Übergängen', async () => {
    const holen = antworten({
      '/dynamicgroups/11/ruleset': regeln(U1, 2029),
      '/dynamicgroups/12/ruleset': new ApiError(404, 'not found'),
    });
    const r = await ladeRegelStand(E, JAHRE, 2027, holen);
    expect(r.art === 'da' && r.staende[0]).toEqual({
      jahr: 2027,
      stand: { art: 'unvollstaendig', fehlend: ['Fische → Jungschar'] },
    });
    // Unvollständig ist nicht eingetragen: die Kette bricht am nächsten Jahr ab.
    expect(r).toMatchObject({ bis: 2026 });
  });

  it('ein handgeschriebenes Fenster, das nicht dem Erzeuger entspricht, zählt nicht (gemessen an Gruppe 315)', async () => {
    const handgemacht = [
      {
        shorty: 'handarbeit',
        query: {
          params: {
            filter: {
              and: [
                { '<=': ['2026-11-01', { ct_date: ['now'] }] },
                { '<': [{ ct_date: ['now'] }, '2027-07-01'] },
              ],
            },
          },
        },
      },
    ];
    const holen = antworten({
      '/dynamicgroups/11/ruleset': handgemacht,
      '/dynamicgroups/12/ruleset': handgemacht,
    });
    expect(arten(await ladeRegelStand(E, JAHRE, 2027, holen))).toEqual([
      [2027, 'fehlt'],
      [2028, 'fehlt'],
      [2029, 'fehlt'],
    ]);
  });

  it('401 ist hier KEIN „abgemeldet“ (fehlendes Recht) – nichts wird geworfen, es heißt „nicht prüfbar“', async () => {
    const holen = antworten({
      '/dynamicgroups/11/ruleset': new ApiError(401, 'Unauthorized'),
      '/dynamicgroups/12/ruleset': regeln(U2, 2028),
    });
    await expect(ladeRegelStand(E, JAHRE, 2027, holen)).resolves.toEqual({
      art: 'nichtPruefbar',
    });
  });

  it('403, Netz, 502 → „nicht prüfbar“, keine Abweichung erfunden', async () => {
    for (const x of [
      new ApiError(403, 'Forbidden'),
      new TypeError('Failed to fetch'),
      new ApiError(502, 'Bad Gateway'),
    ]) {
      const holen = antworten({
        '/dynamicgroups/11/ruleset': x,
        '/dynamicgroups/12/ruleset': regeln(U2, 2028),
      });
      expect(await ladeRegelStand(E, JAHRE, 2027, holen)).toEqual({ art: 'nichtPruefbar' });
    }
  });

  it('keine Antwort (null) ist keine leere Regel-Liste → nicht prüfbar', async () => {
    const holen = antworten({
      '/dynamicgroups/11/ruleset': null,
      '/dynamicgroups/12/ruleset': regeln(U2, 2028),
    });
    expect(await ladeRegelStand(E, JAHRE, 2027, holen)).toEqual({ art: 'nichtPruefbar' });
  });

  it('ein Übergang ohne Wechsel-Gruppe wird nicht abgefragt und zählt nicht als fehlend', async () => {
    const ohne: Einrichtung = { ...E, wechselGruppen: [E.wechselGruppen[1]] };
    const pfade: string[] = [];
    const holen = antworten({ '/dynamicgroups/12/ruleset': regeln(U2, 2028) });
    const r = await ladeRegelStand(ohne, JAHRE, 2027, <T>(p: string) => {
      pfade.push(p);
      return holen<T>(p);
    });
    expect(pfade).toEqual(['/dynamicgroups/12/ruleset']);
    expect(arten(r)).toEqual([
      [2027, 'eingetragen'],
      [2028, 'eingetragen'],
      [2029, 'fehlt'],
    ]);
  });

  it('ganz ohne Wechsel-Gruppen gibt es nichts zu prüfen → nicht prüfbar', async () => {
    const holen = antworten({});
    expect(await ladeRegelStand({ ...E, wechselGruppen: [] }, JAHRE, 2027, holen)).toEqual({
      art: 'nichtPruefbar',
    });
  });
});
