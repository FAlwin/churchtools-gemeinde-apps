import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import type { Zelle } from '../ct/terminBlatt';
import { planAus } from './plan';
import { planBlatt, spanneLang, type PlanBlattQuelle } from './planBlatt';
import type { RohTermin } from './termine';

/** Das Plan-Blatt (E8-2) – aus einem Plan, wie `planAus` ihn aus rohen ChurchTools-Terminen baut. */
const DIENSTE = diensteAus([
  { id: 1, name: 'Predigt', serviceGroupId: 1, groupIds: [6] },
  { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] },
  { id: 7, name: 'Licht', serviceGroupId: 3, groupIds: [7] },
  { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9] },
]);
const GRUPPEN = [
  { id: 1, name: 'Programm', fuerAlle: true },
  { id: 3, name: 'Technik', fuerAlle: true },
  { id: 4, name: 'Musik', fuerAlle: true },
];
const termin = (id: number, tag: string, plaetze: unknown[], x: Partial<RohTermin> = {}) =>
  ({
    id,
    name: 'Gottesdienst',
    startDate: `${tag}T09:00:00Z`,
    endDate: `${tag}T10:30:00Z`,
    eventServices: plaetze,
    ...x,
  }) as unknown as RohTermin;
const p = (
  serviceId: number,
  name: string | null,
  isAccepted = true,
  index: number | null = null,
) => ({
  id: Math.random(),
  serviceId,
  personId: name ? 5 : null,
  name,
  isAccepted,
  index,
});
const ROH = [
  termin(1, '2026-11-08', [
    p(1, 'Wilhelm Brandt'),
    p(6, 'Tobias Hahn'),
    p(7, null),
    p(9, 'Irene Lang', false, 1),
    p(9, null, false, 2),
  ]),
  termin(2, '2026-11-15', [p(1, 'Jakob Weber'), p(6, null), p(7, 'Erik Neumann')]),
  termin(3, '2026-11-22', [p(1, 'Wilhelm Brandt')], { name: 'Gebetsabend' }),
];
const plan = planAus(ROH, {
  ichId: 0,
  dienste: DIENSTE,
  dienstgruppen: GRUPPEN,
  zeitzone: 'Europe/Berlin',
  planbar: () => false,
  ganzSichtbar: () => true,
});
const QUELLE: PlanBlattQuelle = {
  plan,
  spalten: [0, 1, 2],
  gruppen: plan.gruppen,
  gemeinde: 'ECG Donrath',
  app: 'Dienstplaner',
  stand: 'Stand 05.11.2026, 14:00',
};
const text = (c: Zelle) => c.absaetze.map((a) => a.laeufe.map((l) => l.text).join('')).join(' / ');
const tabelle = (zeilen: Zelle[][]) => zeilen.map((z) => z.map(text));

