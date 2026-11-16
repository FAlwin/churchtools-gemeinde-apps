import { describe, expect, it } from 'vitest';
import { diensteAus } from '@shared/ct/dienste';
import { planAus, type Plan } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';
import { daten, entwurf } from './entwurfAnschluss.testutil';
import { katalogAus, plaetzeWeitere, plaetzeZeilen, vorlageFuer } from './planEntwuerfe';

/**
 * Das Plätze-Fach zeigt alle Dienste der Gruppe, auch die ohne Matrixzeile (13.11.2026). Der Plan entsteht wie in der App
 * (`planAus` mit `planbar`/`ganzSichtbar` aus `start.ts`), der Katalog über `katalogAus` – nichts davon von Hand nachgebaut.
 */
const start = (rechte: Partial<ReturnType<typeof startFuer>['rechte']> = {}) =>
  startFuer({
    dienstgruppen: [
      { id: 1, name: 'Programm', fuerAlle: false },
      { id: 3, name: 'Technik', fuerAlle: false },
      { id: 5, name: 'Moderation & Predigt', fuerAlle: false },
    ],
    dienste: diensteAus([
      { id: 1, name: 'Predigt', serviceGroupId: 1, groupIds: [6] },
      { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
      { id: 7, name: 'Licht', serviceGroupId: 3, groupIds: [7], sortKey: 2 },
      { id: 8, name: 'Kamera', serviceGroupId: 3, groupIds: [7], sortKey: 3 },
      { id: 24, name: 'Abendmahl', serviceGroupId: 5, groupIds: [9] },
      { id: 30, name: 'Sonstiges', serviceGroupId: 99, groupIds: [9] },
    ]),
    rechte: {
      planbareDienstgruppen: [3, 5],
      sichtbareDienstgruppen: null,
      ablaufKalender: [],
      terminKalender: [],
      abwesenheitenAller: false,
      ...rechte,
    },
  });

const roh = (admins: number[] = []): RohTermin[] =>
  [
    {
      id: 20,
      name: 'Gottesdienst',
      startDate: '2026-11-08T09:00:00Z',
      endDate: '2026-11-08T10:30:00Z',
      adminIds: admins,
      calendar: { title: 'Gottesdienste', domainIdentifier: '1' },
      eventServices: [
        { serviceId: 6, personId: 5, name: 'Anna Test', isAccepted: true, index: 1 },
        { serviceId: 6, personId: null, name: null, index: 2 },
        { serviceId: 7, personId: null, name: null, index: null },
        { serviceId: 1, personId: null, name: null, index: null },
      ],
    },
  ] as RohTermin[];

const planFuer = (s: ReturnType<typeof start>, admins: number[] = []): Plan =>
  planAus(roh(admins), {
    ichId: s.ichId,
    dienste: s.dienste,
    dienstgruppen: s.dienstgruppen,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => planbar(s, d),
    ganzSichtbar: (d) => ganzSichtbar(s, d),
  });

const gruppe = (plan: Plan, id: number) => plan.gruppen.find((g) => g.gruppe?.id === id)!;

describe('plaetzeZeilen – alle Dienste der Gruppe', () => {
  it('ohne Katalog nur die Dienste mit Matrixzeile (wie bisher)', () => {
    const s = start();
    const plan = planFuer(s);
    const z = plaetzeZeilen(null, plan.spalten[0], 0, gruppe(plan, 3));
    expect(z.map((x) => x.name)).toEqual(['Ton', 'Licht']);
  });

  it('mit Katalog steht auch der Dienst ohne Matrixzeile da – mit 0, in der Reihenfolge der Gemeinde', () => {
    const s = start();
    const plan = planFuer(s);
    // Kamera hat im Zeitraum nirgends einen Platz, die Matrix baut keine Zeile dafür …
    expect(gruppe(plan, 3).zeilen.map((z) => z.dienst.name)).not.toContain('Kamera');
    const z = plaetzeZeilen(null, plan.spalten[0], 0, gruppe(plan, 3), katalogAus(s));
    expect(z.map((x) => [x.name, x.anzahl])).toEqual([
      ['Ton', 2],
      ['Licht', 1],
      ['Kamera', 0],
    ]);
    // … und die Matrix selbst bleibt unverändert aufgeräumt.
    expect(gruppe(plan, 3).zeilen).toHaveLength(2);
  });

  it('die Zahlen der Dienste mit Zeile kommen aus den Zellen (Erzeuger), belegt und Entwürfe inklusive', () => {
    const s = start();
    const plan = planFuer(s);
    const e = daten([entwurf({ ort: { eventId: 20, serviceId: 6, index: 2 } })]);
    const z = plaetzeZeilen(e, plan.spalten[0], 0, gruppe(plan, 3), katalogAus(s));
    for (const zl of gruppe(plan, 3).zeilen) {
      const zelle = zl.zellen[0] ?? [];
      const x = z.find((q) => q.serviceId === zl.dienst.id)!;
      expect(x.anzahl).toBe(zelle.length);
      expect(x.belegt).toBe(zelle.filter((p) => p.art !== 'frei').length);
    }
    expect(z.find((x) => x.name === 'Ton')).toMatchObject({ anzahl: 2, belegt: 1, entwuerfe: 1 });
    expect(z.find((x) => x.name === 'Kamera')).toMatchObject({ belegt: 0, entwuerfe: 0 });
  });

  it('Dienste, die man nicht planen darf, stehen nicht da – auch nicht ohne Zeile', () => {
    const s = start({ planbareDienstgruppen: [5] }); // Technik nicht
    const plan = planFuer(s);
    expect(plaetzeZeilen(null, plan.spalten[0], 0, gruppe(plan, 3), katalogAus(s))).toEqual([]);
  });

  it('als Admin des Termins gilt dieselbe Regel wie in der Matrix: alle ganz sichtbaren Dienste', () => {
    const s = start({ planbareDienstgruppen: [5] });
    const plan = planFuer(s, [s.ichId]);
    const z = plaetzeZeilen(null, plan.spalten[0], 0, gruppe(plan, 3), katalogAus(s));
    expect(z.map((x) => x.name)).toEqual(['Ton', 'Licht', 'Kamera']);
  });

  it('Gruppe, die man nicht ganz sehen darf, bleibt draußen – auch für den Admin des Termins', () => {
    // Technik (3) nicht sichtbar: `planAus` baut keine Zeilen, also gibt es auch keine Gruppe im Plan.
    const s = start({ sichtbareDienstgruppen: [1, 5], planbareDienstgruppen: [5] });
    const plan = planFuer(s, [s.ichId]);
    const k = katalogAus(s);
    expect(plan.gruppen.some((g) => g.gruppe?.id === 3)).toBe(false);
    // „Weitere“ für eine sichtbare Gruppe (Programm hat die Zeile Predigt): Technik-Dienste fehlen dort.
    const w = plaetzeWeitere(null, plan, plan.spalten[0], 0, gruppe(plan, 1), k);
    expect(w.map((x) => x.name)).not.toContain('Kamera');
    expect(w.map((x) => x.name)).not.toContain('Ton');
    expect(w.map((x) => x.name)).toContain('Abendmahl');
  });

  it('Gruppe „Weitere“ (Dienst mit unbekannter Dienstgruppe) wird wie in der Matrix gebildet', () => {
    const s = start({ planbareDienstgruppen: null });
    const plan = planFuer(s);
    const weitere = { gruppe: null, planbar: true, zeilen: [], frei: [] };
    const z = plaetzeZeilen(null, plan.spalten[0], 0, weitere, katalogAus(s));
    expect(z.map((x) => x.name)).toEqual(['Sonstiges']);
  });

  it('plaetzeWeitere: Dienste der übrigen Gruppen, die man planen darf – nie die der eigenen', () => {
    const s = start();
    const plan = planFuer(s);
    const w = plaetzeWeitere(null, plan, plan.spalten[0], 0, gruppe(plan, 3), katalogAus(s));
    expect(w.map((x) => x.name)).toEqual(['Abendmahl']); // Predigt: Programm nicht planbar
    expect(w[0]).toMatchObject({ anzahl: 0, belegt: 0, entwuerfe: 0 });
  });
});

describe('vorlageFuer', () => {
  it('Kalender des Termins + alle Dienstnamen; ohne Kalender nichts', () => {
    const s = start();
    const plan = planFuer(s);
    const laden = () => Promise.resolve([]);
    const v = vorlageFuer(katalogAus(s), plan.spalten[0], laden)!;
    expect(v.kalenderId).toBe(1);
    expect(v.namen.get(24)).toBe('Abendmahl');
    expect(
      vorlageFuer(katalogAus(s), { ...plan.spalten[0], kalender: null }, laden),
    ).toBeUndefined();
  });
});
