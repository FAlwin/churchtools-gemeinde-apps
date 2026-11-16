import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import { planAus, terminStand, type Plan } from './plan';
import {
  dienstAus,
  dienstUmschalten,
  gezeigteGruppen,
  gruppenStand,
  gruppeUmschalten,
  type PlanAus,
} from './planFilter';
import type { RohTermin } from './termine';

/**
 * Tests gegen die Erzeuger (`planAus` mit rohen Terminen). Technik: Ton (6), Bild (7), Licht (8); Musik: Gitarre (10).
 */
const DIENSTE = diensteAus([
  { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
  { id: 7, name: 'Bild', serviceGroupId: 3, groupIds: [7], sortKey: 2 },
  { id: 8, name: 'Licht', serviceGroupId: 3, groupIds: [7], sortKey: 3 },
  { id: 10, name: 'Gitarre', serviceGroupId: 4, groupIds: [100], sortKey: 4 },
]);
const GRUPPEN = [
  { id: 3, name: 'Technik', fuerAlle: false },
  { id: 4, name: 'Musik', fuerAlle: false },
];
const platz = (serviceId: number, personId: number | null, name: string | null, index = 1) => ({
  serviceId,
  personId,
  name,
  isAccepted: true,
  index,
});
const ROH: RohTermin[] = [
  {
    id: 1,
    name: 'Gottesdienst',
    startDate: '2026-12-06T08:00:00Z',
    endDate: '2026-12-06T10:00:00Z',
    eventServices: [
      platz(6, 5, 'Anna'),
      platz(7, null, null, 1), // Bild: zwei freie Plätze
      platz(7, null, null, 2),
      platz(8, null, null), // Licht: einer frei
      platz(10, 12, 'Daniel'),
    ],
  },
  {
    id: 2,
    name: 'Gebetsabend',
    startDate: '2026-12-09T17:00:00Z',
    endDate: '2026-12-09T18:30:00Z',
    eventServices: [platz(10, null, null)], // nur Musik
  },
] as RohTermin[];
const PLAN: Plan = planAus(ROH, {
  ichId: 1,
  dienste: DIENSTE,
  dienstgruppen: GRUPPEN,
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
});
const NICHTS: PlanAus = { gruppen: [], dienste: [] };
const technik = PLAN.gruppen.find((g) => g.gruppe?.id === 3)!;
const namen = (g: { zeilen: { dienst: { name: string } }[] }) => g.zeilen.map((z) => z.dienst.name);

describe('gezeigteGruppen', () => {
  it('ohne Filter: dieselben Gruppen (dasselbe Objekt), nichts neu gerechnet', () => {
    const g = gezeigteGruppen(PLAN, NICHTS);
    expect(g).toEqual(PLAN.gruppen);
    expect(g[0]).toBe(PLAN.gruppen[0]);
  });

  it('ein ausgeblendeter Dienst fehlt in seiner Gruppe, die Gruppe bleibt', () => {
    const g = gezeigteGruppen(PLAN, { gruppen: [], dienste: [7] });
    expect(g.map((x) => x.gruppe?.name)).toEqual(['Technik', 'Musik']);
    expect(namen(g[0])).toEqual(['Ton', 'Licht']);
    // Musik ist unberührt (dasselbe Objekt).
    expect(g[1]).toBe(PLAN.gruppen[1]);
  });

  it('die freien Plätze der Gruppe zählen ohne den Dienst (dieselbe Summe wie aus den Zeilen)', () => {
    // Technik am Sonntag: Bild 2 + Licht 1 frei = 3; ohne Bild nur Licht = 1. Am Mittwoch hat Technik nichts (null).
    expect(technik.frei).toEqual([3, null]);
    const g = gezeigteGruppen(PLAN, { gruppen: [], dienste: [7] })[0];
    expect(g.frei).toEqual([1, null]);
    // Ein Dienst, der an einem Termin nicht vorgesehen ist, macht die Gruppe dort nicht zu „0 frei“.
    expect(terminStand([g], 0)).toEqual({ plaetze: 2, frei: 1 });
    expect(terminStand([g], 1)).toBeNull();
  });

  it('Termin-Stand (Kopf, Füllbalken, Zettel) zählt ohne ausgeblendete Dienste', () => {
    const alle = terminStand(gezeigteGruppen(PLAN, NICHTS), 0);
    const ohneBild = terminStand(gezeigteGruppen(PLAN, { gruppen: [], dienste: [7] }), 0);
    expect(alle).toEqual({ plaetze: 5, frei: 3 });
    expect(ohneBild).toEqual({ plaetze: 3, frei: 1 });
  });

  it('eine ausgeblendete Gruppe fehlt ganz', () => {
    const g = gezeigteGruppen(PLAN, { gruppen: ['3'], dienste: [] });
    expect(g.map((x) => x.gruppe?.name)).toEqual(['Musik']);
  });

  it('sind alle Dienste einer Gruppe einzeln aus, verhält sie sich wie „Gruppe aus“', () => {
    const einzeln = gezeigteGruppen(PLAN, { gruppen: [], dienste: [6, 7, 8] });
    const ganz = gezeigteGruppen(PLAN, { gruppen: ['3'], dienste: [] });
    expect(einzeln).toEqual(ganz);
    expect(gruppenStand(technik, { gruppen: [], dienste: [6, 7, 8] })).toBe('keine');
  });
});

describe('gruppenStand / dienstAus', () => {
  it('alle, teils, keine', () => {
    expect(gruppenStand(technik, NICHTS)).toBe('alle');
    expect(gruppenStand(technik, { gruppen: [], dienste: [7] })).toBe('teils');
    expect(gruppenStand(technik, { gruppen: ['3'], dienste: [] })).toBe('keine');
  });

  it('ein Dienst ist aus, wenn seine Gruppe aus ist oder er selbst', () => {
    expect(dienstAus(technik, 7, NICHTS)).toBe(false);
    expect(dienstAus(technik, 7, { gruppen: [], dienste: [7] })).toBe(true);
    expect(dienstAus(technik, 6, { gruppen: [], dienste: [7] })).toBe(false);
    expect(dienstAus(technik, 6, { gruppen: ['3'], dienste: [] })).toBe(true);
  });
});

describe('Umschalten im Menü', () => {
  it('Gruppe abhaken: Gruppe aus, ihre Einzelwahl ist aufgehoben', () => {
    expect(gruppeUmschalten(technik, NICHTS)).toEqual({ gruppen: ['3'], dienste: [] });
  });

  it('Gruppe mit Strich antippen: alle Dienste wieder an; Dienste anderer Gruppen bleiben aus', () => {
    expect(gruppeUmschalten(technik, { gruppen: [], dienste: [7, 10] })).toEqual({
      gruppen: [],
      dienste: [10],
    });
  });

  it('Gruppe, die aus ist, antippen: wieder an', () => {
    expect(gruppeUmschalten(technik, { gruppen: ['3'], dienste: [] })).toEqual({
      gruppen: [],
      dienste: [],
    });
  });

  it('Dienst abhaken und wieder anhaken', () => {
    const aus = dienstUmschalten(technik, 7, NICHTS);
    expect(aus).toEqual({ gruppen: [], dienste: [7] });
    expect(dienstUmschalten(technik, 7, aus)).toEqual(NICHTS);
  });

  it('der letzte gezeigte Dienst wird abgehakt: die Gruppe ist aus, nicht „alle einzeln aus“', () => {
    expect(dienstUmschalten(technik, 8, { gruppen: [], dienste: [6, 7] })).toEqual({
      gruppen: ['3'],
      dienste: [],
    });
  });

  it('einen Dienst anhaken, während die Gruppe aus ist: die Gruppe ist an, nur dieser Dienst bleibt', () => {
    const neu = dienstUmschalten(technik, 7, { gruppen: ['3'], dienste: [] });
    expect(neu.gruppen).toEqual([]);
    expect([...neu.dienste].sort()).toEqual([6, 8]);
    expect(namen(gezeigteGruppen(PLAN, neu)[0])).toEqual(['Bild']);
  });
});
