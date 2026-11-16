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
import { ladeRegelAbgleich } from './ladeRegelAbgleich';

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

describe('ladeRegelAbgleich', () => {
  it('fragt je Wechsel-Gruppe die Regel-Liste und findet nichts, wenn alles passt', async () => {
    const pfade: string[] = [];
    const holen = antworten({
      '/dynamicgroups/11/ruleset': regeln(U1, 2028),
      '/dynamicgroups/12/ruleset': regeln(U2, 2028),
    });
    const r = await ladeRegelAbgleich(E, JAHRE, 2028, <T>(p: string) => {
      pfade.push(p);
      return holen<T>(p);
    });
    expect(r).toEqual({ abweichungen: [], nichtPruefbar: [] });
    expect(pfade.sort()).toEqual(['/dynamicgroups/11/ruleset', '/dynamicgroups/12/ruleset']);
  });

  it('meldet Gruppe und Jahr, in der Reihenfolge der Übergänge', async () => {
    const holen = antworten({
      '/dynamicgroups/11/ruleset': regeln(U1, 2027), // 2028 fehlt
      '/dynamicgroups/12/ruleset': regeln(U2, 2028),
    });
    const r = await ladeRegelAbgleich(E, JAHRE, 2028, holen);
    expect(r.abweichungen).toEqual([
      { gruppeId: 11, uebergang: 'Schäfchen → Fische', jahr: 2028, art: 'fehlt' },
    ]);
    expect(r.nichtPruefbar).toEqual([]);
  });

  it('vorübergehender Fehler (Netz, 502, 403) → „nicht prüfbar“, keine Abweichung erfunden', async () => {
    for (const x of [
      new TypeError('Failed to fetch'),
      new ApiError(502, 'Bad Gateway'),
      new ApiError(403, 'Forbidden'),
    ]) {
      const holen = antworten({
        '/dynamicgroups/11/ruleset': x,
        '/dynamicgroups/12/ruleset': regeln(U2, 2028),
      });
      const r = await ladeRegelAbgleich(E, JAHRE, 2028, holen);
      expect(r).toEqual({ abweichungen: [], nichtPruefbar: ['Schäfchen → Fische'] });
    }
  });

  it('keine Antwort (null) ist keine leere Regel-Liste → nicht prüfbar', async () => {
    const holen = antworten({
      '/dynamicgroups/11/ruleset': null,
      '/dynamicgroups/12/ruleset': regeln(U2, 2028),
    });
    expect(await ladeRegelAbgleich(E, JAHRE, 2028, holen)).toEqual({
      abweichungen: [],
      nichtPruefbar: ['Schäfchen → Fische'],
    });
  });

  it('eine leere Regel-Liste ist eine: alle eingetragenen Jahre fehlen', async () => {
    const holen = antworten({
      '/dynamicgroups/11/ruleset': [],
      '/dynamicgroups/12/ruleset': regeln(U2, 2028),
    });
    const r = await ladeRegelAbgleich(E, JAHRE, 2028, holen);
    expect(r.abweichungen.map((a) => [a.jahr, a.art])).toEqual([
      [2027, 'fehlt'],
      [2028, 'fehlt'],
    ]);
  });

  it('abgemeldet (401) wird geworfen', async () => {
    const holen = antworten({
      '/dynamicgroups/11/ruleset': new ApiError(401, 'abgemeldet'),
      '/dynamicgroups/12/ruleset': regeln(U2, 2028),
    });
    await expect(ladeRegelAbgleich(E, JAHRE, 2028, holen)).rejects.toMatchObject({ status: 401 });
  });

  it('ein Übergang ohne Wechsel-Gruppe wird nicht abgefragt', async () => {
    const ohne: Einrichtung = { ...E, wechselGruppen: [E.wechselGruppen[1]] };
    const pfade: string[] = [];
    const holen = antworten({ '/dynamicgroups/12/ruleset': regeln(U2, 2028) });
    await ladeRegelAbgleich(ohne, JAHRE, 2028, <T>(p: string) => {
      pfade.push(p);
      return holen<T>(p);
    });
    expect(pfade).toEqual(['/dynamicgroups/12/ruleset']);
  });
});
