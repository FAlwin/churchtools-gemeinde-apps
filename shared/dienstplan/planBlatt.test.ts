import { describe, expect, it } from 'vitest';
import { datumText, tagKurz } from '../ct/datum';
import { diensteAus } from '../ct/dienste';
import type { Zelle } from '../ct/terminBlatt';
import { planAus } from './plan';
import { BEGLEITUNG, EINWEISUNG, LEITUNG, liste } from './personenliste.testutil';
import {
  PERSONEN_TERMINE_MAX,
  PLAN_BLATT_STANDARD,
  planBlatt,
  planBlattWahlAus,
  spanneLang,
  type PlanBlattQuelle,
  type PlanBlattWahl,
} from './planBlatt';
import type { RohTermin } from './termine';
import { werWieOft } from './werWieOft';

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
    const b = planBlatt(QUELLE, PLAN_BLATT_STANDARD);
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
    const b = planBlatt(QUELLE, { was: 'gruppe', gruppe: 3, ansicht: 'termine', seiten: 'seite' });
    expect(b.titel).toBe('Dienstplan Technik');
    expect(b.abschnitte).toHaveLength(1);
    expect(b.abschnitte[0].titel).toBeNull();
    expect(b.dateiname).toBe('Dienstplan Technik 08.11.-22.11.2026');
  });

  it('nur die eingeblendeten Gruppen und gezeigten Termine', () => {
    const b = planBlatt(
      { ...QUELLE, spalten: [1], gruppen: plan.gruppen.slice(1, 2) },
      PLAN_BLATT_STANDARD,
    );
    expect(b.abschnitte.map((a) => a.titel)).toEqual([null]);
    expect(b.abschnitte[0].zeilen).toHaveLength(1);
    expect(b.untertitel).toBe('15. November 2026');
  });

  it('keine Dienste im Zeitraum → Hinweis statt leerer Tabelle', () => {
    const b = planBlatt(QUELLE, {
      was: 'gruppe',
      gruppe: 999,
      ansicht: 'termine',
      seiten: 'seite',
    });
    expect(b.abschnitte).toEqual([]);
    expect(b.leer).toBe('In diesem Zeitraum sind keine Dienste vorgesehen.');
    expect(planBlatt(QUELLE, PLAN_BLATT_STANDARD).leer).toBeNull();
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
      { was: 'gruppe', gruppe: 3, ansicht: 'termine', seiten: 'seite' },
    );
    expect(b.abschnitte[0].kopf).toEqual(['Termin', 'Ton']);
  });

  it('ab sechs Spalten quer – wie die Druckliste', () => {
    expect(planBlatt(QUELLE, PLAN_BLATT_STANDARD).quer).toBe(false);
    const breit = {
      ...QUELLE.plan.gruppen[1],
      zeilen: Array(5).fill(QUELLE.plan.gruppen[1].zeilen[0]),
    };
    expect(planBlatt({ ...QUELLE, gruppen: [breit] }, PLAN_BLATT_STANDARD).quer).toBe(true);
  });

  it('die gemerkte Wahl: neue und alte Formen werden gelesen, „Wir suchen noch“ und Unbekanntes sind der ganze Plan', () => {
    // Erst die Erzeuger: was `planBlatt` annimmt, kommt unverändert zurück.
    const gruppe = { was: 'gruppe', gruppe: 3, ansicht: 'termine', seiten: 'seite' } as const;
    expect(planBlattWahlAus(gruppe)).toEqual(gruppe);
    expect(
      planBlattWahlAus({ was: 'gruppe', gruppe: null, ansicht: 'termine', seiten: 'seite' }),
    ).toEqual({
      was: 'gruppe',
      gruppe: null,
      ansicht: 'termine',
      seiten: 'seite',
    });
    expect(planBlattWahlAus(PLAN_BLATT_STANDARD)).toEqual(PLAN_BLATT_STANDARD);
    // Bis E8-2 gemerkt: `art` statt `was`, keine Ansicht.
    expect(planBlattWahlAus({ art: 'plan' })).toEqual(PLAN_BLATT_STANDARD);
    expect(planBlattWahlAus({ art: 'gruppe', gruppe: 7 })).toEqual({
      was: 'gruppe',
      gruppe: 7,
      ansicht: 'termine',
      seiten: 'seite',
    });
    // Gestrichen und Unbekanntes.
    expect(planBlattWahlAus({ art: 'suchen' })).toEqual(PLAN_BLATT_STANDARD);
    expect(planBlattWahlAus({ was: 'gruppe', gruppe: 'x' })).toEqual(PLAN_BLATT_STANDARD);
    expect(planBlattWahlAus({ was: 'gruppe' })).toEqual(PLAN_BLATT_STANDARD);
    expect(planBlattWahlAus({ was: 'kalender', ansicht: 'kalender' })).toEqual(PLAN_BLATT_STANDARD);
    expect(planBlattWahlAus(null)).toEqual(PLAN_BLATT_STANDARD);
    expect(planBlattWahlAus('suchen')).toEqual(PLAN_BLATT_STANDARD);
  });

  it('die gemerkte Ansicht: „personen“ und „person“ bleiben, Unbekanntes ist „Termine“ (E8-4b/c)', () => {
    const personen = { was: 'plan', ansicht: 'personen', seiten: 'seite' } as const;
    expect(planBlattWahlAus(personen)).toEqual(personen);
    expect(
      planBlattWahlAus({ was: 'gruppe', gruppe: 3, ansicht: 'personen', seiten: 'seite' }),
    ).toEqual({
      was: 'gruppe',
      gruppe: 3,
      ansicht: 'personen',
      seiten: 'seite',
    });
    expect(
      planBlattWahlAus({ was: 'gruppe', gruppe: null, ansicht: 'personen', seiten: 'seite' }),
    ).toEqual({
      was: 'gruppe',
      gruppe: null,
      ansicht: 'personen',
      seiten: 'seite',
    });
    // Unbekanntes und die alte Form ohne Ansicht.
    expect(planBlattWahlAus({ was: 'plan', ansicht: 7 })).toEqual(PLAN_BLATT_STANDARD);
    expect(planBlattWahlAus({ art: 'plan' })).toEqual(PLAN_BLATT_STANDARD);
  });

  it('„Je Person“ und die Seiten werden gelesen (E8-4c); fehlend oder Unbekanntes ist „seite“', () => {
    const alle = { was: 'plan', ansicht: 'person', seiten: 'alle' } as const;
    expect(planBlattWahlAus(alle)).toEqual(alle);
    const gruppe = { was: 'gruppe', gruppe: 3, ansicht: 'person', seiten: 'alle' } as const;
    expect(planBlattWahlAus(gruppe)).toEqual(gruppe);
    // Die Seiten bleiben auch bei einer anderen Ansicht erhalten.
    expect(planBlattWahlAus({ was: 'plan', ansicht: 'termine', seiten: 'alle' })).toEqual({
      was: 'plan',
      ansicht: 'termine',
      seiten: 'alle',
    });
    // Ältere gemerkte Formen ohne Seiten, Unbekanntes.
    expect(planBlattWahlAus({ was: 'plan', ansicht: 'person' })).toEqual({
      was: 'plan',
      ansicht: 'person',
      seiten: 'seite',
    });
    expect(planBlattWahlAus({ was: 'plan', ansicht: 'person', seiten: 'x' }).seiten).toBe('seite');
    expect(planBlattWahlAus({ art: 'plan' }).seiten).toBe('seite');
    expect(PLAN_BLATT_STANDARD.seiten).toBe('seite');
  });

  it('spanneLang über den Jahreswechsel', () => {
    expect(spanneLang('2026-12-27', '2027-01-10')).toBe('27. Dezember 2026 – 10. Januar 2027');
  });
});