describe('Plan-Blatt (E8-2)', () => {
  it('ganzer Plan: je Gruppe ein Abschnitt mit Titel, nur ihre Termine, Namen, „(angefragt)“, „frei“', () => {
    const b = planBlatt(QUELLE, { art: 'plan' });
    expect(b.titel).toBe('Dienstplan');
    expect(b.untertitel).toBe('8. November – 22. November 2026');
    expect(b.abschnitte.map((a) => [a.titel, a.kopf])).toEqual([
      ['Programm', ['Termin', 'Predigt']],
      // In der Reihenfolge von „Planen“ (`planAus` sortiert die Dienste).
      ['Technik', ['Termin', 'Licht', 'Ton']],
      ['Musik', ['Termin', 'Gesang']],
    ]);
    expect(tabelle(b.abschnitte[1].zeilen)).toEqual([
      ['So, 08.11. 10:00 Gottesdienst', 'frei', 'Tobias Hahn'],
      ['So, 15.11. 10:00 Gottesdienst', 'Erik Neumann', 'frei'],
    ]);
    // Musik nur am 08.11. – eine angefragt, ein Platz frei.
    expect(tabelle(b.abschnitte[2].zeilen)).toEqual([
      ['So, 08.11. 10:00 Gottesdienst', 'Irene Lang (angefragt), frei'],
    ]);
    expect(b.dateiname).toBe('Dienstplan 08.11.-22.11.2026');
  });

  it('nur eine Gruppe: ohne Abschnittstitel, Titel mit Gruppenname', () => {
    const b = planBlatt(QUELLE, { art: 'gruppe', gruppe: 3 });
    expect(b.titel).toBe('Dienstplan Technik');
    expect(b.abschnitte).toHaveLength(1);
    expect(b.abschnitte[0].titel).toBeNull();
    expect(b.dateiname).toBe('Dienstplan Technik 08.11.-22.11.2026');
  });

  it('„Wir suchen noch …“: nur Termine mit freien Plätzen, ohne Namen, mit Anzahl', () => {
    const b = planBlatt(QUELLE, { art: 'suchen' });
    expect(b.titel).toBe('Wir suchen noch …');
    expect(b.oben).toContain('Offene Dienste in Programm, Technik, Musik');
    expect(tabelle(b.abschnitte[0].zeilen)).toEqual([
      ['So, 08.11. 10:00 Gottesdienst', 'Licht, Gesang'],
      ['So, 15.11. 10:00 Gottesdienst', 'Ton'],
    ]);
    expect(JSON.stringify(b)).not.toContain('Tobias Hahn');
  });

  it('nur die eingeblendeten Gruppen und gezeigten Termine', () => {
    const b = planBlatt(
      { ...QUELLE, spalten: [1], gruppen: plan.gruppen.slice(1, 2) },
      { art: 'plan' },
    );
    expect(b.abschnitte.map((a) => a.titel)).toEqual([null]);
    expect(b.abschnitte[0].zeilen).toHaveLength(1);
    expect(b.untertitel).toBe('15. November 2026');
  });

  it('alles besetzt → Hinweis statt leerer Tabelle; abgesagte Termine werden nicht gesucht', () => {
    const voll = planAus([termin(9, '2026-12-06', [p(1, 'Jakob Weber')])], {
      ichId: 0,
      dienste: DIENSTE,
      dienstgruppen: GRUPPEN,
      zeitzone: 'Europe/Berlin',
      planbar: () => false,
      ganzSichtbar: () => true,
    });
    const b = planBlatt(
      { ...QUELLE, plan: voll, spalten: [0], gruppen: voll.gruppen },
      { art: 'suchen' },
    );
    expect(b.abschnitte).toEqual([]);
    expect(b.leer).toContain('Alles besetzt');
    // Ein abgesagter Termin mit freiem Platz wird nicht gesucht.
    const abgesagt = planAus([termin(10, '2026-12-13', [p(6, null)], { isCanceled: true })], {
      ichId: 0,
      dienste: DIENSTE,
      dienstgruppen: GRUPPEN,
      zeitzone: 'Europe/Berlin',
      planbar: () => false,
      ganzSichtbar: () => true,
    });
    expect(
      planBlatt(
        { ...QUELLE, plan: abgesagt, spalten: [0], gruppen: abgesagt.gruppen },
        { art: 'suchen' },
      ).leer,
    ).toContain('Alles besetzt');
  });

  it('keine leeren Spalten: ein Dienst, der an keinem gezeigten Termin vorgesehen ist, fehlt', () => {
    // Licht gibt es nur am 13.12. – gezeigt wird nur der 20.12. (`planAus` legt Zeilen nur für vorkommende Dienste an,
    // darum zwei Termine).
    const zwei = planAus(
      [
        termin(20, '2026-12-13', [p(6, 'Tobias Hahn'), p(7, 'Erik Neumann')]),
        termin(21, '2026-12-20', [p(6, 'Tobias Hahn')]),
      ],
      {
        ichId: 0,
        dienste: DIENSTE,
        dienstgruppen: GRUPPEN,
        zeitzone: 'Europe/Berlin',
        planbar: () => false,
        ganzSichtbar: () => true,
      },
    );
    const b = planBlatt(
      { ...QUELLE, plan: zwei, spalten: [1], gruppen: zwei.gruppen },
      { art: 'gruppe', gruppe: 3 },
    );
    expect(b.abschnitte[0].kopf).toEqual(['Termin', 'Ton']);
  });

  it('ab sechs Spalten quer – wie die Druckliste', () => {
    expect(planBlatt(QUELLE, { art: 'plan' }).quer).toBe(false);
    const breit = {
      ...QUELLE.plan.gruppen[1],
      zeilen: Array(5).fill(QUELLE.plan.gruppen[1].zeilen[0]),
    };
    expect(planBlatt({ ...QUELLE, gruppen: [breit] }, { art: 'plan' }).quer).toBe(true);
  });

  it('spanneLang über den Jahreswechsel', () => {
    expect(spanneLang('2026-12-27', '2027-01-10')).toBe('27. Dezember 2026 – 10. Januar 2027');
  });
});