/** „Personen × Termine“ (E8-4b) – aus echten Plänen (`planAus`), mit eigenen Personen-IDs (`p` oben vergibt überall dieselbe). */
describe('Plan-Blatt: Personen × Termine (E8-4b)', () => {
  const PERSONEN: Record<string, number> = {
    'Wilhelm Brandt': 11,
    'Tobias Hahn': 12,
    'Irene Lang': 13,
    'Ömer Kaya': 14,
    'Nora Nur-Abgesagt': 15,
  };
  const VERBORGEN = -2;
  /** Ein Platz: bekannter Name = Person, unbekannter Name = Gast, `null` = frei, `'?'` = verborgen. */
  const q = (serviceId: number, name: string | null, isAccepted = true) => ({
    id: Math.random(),
    serviceId,
    personId: name === '?' ? VERBORGEN : name ? (PERSONEN[name] ?? null) : null,
    name: name === '?' ? null : name,
    isAccepted,
    index: null,
  });
  const bauePlan = (roh: RohTermin[]) =>
    planAus(roh, {
      ichId: 0,
      dienste: DIENSTE,
      dienstgruppen: GRUPPEN,
      zeitzone: 'Europe/Berlin',
      planbar: () => false,
      ganzSichtbar: () => true,
    });
  const ROH_P = [
    termin(1, '2026-12-06', [
      q(1, 'Wilhelm Brandt'),
      q(6, 'Tobias Hahn'),
      q(7, 'Wilhelm Brandt'),
      q(9, 'Irene Lang', false),
      q(9, 'Zoe Gast'),
      q(9, '?'),
      q(9, null),
    ]),
    termin(2, '2026-12-06', [q(1, 'Ömer Kaya')], { startDate: '2026-12-06T17:00:00Z' }),
    termin(3, '2026-12-13', [q(6, 'Tobias Hahn'), q(7, 'Nora Nur-Abgesagt')], { isCanceled: true }),
    termin(4, '2026-12-16', [q(6, 'Tobias Hahn')]),
  ];
  const planP = bauePlan(ROH_P);
  const QP: PlanBlattQuelle = {
    ...QUELLE,
    plan: planP,
    spalten: planP.spalten.map((_, i) => i),
    gruppen: planP.gruppen,
  };
  const PERSONEN_WAHL: PlanBlattWahl = { was: 'plan', ansicht: 'personen', seiten: 'seite' };
  const zeilen = (b: ReturnType<typeof planBlatt>) => tabelle(b.abschnitte[0].zeilen);

  it('eine Tabelle über alle Gruppen: nur Eingeteilte, alphabetisch, Gast nach Namen, verborgen fehlt', () => {
    const b = planBlatt(QP, PERSONEN_WAHL);
    expect(b.abschnitte).toHaveLength(1);
    expect(b.abschnitte[0].titel).toBeNull();
    expect(b.leer).toBeNull();
    // Ö sortiert „deutsch“ wie O – vor Tobias, nicht hinter Wilhelm. Nora (nur am abgesagten Termin) und „besetzt“ fehlen.
    expect(zeilen(b).map((z) => z[0])).toEqual([
      'Irene Lang',
      'Ömer Kaya',
      'Tobias Hahn',
      'Wilhelm Brandt',
      'Zoe Gast',
    ]);
    expect(JSON.stringify(b)).not.toContain('Nur-Abgesagt');
    expect(JSON.stringify(b)).not.toContain('besetzt');
  });

  it('Spalten: nur Termine, die nicht abgesagt sind; Uhrzeit nur bei Spalten desselben Tags', () => {
    const b = planBlatt(QP, PERSONEN_WAHL);
    const [t1, t2, , t4] = [0, 1, 2, 3].map((i) => planP.spalten[i]);
    expect(planP.spalten[2].abgesagt).toBe(true);
    expect(b.abschnitte[0].kopf).toEqual([
      'Person',
      `${tagKurz(t1.tag)} ${t1.uhrzeit}`,
      `${tagKurz(t2.tag)} ${t2.uhrzeit}`,
      tagKurz(t4.tag),
      'Dienste',
    ]);
    expect(t1.uhrzeit).not.toBe(t2.uhrzeit);
    // Ohne den zweiten Termin am selben Tag steht der Tag allein.
    const einzeln = planBlatt({ ...QP, spalten: [0, 3] }, PERSONEN_WAHL);
    expect(einzeln.abschnitte[0].kopf).toEqual([
      'Person',
      tagKurz(t1.tag),
      tagKurz(t4.tag),
      'Dienste',
    ]);
  });

  it('Zelle: die Dienste mit „, “, angefragt grau; kein Einsatz = leer; letzte Spalte = Anzahl', () => {
    const b = planBlatt(QP, PERSONEN_WAHL);
    const z = (name: string) => b.abschnitte[0].zeilen.find((r) => text(r[0]) === name)!;
    // Wilhelm: Predigt (Programm) und Licht (Technik) am selben Termin, danach nichts.
    expect(z('Wilhelm Brandt').map(text)).toEqual([
      'Wilhelm Brandt',
      'Predigt, Licht',
      '',
      '',
      '2',
    ]);
    expect(z('Tobias Hahn').map(text)).toEqual(['Tobias Hahn', 'Ton', '', 'Ton', '2']);
    expect(z('Zoe Gast').map(text)).toEqual(['Zoe Gast', 'Gesang', '', '', '1']);
    // Angefragt: Dienstname normal, „ (angefragt)“ grau.
    expect(z('Irene Lang')[1].absaetze[0].laeufe).toEqual([
      { text: 'Gesang' },
      { text: ' (angefragt)', stil: 'grau' },
    ]);
    expect(z('Ömer Kaya').map(text)).toEqual(['Ömer Kaya', '', 'Predigt', '', '1']);
  });

  it('Gruppe oder ganzer Plan: bei einer Gruppe nur deren Dienste, Titel und Dateiname', () => {
    const musik = planBlatt(QP, { was: 'gruppe', gruppe: 4, ansicht: 'personen', seiten: 'seite' });
    expect(musik.titel).toBe('Dienstplan Musik');
    expect(zeilen(musik).map((z) => z[0])).toEqual(['Irene Lang', 'Zoe Gast']);
    expect(musik.dateiname).toBe('Dienstplan Musik Personen 06.12.-16.12.2026');
    const ganz = planBlatt(QP, PERSONEN_WAHL);
    expect(ganz.titel).toBe('Dienstplan');
    expect(ganz.dateiname).toBe('Dienstplan Personen 06.12.-16.12.2026');
    expect(ganz.untertitel).toBe(`${spanneLang('2026-12-06', '2026-12-16')} · Personen × Termine`);
    // Die Gruppenzeile des Fensters: nur die übergebenen (eingeblendeten) Gruppen zählen beim ganzen Plan.
    const nurTechnik = planBlatt({ ...QP, gruppen: [planP.gruppen[1]] }, PERSONEN_WAHL);
    expect(zeilen(nurTechnik).map((z) => z[0])).toEqual(['Tobias Hahn', 'Wilhelm Brandt']);
    expect(zeilen(nurTechnik)[1].at(-1)).toBe('1');
  });

  it('niemand eingeteilt → Hinweis; abgesagte und freie Termine zählen nicht', () => {
    const b = planBlatt({ ...QP, spalten: [2] }, PERSONEN_WAHL);
    expect(b.abschnitte).toEqual([]);
    expect(b.leer).toBe('In diesem Zeitraum ist niemand eingeteilt.');
    expect(
      planBlatt(QP, { was: 'gruppe', gruppe: 999, ansicht: 'personen', seiten: 'seite' }).leer,
    ).toBe('In diesem Zeitraum ist niemand eingeteilt.');
  });

  it('ab sechs Spalten quer (Name + Termine + Summe)', () => {
    // Name, 3 Termine, Summe = 5 Spalten
    expect(planBlatt(QP, PERSONEN_WAHL).quer).toBe(false);
    expect(planBlatt({ ...QP, spalten: [0, 1, 3] }, PERSONEN_WAHL).quer).toBe(false);
    const viele = bauePlan(sonntage(4));
    expect(planBlatt(zuQuelle(viele), PERSONEN_WAHL).quer).toBe(true);
  });

  /** n Sonntage ab dem 06.12.2026; Wilhelm immer als Predigt, Tobias nur am letzten. */
  function sonntage(n: number): RohTermin[] {
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.UTC(2026, 11, 6 + 7 * i)).toISOString().slice(0, 10);
      const plaetze = [q(1, 'Wilhelm Brandt')];
      if (i === n - 1) plaetze.push(q(6, 'Tobias Hahn'));
      return termin(100 + i, d, plaetze);
    });
  }
  const zuQuelle = (pl: ReturnType<typeof bauePlan>): PlanBlattQuelle => ({
    ...QUELLE,
    plan: pl,
    spalten: pl.spalten.map((_, i) => i),
    gruppen: pl.gruppen,
  });

  it('bis zu acht Termine eine Tabelle ohne Titel; ab neun in Blöcken mit Zeitraum, Personen und Summe je Block', () => {
    expect(PERSONEN_TERMINE_MAX).toBe(8);
    const acht = planBlatt(zuQuelle(bauePlan(sonntage(8))), PERSONEN_WAHL);
    expect(acht.abschnitte).toHaveLength(1);
    expect(acht.abschnitte[0].titel).toBeNull();
    expect(acht.abschnitte[0].kopf).toHaveLength(10);

    const pl = bauePlan(sonntage(9));
    const b = planBlatt(zuQuelle(pl), PERSONEN_WAHL);
    expect(b.abschnitte).toHaveLength(2);
    expect(b.abschnitte[0].titel).toBe(spanneLang(pl.spalten[0].tag, pl.spalten[7].tag));
    expect(b.abschnitte[1].titel).toBe(spanneLang(pl.spalten[8].tag, pl.spalten[8].tag));
    expect(b.abschnitte[0].kopf).toHaveLength(10);
    expect(b.abschnitte[1].kopf).toHaveLength(3);
    // Block 1: nur Wilhelm (8×); Block 2: Tobias und Wilhelm (je 1×) – Personen und Summe je Block.
    expect(tabelle(b.abschnitte[0].zeilen).map((z) => [z[0], z.at(-1)])).toEqual([
      ['Wilhelm Brandt', '8'],
    ]);
    expect(tabelle(b.abschnitte[1].zeilen).map((z) => [z[0], z.at(-1)])).toEqual([
      ['Tobias Hahn', '1'],
      ['Wilhelm Brandt', '1'],
    ]);
    expect(b.quer).toBe(true);
    expect(b.dateiname).toBe(
      `Dienstplan Personen ${planBlatt(zuQuelle(pl), PLAN_BLATT_STANDARD).dateiname.replace('Dienstplan ', '')}`,
    );
  });

  it('„Termine × Dienste“ bleibt unverändert: abgesagte Spalte steht weiter da', () => {
    const b = planBlatt(QP, { was: 'gruppe', gruppe: 3, ansicht: 'termine', seiten: 'seite' });
    expect(
      tabelle(b.abschnitte[0].zeilen)
        .map((z) => z[0])
        .join('|'),
    ).toContain('(abgesagt)');
  });

  describe('Personenliste (PL-1)', () => {
    // Technik (Gruppe 3): Tobias (11 ist Wilhelm, 12 Tobias) – Ton 6 und Licht 7. Programm (Gruppe 1): Wilhelm in Predigt (1).
    const LISTEN = new Map([
      [
        3,
        liste({
          reihe: [11, 12],
          tags: [BEGLEITUNG, LEITUNG, EINWEISUNG],
          tagsVon: { '6|12': ['b', 'l'], '7|11': ['e'] },
        }),
      ],
    ]);
    const mitListen = { ...QP, personenlisten: LISTEN };
    const namenSpalte = (b: ReturnType<typeof planBlatt>) => zeilen(b).map((z) => z[0]);
    const TECHNIK: PlanBlattWahl = {
      was: 'gruppe',
      gruppe: 3,
      ansicht: 'personen',
      seiten: 'seite',
    };

    it('„Eine Gruppe“: Reihenfolge der gespeicherten Liste (wer fehlt, danach alphabetisch)', () => {
      expect(namenSpalte(planBlatt(mitListen, TECHNIK))).toEqual([
        'Wilhelm Brandt · Einweisung',
        'Tobias Hahn · Begleitung, Leitung',
      ]);
      // Ohne Liste und ohne Reihenfolge: alphabetisch wie bisher.
      expect(namenSpalte(planBlatt(QP, TECHNIK))).toEqual(['Tobias Hahn', 'Wilhelm Brandt']);
      const nurTags = new Map([[3, liste({ tags: [BEGLEITUNG], tagsVon: {} })]]);
      expect(namenSpalte(planBlatt({ ...QP, personenlisten: nurTags }, TECHNIK))).toEqual([
        'Tobias Hahn',
        'Wilhelm Brandt',
      ]);
      // Die Liste einer anderen Gruppe ordnet diese nicht.
      const fremd = new Map([[4, liste({ reihe: [11, 12] })]]);
      expect(namenSpalte(planBlatt({ ...QP, personenlisten: fremd }, TECHNIK))).toEqual([
        'Tobias Hahn',
        'Wilhelm Brandt',
      ]);
    });

    it('„Ganzer Plan“: bleibt alphabetisch, die Tags stehen trotzdem dahinter', () => {
      const b = planBlatt(mitListen, PERSONEN_WAHL);
      expect(namenSpalte(b)).toEqual([
        'Irene Lang',
        'Ömer Kaya',
        'Tobias Hahn · Begleitung, Leitung',
        // Der Tag gilt nur im Licht, Wilhelm steht auch in der Predigt (Programm): Dienst dahinter.
        'Wilhelm Brandt · Einweisung (Licht)',
        'Zoe Gast',
      ]);
    });

    it('Tags: voller Name grau hinter dem Namen, der Name bleibt fett', () => {
      const b = planBlatt(mitListen, TECHNIK);
      const zelle = b.abschnitte[0].zeilen[1][0].absaetze[0].laeufe;
      expect(zelle).toEqual([
        { text: 'Tobias Hahn', stil: 'fett' },
        { text: ' · Begleitung, Leitung', stil: 'grau' },
      ]);
    });

    it('Tags: ein Tag, der für alle ihre gezeigten Dienste gilt, steht ohne Dienst', () => {
      const alle = new Map([
        [3, liste({ tags: [EINWEISUNG], tagsVon: { '6|12': ['e'], '7|11': ['e'] } })],
      ]);
      const b = planBlatt({ ...QP, personenlisten: alle }, TECHNIK);
      expect(namenSpalte(b)).toEqual(['Tobias Hahn · Einweisung', 'Wilhelm Brandt · Einweisung']);
    });

    it('„Je Person“ bleibt unverändert: alphabetisch, ohne Tags', () => {
      const wahlJe = { was: 'plan', ansicht: 'person', seiten: 'seite' } as const;
      const mit = planBlatt(mitListen, wahlJe);
      expect(mit.abschnitte).toEqual(planBlatt(QP, wahlJe).abschnitte);
      expect(JSON.stringify(mit)).not.toContain('Begleitung');
    });
  });
});

/** „Je Person“ (E8-4c) – dieselben echten Pläne (`planAus`) wie oben. */
describe('Plan-Blatt: Je Person (E8-4c)', () => {
  const PERSONEN: Record<string, number> = {
    'Wilhelm Brandt': 11,
    'Tobias Hahn': 12,
    'Irene Lang': 13,
    'Ömer Kaya': 14,
    'Nora Nur-Abgesagt': 15,
  };
  const q = (serviceId: number, name: string | null, isAccepted = true) => ({
    id: Math.random(),
    serviceId,
    personId: name === '?' ? -2 : name ? (PERSONEN[name] ?? null) : null,
    name: name === '?' ? null : name,
    isAccepted,
    index: null,
  });
  const planP = planAus(
    [
      termin(1, '2026-12-06', [
        q(1, 'Wilhelm Brandt'),
        q(6, 'Tobias Hahn'),
        q(7, 'Wilhelm Brandt'),
        q(9, 'Irene Lang', false),
        q(9, 'Zoe Gast'),
        q(9, '?'),
        q(9, null),
      ]),
      termin(2, '2026-12-06', [q(1, 'Ömer Kaya')], { startDate: '2026-12-06T17:00:00Z' }),
      termin(3, '2026-12-13', [q(6, 'Tobias Hahn'), q(7, 'Nora Nur-Abgesagt')], {
        isCanceled: true,
      }),
      termin(4, '2026-12-16', [q(6, 'Tobias Hahn')], { name: 'Gebetsabend' }),
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
  const QP: PlanBlattQuelle = {
    ...QUELLE,
    plan: planP,
    spalten: planP.spalten.map((_, i) => i),
    gruppen: planP.gruppen,
  };
  const wahl = (x: Partial<PlanBlattWahl> = {}): PlanBlattWahl =>
    ({ was: 'plan', ansicht: 'person', seiten: 'seite', ...x }) as PlanBlattWahl;
  const von = (b: ReturnType<typeof planBlatt>, name: string) =>
    b.abschnitte.find((a) => a.titel === name)!;

  it('ein Abschnitt je Person, alphabetisch; Band mit Name und „n Dienste“; Gast nach Namen, verborgen fehlt', () => {
    const b = planBlatt(QP, wahl());
    expect(b.leer).toBeNull();
    expect(b.quer).toBe(false);
    expect(b.abschnitte.map((a) => [a.titel, a.zusatz])).toEqual([
      ['Irene Lang', '1 Dienst'],
      ['Ömer Kaya', '1 Dienst'],
      ['Tobias Hahn', '2 Dienste'],
      ['Wilhelm Brandt', '2 Dienste'],
      ['Zoe Gast', '1 Dienst'],
    ]);
    expect(b.abschnitte.every((a) => a.person && !a.personen)).toBe(true);
    expect(b.abschnitte[0].kopf).toEqual(['Datum', 'Uhrzeit', 'Termin', 'Dienst']);
    expect(JSON.stringify(b)).not.toContain('besetzt');
  });

  it('die Zahl stimmt mit „Wer wie oft?“ überein – dieselbe Zählung', () => {
    const b = planBlatt(QP, wahl());
    const { personen } = werWieOft(planP, {
      spalten: planP.spalten.map((_, i) => i).filter((i) => !planP.spalten[i].abgesagt),
      gruppen: planP.gruppen,
    });
    for (const p of personen)
      expect(von(b, p.name).zusatz).toBe(
        `${p.einsaetze.length} ${p.einsaetze.length === 1 ? 'Dienst' : 'Dienste'}`,
      );
  });

  it('abgesagte Termine fehlen – ihre Person gar nicht erst', () => {
    const b = planBlatt(QP, wahl());
    expect(JSON.stringify(b)).not.toContain('Nur-Abgesagt');
    // Tobias: 06.12. und 16.12., nicht der abgesagte 13.12.
    expect(tabelle(von(b, 'Tobias Hahn').zeilen).map((z) => z[0])).toEqual([
      'So, 06.12.2026',
      'Mi, 16.12.2026',
    ]);
    // Dieselbe Regel wie „Personen“: dieselben Namen.
    const personen = planBlatt(QP, wahl({ ansicht: 'personen' }));
    expect(personen.abschnitte[0].zeilen.map((z) => text(z[0]))).toEqual(
      b.abschnitte.map((a) => a.titel),
    );
  });

  it('Zeilen: Datum mit Jahr, Uhrzeit, Terminname; zwei Dienste am selben Termin in EINER Zeile', () => {
    const b = planBlatt(QP, wahl());
    const wilhelm = von(b, 'Wilhelm Brandt');
    expect(wilhelm.zeilen).toHaveLength(1);
    expect(wilhelm.zeilen[0].map((c) => c.absaetze.length)).toEqual([1, 1, 1, 2]);
    expect(wilhelm.zeilen[0].slice(0, 3).map(text)).toEqual([
      datumText('2026-12-06'),
      planP.spalten[0].uhrzeit,
      'Gottesdienst',
    ]);
    expect(wilhelm.zeilen[0][0].absaetze[0].laeufe[0].stil).toBe('fett');
    expect(wilhelm.zeilen[0][3].absaetze.map((a) => a.laeufe.map((l) => l.text).join(''))).toEqual([
      'Predigt · Programm',
      'Licht · Technik',
    ]);
    expect(tabelle(von(b, 'Tobias Hahn').zeilen)[1][2]).toBe('Gebetsabend');
  });

  it('Gruppenname hinter dem Dienst (grau) nur beim ganzen Plan, nicht bei einer Gruppe', () => {
    const ganz = von(planBlatt(QP, wahl()), 'Tobias Hahn');
    expect(ganz.zeilen[0][3].absaetze[0].laeufe).toEqual([
      { text: 'Ton' },
      { text: ' · Technik', stil: 'grau' },
    ]);
    const technik = planBlatt(QP, wahl({ was: 'gruppe', gruppe: 3 }));
    expect(technik.titel).toBe('Dienstplan Technik');
    expect(von(technik, 'Tobias Hahn').zeilen[0][3].absaetze[0].laeufe).toEqual([{ text: 'Ton' }]);
    // Bei einer Gruppe nur deren Dienste: Wilhelm hat nur noch Licht, nicht Predigt.
    expect(tabelle(von(technik, 'Wilhelm Brandt').zeilen)[0][3]).toBe('Licht');
    expect(technik.abschnitte.map((a) => a.titel)).toEqual(['Tobias Hahn', 'Wilhelm Brandt']);
  });

  it('angefragt: „ (angefragt)“ grau, vor dem Gruppennamen', () => {
    const irene = von(planBlatt(QP, wahl()), 'Irene Lang');
    expect(irene.zeilen[0][3].absaetze[0].laeufe).toEqual([
      { text: 'Gesang' },
      { text: ' (angefragt)', stil: 'grau' },
      { text: ' · Musik', stil: 'grau' },
    ]);
  });

  it('Seiten: „seite“ = jeder außer der ersten Person beginnt neu; „alle“ = zusammenhalten', () => {
    const seite = planBlatt(QP, wahl({ seiten: 'seite' }));
    expect(seite.abschnitte.map((a) => a.neueSeite)).toEqual([undefined, true, true, true, true]);
    expect(seite.abschnitte.some((a) => a.zusammen)).toBe(false);
    const alle = planBlatt(QP, wahl({ seiten: 'alle' }));
    expect(alle.abschnitte.every((a) => a.zusammen === true)).toBe(true);
    expect(alle.abschnitte.some((a) => a.neueSeite)).toBe(false);
  });

  it('Untertitel, Dateiname, Titel; die anderen Ansichten kennen die Seiten-Felder nicht', () => {
    const b = planBlatt(QP, wahl());
    expect(b.untertitel).toBe(`${spanneLang('2026-12-06', '2026-12-16')} · Je Person`);
    expect(b.dateiname).toBe('Dienstplan je Person 06.12.-16.12.2026');
    expect(planBlatt(QP, wahl({ was: 'gruppe', gruppe: 4 })).dateiname).toBe(
      'Dienstplan Musik je Person 06.12.-16.12.2026',
    );
    for (const ansicht of ['termine', 'personen'] as const)
      expect(
        planBlatt(QP, wahl({ ansicht, seiten: 'alle' })).abschnitte.some(
          (a) => a.zusammen || a.neueSeite || a.zusatz,
        ),
      ).toBe(false);
  });

  it('niemand eingeteilt → derselbe Hinweis wie bei „Personen“', () => {
    const b = planBlatt({ ...QP, spalten: [2] }, wahl());
    expect(b.abschnitte).toEqual([]);
    expect(b.leer).toBe('In diesem Zeitraum ist niemand eingeteilt.');
    expect(b.leer).toBe(planBlatt({ ...QP, spalten: [2] }, wahl({ ansicht: 'personen' })).leer);
  });
});
