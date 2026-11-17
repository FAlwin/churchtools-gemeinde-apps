import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import type { Person } from '../organigramm/mitglieder';
import { entwurfVeraltet, ortSchluessel, type Entwurf, type EntwurfZiel } from './entwuerfe';
import { planAus, terminStand, type Plan, type PlanGruppe } from './plan';
import { abwesenheitenAus, type GruppenStand, type PersonenDaten } from './personenDaten';
import { offenText, personenRaster, plaetzeZelleText, type EntwurfSuche } from './personenRaster';
import { gezeigteGruppen } from './planFilter';
import { termineAus, type RohTermin } from './termine';

/**
 * Tests gegen die Erzeuger: Der Plan kommt aus `planAus` mit rohen Terminen, die Abwesenheiten aus `abwesenheitenAus`
 * mit rohen Antworten – keine handgeschriebenen Endstrukturen.
 *
 * Dienste: Gitarre (Musik, Gruppe 100), Gesang (Musik, Gruppe 90), Ton (Technik, Gruppe 7), Café (Café, fünf Gruppen).
 */
const GITARRE = 10;
const GESANG = 9;
const TON = 6;
const CAFE = 20;
const DIENSTE = diensteAus([
  { id: TON, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
  { id: GITARRE, name: 'Gitarre', serviceGroupId: 4, groupIds: [100], sortKey: 2 },
  { id: GESANG, name: 'Gesang', serviceGroupId: 4, groupIds: [90], sortKey: 3 },
  { id: CAFE, name: 'Café', serviceGroupId: 5, groupIds: [47, 49], sortKey: 4 },
]);
const GRUPPEN = [
  { id: 3, name: 'Technik', fuerAlle: false },
  { id: 4, name: 'Musik', fuerAlle: false },
  { id: 5, name: 'Café', fuerAlle: false },
];

const T1 = '2026-12-06T08:00:00Z';
const T2 = '2026-12-09T17:00:00Z';
const T3 = '2026-12-13T08:00:00Z';

const termin = (id: number, startDate: string, eventServices: object[], extra = {}): RohTermin => ({
  id,
  name: id === 2 ? 'Gebetsabend' : 'Gottesdienst',
  startDate,
  endDate: startDate.replace('T08:00', 'T10:00').replace('T17:00', 'T18:30'),
  eventServices,
  ...extra,
});
const frei = (serviceId: number, index: number | null = null) => ({
  serviceId,
  personId: null,
  name: null,
  index,
});
const platz = (
  serviceId: number,
  personId: number | null,
  name: string,
  isAccepted = true,
  index: number | null = null,
) => ({ serviceId, personId, name, isAccepted, index });

function planDaraus(roh: RohTermin[]): Plan {
  return planAus(roh, {
    ichId: 1,
    dienste: DIENSTE,
    dienstgruppen: GRUPPEN,
    zeitzone: 'Europe/Berlin',
    planbar: () => true,
    ganzSichtbar: () => true,
  });
}

const person = (id: number, name: string): Person => ({
  id,
  name,
  bild: null,
  initialen: name
    .split(' ')
    .map((w) => w[0])
    .join(''),
});
const da = (
  mitglieder: Person[] | 'verborgen',
  abwesenheiten: Extract<GruppenStand, { art: 'da' }>['abwesenheiten'] = [],
): GruppenStand => ({ art: 'da', mitglieder, abwesenheiten });
const abwesend = (id: number, personId: number, von: string, bis: string, extra = {}) => ({
  id,
  person: { domainIdentifier: String(personId) },
  absenceReason: { nameTranslated: 'Urlaub' },
  startDate: von,
  endDate: bis,
  ...extra,
});

const ANNA = person(5, 'Anna Gans');
const BEN = person(8, 'Ben Kunz');
const CLARA = person(11, 'Clara Neu');
const DANIEL = person(12, 'Daniel Fink');

/** Ein Plan mit drei Terminen (Sonntag, Mittwoch, Sonntag) und je Dienst ein paar Plätzen. */
const ROH: RohTermin[] = [
  termin(1, T1, [
    platz(GITARRE, 12, 'Daniel Fink'), // Daniel: Gitarre UND Gesang am selben Tag
    platz(GESANG, 12, 'Daniel Fink', false),
    platz(GESANG, 5, 'Anna Gans'),
    platz(TON, 8, 'Ben Kunz'), // Ben ist Gesang-Mitglied, an diesem Tag aber im Ton (Technik)
    frei(CAFE, 1),
    frei(CAFE, 2),
  ]),
  termin(2, T2, [
    platz(GITARRE, 12, 'Daniel Fink'),
    platz(GESANG, null, 'Gastsängerin'),
    platz(GESANG, -2, 'Geheim Person'),
    frei(TON),
  ]),
  termin(3, T3, [platz(GESANG, 5, 'Anna Gans', false), frei(GITARRE)], { isCanceled: true }),
];
const PLAN = planDaraus(ROH);
const ALLE_SPALTEN = [0, 1, 2];
const ALLE_GRUPPEN = PLAN.gruppen;

const DATEN: PersonenDaten = new Map<number, GruppenStand>([
  [100, da([DANIEL, person(2, 'Eva Hell')])], // Gitarre
  [90, da([ANNA, BEN, DANIEL, CLARA])], // Gesang
  [7, da([BEN])], // Technik
  [47, da([CLARA])],
  [49, da([CLARA, ANNA])], // Clara steht in beiden Café-Gruppen
]);

/** Freie Plätze eines Termins über Gruppen – aus `terminStand`, der Zahl der Matrix (abgesagte Termine zählen nicht). */
const freiUeber = (gruppen: PlanGruppe[], spalte: number) =>
  PLAN.spalten[spalte].abgesagt ? 0 : (terminStand(gruppen, spalte)?.frei ?? 0);

const block = (r: ReturnType<typeof personenRaster>, dienst: number) =>
  r.blocks.find((b) => b.dienst.id === dienst)!;
const zeile = (r: ReturnType<typeof personenRaster>, dienst: number, personId: number) =>
  block(r, dienst).zeilen.find((z) => z.personId === personId)!;

describe('personenRaster – Blöcke und Zeilen', () => {
  it('ein Block je Dienst in der Reihenfolge der Matrix; Zeilen alphabetisch', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(r.blocks.map((b) => b.dienst.name)).toEqual(['Ton', 'Gitarre', 'Gesang', 'Café']);
    expect(block(r, GESANG).zeilen.map((z) => z.name)).toEqual([
      'Anna Gans',
      'Ben Kunz',
      'Clara Neu',
      'Daniel Fink',
    ]);
  });

  it('ein Mitglied ohne Einsatz hat eine Zeile mit leeren Zellen und 0 Einsätzen', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    const eva = zeile(r, GITARRE, 2);
    expect(eva.mitglied).toBe(true);
    expect(eva.einsaetze).toBe(0);
    expect(eva.zellen.every((z) => z.zustand === null && z.weitere.length === 0)).toBe(true);
  });

  it('wer eingeteilt, aber kein Mitglied ist, bekommt trotzdem eine Zeile', () => {
    const ohneMitglieder: PersonenDaten = new Map([
      [90, da([ANNA])], // Daniel steht im Plan, aber nicht in der Gruppe
    ]);
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: ohneMitglieder,
    });
    const daniel = zeile(r, GESANG, 12);
    expect(daniel.mitglied).toBe(false);
    expect(daniel.initialen).toBe('DF');
    expect(daniel.zellen[0].zustand).toBe('angefragt');
  });

  it('Einsätze = zugesagt + angefragt dieser Person in diesem Dienst, in den gezeigten Terminen', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(zeile(r, GESANG, 5).einsaetze).toBe(2); // Anna: zugesagt am 06.12., angefragt am 13.12.
    expect(zeile(r, GITARRE, 12).einsaetze).toBe(2);
    expect(zeile(r, GESANG, 12).einsaetze).toBe(1);
    const nurErster = personenRaster({
      plan: PLAN,
      spalten: [0],
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(zeile(nurErster, GESANG, 5).einsaetze).toBe(1);
  });

  it('der Zustand der Zelle: zugesagt oder angefragt', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(zeile(r, GESANG, 5).zellen.map((z) => z.zustand)).toEqual([
      'zugesagt',
      null,
      'angefragt',
    ]);
  });

  it('Café hängt an mehreren CT-Gruppen: die Mitglieder werden zusammengeführt, jede Person einmal', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(block(r, CAFE).zeilen.map((z) => z.personId)).toEqual([5, 11]); // Anna, Clara – Clara nur einmal
    expect(block(r, CAFE).gruppenIds).toEqual([47, 49]);
  });

  it('ein Dienst ohne Platz an den gezeigten Terminen bekommt keinen Block', () => {
    // Nur der Mittwoch: Café hat dort keine Plätze.
    const r = personenRaster({ plan: PLAN, spalten: [1], gruppen: ALLE_GRUPPEN, daten: DATEN });
    expect(r.blocks.map((b) => b.dienst.name)).toEqual(['Ton', 'Gitarre', 'Gesang']);
  });

  it('nur die gezeigten Gruppen bekommen Blöcke', () => {
    const musik = PLAN.gruppen.filter((g) => g.gruppe?.id === 4);
    const r = personenRaster({ plan: PLAN, spalten: ALLE_SPALTEN, gruppen: musik, daten: DATEN });
    expect(r.blocks.map((b) => b.dienst.name)).toEqual(['Gitarre', 'Gesang']);
  });
});

describe('personenRaster – zweiter Dienst am Tag', () => {
  it('eine Person in zwei Diensten: zwei Zeilen, „auch …“ unter dem Namen und „+ …“ am selben Tag', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    const gitarre = zeile(r, GITARRE, 12);
    const gesang = zeile(r, GESANG, 12);
    expect(gitarre.auch).toEqual(['Gesang']);
    expect(gesang.auch).toEqual(['Gitarre']);
    // Am 06.12. in beiden Diensten: in jeder Zeile steht der andere als „+ …“.
    expect(gitarre.zellen[0].weitere).toEqual([{ dienst: 'Gesang', fremd: false, gruppe: null }]);
    expect(gesang.zellen[0].weitere).toEqual([{ dienst: 'Gitarre', fremd: false, gruppe: null }]);
    // Am 09.12. nur Gitarre: in der Gesang-Zeile steht trotzdem „+ Gitarre“, mit leerer Zelle.
    expect(gesang.zellen[1].zustand).toBeNull();
    expect(gesang.zellen[1].weitere.map((w) => w.dienst)).toEqual(['Gitarre']);
    // Wer nur in einem Dienst Mitglied ist, hat kein „auch“.
    expect(zeile(r, GITARRE, 2).auch).toEqual([]); // Eva
  });

  it('„auch …“ nennt nur gezeigte Dienste', () => {
    const nurGesang = PLAN.gruppen.filter((g) => g.gruppe?.id === 4);
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: nurGesang.map((g) => ({
        ...g,
        zeilen: g.zeilen.filter((z) => z.dienst.id === GESANG),
      })),
      daten: DATEN,
    });
    expect(zeile(r, GESANG, 12).auch).toEqual([]);
  });

  it('ein Dienst aus einer ausgeblendeten Gruppe: „+ Ton (Technik)“, als fremd gekennzeichnet', () => {
    const ohneTechnik = PLAN.gruppen.filter((g) => g.gruppe?.id !== 3);
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ohneTechnik,
      daten: DATEN,
    });
    const ben = zeile(r, GESANG, 8);
    expect(ben.zellen[0].zustand).toBeNull();
    expect(ben.zellen[0].weitere).toEqual([{ dienst: 'Ton', fremd: true, gruppe: 'Technik' }]);
    // Mit der Gruppe sichtbar ist es ein gewöhnliches „+ Ton“.
    const mit = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(zeile(mit, GESANG, 8).zellen[0].weitere).toEqual([
      { dienst: 'Ton', fremd: false, gruppe: null },
    ]);
  });
});

describe('personenRaster – ein einzeln ausgeblendeter Dienst (Wunsch 10)', () => {
  /** Gesang (Musik) ausblenden – Gitarre derselben Gruppe bleibt. Die Gruppen kommen aus `gezeigteGruppen`, wie in „Planen“. */
  const ohneGesang = gezeigteGruppen(PLAN, { gruppen: [], dienste: [GESANG] });
  const r = personenRaster({
    plan: PLAN,
    spalten: ALLE_SPALTEN,
    gruppen: ohneGesang,
    daten: DATEN,
  });

  it('kein Block für den Dienst, die Gruppe bleibt', () => {
    expect(r.blocks.map((b) => b.dienst.id)).not.toContain(GESANG);
    expect(r.blocks.map((b) => b.dienst.id)).toContain(GITARRE);
  });

  it('am selben Tag: „+ Gesang“, blass – ohne Gruppenzusatz, weil die Gruppe gezeigt wird', () => {
    // Daniel steht am ersten Termin in Gitarre UND Gesang.
    expect(zeile(r, GITARRE, 12).zellen[0].weitere).toEqual([
      { dienst: 'Gesang', fremd: true, gruppe: null },
    ]);
  });

  it('ist die ganze Gruppe aus, steht der Gruppenzusatz wie bisher', () => {
    const ohneTechnik = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: gezeigteGruppen(PLAN, { gruppen: ['3'], dienste: [] }),
      daten: DATEN,
    });
    expect(zeile(ohneTechnik, GESANG, 8).zellen[0].weitere).toEqual([
      { dienst: 'Ton', fremd: true, gruppe: 'Technik' },
    ]);
  });

  it('„Noch offen“ und Termin-Stand zählen ohne den Dienst – dieselben Plätze', () => {
    const mit = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(r.offen.every((o) => o.dienste.every((d) => d.dienst !== 'Gesang'))).toBe(true);
    ALLE_SPALTEN.forEach((i, pos) => {
      const summe = r.offen[pos].dienste.reduce((n, d) => n + d.anzahl, 0);
      expect(summe).toBe(freiUeber(ohneGesang, i));
    });
    // Gegenprobe: Mit allen Gruppen stehen weiter dieselben Dienste da wie vorher.
    expect(mit.blocks.map((b) => b.dienst.id)).toContain(GESANG);
  });
});

describe('personenRaster – Abwesenheiten', () => {
  const mitAbwesenheit = (roh: object[]): PersonenDaten =>
    new Map<number, GruppenStand>([
      [100, da([DANIEL])],
      [90, da([ANNA, BEN, DANIEL, CLARA], abwesenheitenAus(roh))],
    ]);

  it('eine mehrtägige Abwesenheit, die vor dem Zeitraum beginnt, deckt den ersten Termin ab', () => {
    const roh = [abwesend(1, 5, '2026-11-28', '2026-12-07')];
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: mitAbwesenheit(roh),
    });
    expect(zeile(r, GESANG, 5).zellen.map((z) => z.abwesend)).toEqual([
      { grund: 'Urlaub', von: '2026-11-28', bis: '2026-12-07' },
      null,
      null,
    ]);
  });

  it('ohne Grund steht „Abwesend“; ein Eintrag mit Uhrzeit deckt nur seinen Termin', () => {
    const roh = [
      {
        id: 7,
        person: { domainIdentifier: '11' },
        absenceReason: null,
        startDate: '2026-12-09',
        endDate: '2026-12-09',
        startTime: '2026-12-09T09:00:00Z', // nur der Vormittag – der Gebetsabend (17 Uhr UTC) bleibt frei
        endTime: '2026-12-09T11:00:00Z',
      },
      { id: 8, person: { domainIdentifier: '11' }, startDate: '2026-12-13', endDate: '2026-12-13' },
    ];
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: mitAbwesenheit(roh),
    });
    expect(zeile(r, GESANG, 11).zellen.map((z) => z.abwesend)).toEqual([
      null,
      null,
      { grund: 'Abwesend', von: '2026-12-13', bis: '2026-12-13' },
    ]);
  });

  it('abwesend UND eingeteilt: beides bleibt sichtbar, mit Warnung', () => {
    const roh = [abwesend(1, 5, '2026-12-06', '2026-12-06')];
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: mitAbwesenheit(roh),
    });
    const z = zeile(r, GESANG, 5).zellen[0];
    expect(z.zustand).toBe('zugesagt');
    expect(z.abwesend).toEqual({ grund: 'Urlaub', von: '2026-12-06', bis: '2026-12-06' });
    expect(z.warnung).toBe(true);
    // Nur abwesend, nicht eingeteilt: keine Warnung.
    const frei = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: mitAbwesenheit([abwesend(2, 11, '2026-12-06', '2026-12-06')]),
    });
    expect(zeile(frei, GESANG, 11).zellen[0].warnung).toBe(false);
  });

  it('dieselbe Abwesenheit aus zwei Gruppen zählt einmal, und sie gilt in jedem Dienst der Person', () => {
    const roh = [abwesend(3, 12, '2026-12-09', '2026-12-09')];
    const daten = new Map<number, GruppenStand>([
      [100, da([DANIEL], abwesenheitenAus(roh))],
      [90, da([DANIEL], abwesenheitenAus(roh))],
    ]);
    const r = personenRaster({ plan: PLAN, spalten: ALLE_SPALTEN, gruppen: ALLE_GRUPPEN, daten });
    const urlaub = { grund: 'Urlaub', von: '2026-12-09', bis: '2026-12-09' };
    expect(zeile(r, GITARRE, 12).zellen[1].abwesend).toEqual(urlaub);
    expect(zeile(r, GESANG, 12).zellen[1].abwesend).toEqual(urlaub);
  });

  it('ohne Recht: der Block sagt es, geliefert wird nichts ausgewertet', () => {
    const daten = new Map<number, GruppenStand>([
      [100, da([DANIEL], 'nichtSichtbar')],
      [90, da([ANNA, DANIEL])],
      [7, da([BEN], 'nichtSichtbar')],
    ]);
    const r = personenRaster({ plan: PLAN, spalten: ALLE_SPALTEN, gruppen: ALLE_GRUPPEN, daten });
    expect(block(r, GITARRE).abwesenheit).toBe('nichtSichtbar');
    expect(block(r, GESANG).abwesenheit).toBe('ok');
    expect(block(r, TON).abwesenheit).toBe('nichtSichtbar');
  });

  it('Café mit einer Gruppe mit und einer ohne Recht: „teilweise“', () => {
    const daten = new Map<number, GruppenStand>([
      [47, da([CLARA])],
      [49, da([ANNA], 'nichtSichtbar')],
    ]);
    const r = personenRaster({ plan: PLAN, spalten: ALLE_SPALTEN, gruppen: ALLE_GRUPPEN, daten });
    expect(block(r, CAFE).abwesenheit).toBe('teilweise');
  });
});

describe('personenRaster – Gäste, Verborgene, Fußzeile', () => {
  it('ein Platz mit Namen ohne Person ist ein Gast (Zeile „Gäste“), keine Personenzeile', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(block(r, GESANG).gaeste).toEqual([
      [],
      [
        {
          name: 'Gastsängerin',
          entwurf: false,
          zurueck: false,
          nr: expect.any(Number),
          klick: 'belegt',
        },
      ],
      [],
    ]);
    expect(block(r, GESANG).zeilen.map((z) => z.name)).not.toContain('Gastsängerin');
  });

  it('„Namen verbergen“ zeigt nie einen Namen – weder als Zeile noch als Gast noch gezählt', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(JSON.stringify(r)).not.toContain('Geheim');
  });

  it('„Noch offen“ zählt wie die Matrix: Summe über die gezeigten Dienste = terminStand', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    // 06.12.: Café 2 frei · 09.12.: Ton 1 frei · 13.12. abgesagt (die Matrix sagt dort „abgesagt“, nicht „1 frei“).
    expect(r.offen[0].dienste).toEqual([{ dienst: 'Café', serviceId: CAFE, anzahl: 2 }]);
    expect(r.offen[1].dienste).toEqual([{ dienst: 'Ton', serviceId: TON, anzahl: 1 }]);
    expect(r.offen[2]).toEqual({ abgesagt: true, dienste: [] });
    for (const i of [0, 1]) {
      const summe = r.offen[i].dienste.reduce((n, d) => n + d.anzahl, 0);
      expect(summe).toBe(terminStand(ALLE_GRUPPEN, i)?.frei ?? 0);
    }
  });

  it('„Noch offen“ nur über die gezeigten Gruppen – wie die Matrix (Fund L2)', () => {
    const musik: PlanGruppe[] = PLAN.gruppen.filter((g) => g.gruppe?.id === 4);
    const r = personenRaster({ plan: PLAN, spalten: ALLE_SPALTEN, gruppen: musik, daten: DATEN });
    expect(r.offen[0].dienste).toEqual([]);
    expect(r.offen[1].dienste).toEqual([]);
    expect(terminStand(musik, 0)?.frei).toBe(0);
  });

  it('Zeile „Plätze“ (P2c): belegt von Plätzen – dieselbe Zahl wie „Noch offen“, je Dienst und Termin', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    expect(block(r, CAFE).plaetze).toHaveLength(ALLE_SPALTEN.length);
    // „Noch offen“ und „Plätze“ rechnen eine Zahl: frei je Dienst und Termin stimmt überall überein.
    for (const [pos, o] of r.offen.entries()) {
      for (const b of r.blocks) {
        const offen = o.dienste.find((d) => d.serviceId === b.dienst.id)?.anzahl ?? 0;
        // Abgesagte Termine zählt „Noch offen“ nicht mit (sie sagen „abgesagt“) – die Plätze bleiben, was sie sind.
        if (!o.abgesagt) expect(b.plaetze[pos].frei).toBe(offen);
        expect(b.plaetze[pos].belegt + b.plaetze[pos].frei).toBe(b.plaetze[pos].anzahl);
      }
    }
    expect(block(r, CAFE).plaetze[0].frei).toBe(2);
  });

  it('Zeile „Plätze“: Entwürfe zählen mit; Dienst am Termin nicht vorgesehen: 0 Plätze', () => {
    const p = PLAN.gruppen.flatMap((g) => g.zeilen).find((x) => x.dienst.id === CAFE)!;
    const frei1 = p.zellen[0]!.find((x) => x.art === 'frei')!;
    const e: Entwurf = {
      ort: { eventId: PLAN.spalten[0].id, serviceId: CAFE, index: frei1.index },
      ziel: { art: 'gast', name: 'Onkel Otto' },
      modus: 'anfrage',
      gesehen: frei1.belegung,
      von: { personId: 1, name: 'Alwin' },
      zeit: '2026-11-16T10:00:00Z',
      version: 1,
    };
    const ohne = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    const mit = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
      entwurf: (i, z, pl) =>
        ortSchluessel(e.ort) ===
        ortSchluessel({ eventId: PLAN.spalten[i].id, serviceId: z.dienst.id, index: pl.index })
          ? { entwurf: e, veraltet: entwurfVeraltet(e, pl.belegung) }
          : null,
    });
    expect(block(mit, CAFE).plaetze[0].belegt).toBe(block(ohne, CAFE).plaetze[0].belegt + 1);
    expect(block(mit, CAFE).plaetze[0].anzahl).toBe(block(ohne, CAFE).plaetze[0].anzahl);
    for (const b of ohne.blocks)
      for (const [pos, i] of ALLE_SPALTEN.entries())
        if (
          !PLAN.gruppen.flatMap((g) => g.zeilen).find((x) => x.dienst.id === b.dienst.id)!.zellen[i]
        )
          expect(b.plaetze[pos]).toEqual({ anzahl: 0, belegt: 0, frei: 0 });
  });

  it('Text der Zelle: „2 von 3“, ohne Plätze „aus“', () => {
    expect(plaetzeZelleText({ anzahl: 3, belegt: 2 })).toBe('2 von 3');
    expect(plaetzeZelleText({ anzahl: 3, belegt: 0 })).toBe('0 von 3');
    expect(plaetzeZelleText({ anzahl: 0, belegt: 0 })).toBe('aus');
  });

  it('Text eines roten Tags: Dienstname, bei mehreren mit Zahl', () => {
    expect(offenText({ dienst: 'Gesang', anzahl: 1 })).toBe('Gesang');
    expect(offenText({ dienst: 'Gesang', anzahl: 2 })).toBe('Gesang ×2');
  });
});

describe('personenRaster – Entwürfe', () => {
  const entwurfFuer = (
    ziel: EntwurfZiel,
    ort: { eventId: number; serviceId: number; index: number | null },
  ): Entwurf => ({
    ort,
    ziel,
    modus: 'anfrage',
    gesehen: { art: 'frei' },
    von: { personId: 1, name: 'Alwin' },
    zeit: '2026-12-01T10:00:00Z',
    version: 1,
  });
  /** Wie `entwurfAmPlatz` in „Planen“: der Entwurf am Platz, veraltet, wenn in ChurchTools etwas anderes steht. */
  const suche =
    (liste: Entwurf[]): EntwurfSuche =>
    (i, z, p) => {
      const e = liste.find(
        (x) =>
          ortSchluessel(x.ort) ===
          ortSchluessel({ eventId: PLAN.spalten[i].id, serviceId: z.dienst.id, index: p.index }),
      );
      return e ? { entwurf: e, veraltet: entwurfVeraltet(e, p.belegung) } : null;
    };

  it('ein Entwurf auf einen freien Platz erscheint als „Entwurf“ in der Zeile der Person – und zählt als Einsatz (P2a-2)', () => {
    const e = entwurfFuer(
      { art: 'person', personId: 2, name: 'Eva Hell' },
      { eventId: 3, serviceId: GITARRE, index: null },
    );
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
      entwurf: suche([e]),
    });
    const eva = zeile(r, GITARRE, 2);
    expect(eva.zellen.map((z) => z.zustand)).toEqual([null, null, 'entwurf']);
    // Bis P2a zählte er nicht (nur ChurchTools); seit P2a-2 zählt ein gültiger Entwurf wie das, was er bewirken wird.
    expect(eva.einsaetze).toBe(1);
  });

  it('die Zelle sagt, ob der Entwurf eine Anfrage oder direkt ist (P2m) – ohne Entwurf `null`', () => {
    const anfrage = entwurfFuer(
      { art: 'person', personId: 2, name: 'Eva Hell' },
      { eventId: 3, serviceId: GITARRE, index: null },
    );
    const direkt = { ...anfrage, modus: 'direkt' as const };
    const raster = (e: Entwurf) =>
      personenRaster({
        plan: PLAN,
        spalten: ALLE_SPALTEN,
        gruppen: ALLE_GRUPPEN,
        daten: DATEN,
        entwurf: suche([e]),
      });
    expect(zeile(raster(anfrage), GITARRE, 2).zellen.map((z) => z.modus)).toEqual([
      null,
      null,
      'anfrage',
    ]);
    expect(zeile(raster(direkt), GITARRE, 2).zellen.map((z) => z.modus)).toEqual([
      null,
      null,
      'direkt',
    ]);
  });

  it('ein veralteter Entwurf zählt nicht – am Platz gilt ChurchTools', () => {
    // Der Entwurf wurde auf einen freien Platz gemacht, inzwischen ist dort jemand eingetragen.
    const e = entwurfFuer(
      { art: 'person', personId: 2, name: 'Eva Hell' },
      { eventId: 1, serviceId: GITARRE, index: null },
    );
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
      entwurf: suche([e]),
    });
    expect(zeile(r, GITARRE, 2).zellen[0].zustand).toBeNull();
  });

  it('ein Entwurf auf jemanden ohne Mitgliedschaft legt eine Zeile an; ein Gast-Entwurf steht bei „Gäste“', () => {
    const person = entwurfFuer(
      { art: 'person', personId: 99, name: 'Neu Dabei' },
      { eventId: 3, serviceId: GITARRE, index: null },
    );
    const gast = entwurfFuer(
      { art: 'gast', name: 'Onkel Otto' },
      { eventId: 2, serviceId: TON, index: null },
    );
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
      entwurf: suche([person, gast]),
    });
    expect(zeile(r, GITARRE, 99)).toMatchObject({ mitglied: false, name: 'Neu Dabei' });
    expect(block(r, TON).gaeste[1]).toEqual([
      {
        name: 'Onkel Otto',
        entwurf: true,
        zurueck: false,
        nr: expect.any(Number),
        klick: 'entwurf',
      },
    ]);
  });

  it('ein veralteter „Zurückziehen“-Entwurf (gesehen stimmt nicht mehr) ändert nichts', () => {
    // `gesehen: frei`, in ChurchTools steht Daniel dort – der Entwurf ist veraltet.
    const e = entwurfFuer({ art: 'frei' }, { eventId: 1, serviceId: GITARRE, index: null });
    const ohne = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
    });
    const mit = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
      entwurf: suche([e]),
    });
    expect(mit).toEqual(ohne);
  });
});

describe('personenRaster – Entwürfe zählen mit (P2a-2)', () => {
  const entwurfFuer = (
    ziel: EntwurfZiel,
    eventId: number,
    serviceId: number,
    p: { index: number | null; belegung: Entwurf['gesehen'] },
  ): Entwurf => ({
    ort: { eventId, serviceId, index: p.index },
    ziel,
    modus: 'anfrage',
    gesehen: p.belegung,
    von: { personId: 1, name: 'Alwin' },
    zeit: '2026-12-01T10:00:00Z',
    version: 1,
  });
  const suche =
    (liste: Entwurf[]): EntwurfSuche =>
    (i, z, p) => {
      const e = liste.find(
        (x) =>
          ortSchluessel(x.ort) ===
          ortSchluessel({ eventId: PLAN.spalten[i].id, serviceId: z.dienst.id, index: p.index }),
      );
      return e ? { entwurf: e, veraltet: entwurfVeraltet(e, p.belegung) } : null;
    };
  const rechne = (liste: Entwurf[]) =>
    personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: DATEN,
      entwurf: suche(liste),
    });
  const platzIn = (spalte: number, dienstId: number, name: string) => {
    const z = PLAN.gruppen.flatMap((g) => g.zeilen).find((x) => x.dienst.id === dienstId)!;
    return z.zellen[spalte]!.find((p) => p.name === name)!;
  };
  const freierPlatz = (spalte: number, dienstId: number) => {
    const z = PLAN.gruppen.flatMap((g) => g.zeilen).find((x) => x.dienst.id === dienstId)!;
    return z.zellen[spalte]!.find((p) => p.art === 'frei')!;
  };
  const offenAn = (r: ReturnType<typeof rechne>, spalte: number, dienst: string) =>
    r.offen[spalte].dienste.find((d) => d.dienst === dienst)?.anzahl ?? 0;

  it('Entwurf auf einen freien Platz: „Noch offen“ −1 und „Einsätze“ der Person +1', () => {
    const ohne = rechne([]);
    expect(offenAn(ohne, 0, 'Café')).toBe(2);
    const e = entwurfFuer(
      { art: 'person', personId: 11, name: 'Clara Neu' },
      1,
      CAFE,
      freierPlatz(0, CAFE),
    );
    const mit = rechne([e]);
    expect(offenAn(mit, 0, 'Café')).toBe(1);
    expect(zeile(ohne, CAFE, 11).einsaetze).toBe(0);
    expect(zeile(mit, CAFE, 11).einsaetze).toBe(1);
  });

  it('der letzte freie Platz mit Entwurf: der Dienst verschwindet aus „Noch offen“', () => {
    const p = freierPlatz(1, TON);
    const e = entwurfFuer({ art: 'person', personId: 8, name: 'Ben Kunz' }, 2, TON, p);
    expect(offenAn(rechne([]), 1, 'Ton')).toBe(1);
    expect(offenAn(rechne([e]), 1, 'Ton')).toBe(0);
  });

  it('ein Gast-Entwurf macht den Platz besetzt, zählt aber bei niemandem als Einsatz', () => {
    const e = entwurfFuer({ art: 'gast', name: 'Onkel Otto' }, 1, CAFE, freierPlatz(0, CAFE));
    const mit = rechne([e]);
    expect(offenAn(mit, 0, 'Café')).toBe(1);
    expect(block(mit, CAFE).zeilen.reduce((n, z) => n + z.einsaetze, 0)).toBe(
      block(rechne([]), CAFE).zeilen.reduce((n, z) => n + z.einsaetze, 0),
    );
  });

  it('Zurückziehen eines belegten Platzes: „Noch offen“ +1, „Einsätze“ der bisherigen Person −1', () => {
    const anna = platzIn(0, GESANG, 'Anna Gans');
    const e = entwurfFuer({ art: 'frei' }, 1, GESANG, anna);
    const ohne = rechne([]);
    const mit = rechne([e]);
    expect(offenAn(ohne, 0, 'Gesang')).toBe(0);
    expect(offenAn(mit, 0, 'Gesang')).toBe(1);
    expect(zeile(mit, GESANG, 5).einsaetze).toBe(zeile(ohne, GESANG, 5).einsaetze - 1);
    // Die Zelle zeigt die Einteilung weiter (bis gesendet) – seit P2b als „zurueck“ (rot durchgestrichen, wie die Matrix),
    // gezählt wird sie nicht mehr.
    expect(zeile(ohne, GESANG, 5).zellen[0].zustand).toBe('zugesagt');
    expect(zeile(mit, GESANG, 5).zellen[0].zustand).toBe('zurueck');
  });

  it('Ersetzen: „Noch offen“ bleibt, „Einsätze“ wandern von der alten zur neuen Person', () => {
    const anna = platzIn(0, GESANG, 'Anna Gans');
    const e = entwurfFuer({ art: 'person', personId: 11, name: 'Clara Neu' }, 1, GESANG, anna);
    const ohne = rechne([]);
    const mit = rechne([e]);
    expect(offenAn(mit, 0, 'Gesang')).toBe(offenAn(ohne, 0, 'Gesang'));
    expect(zeile(mit, GESANG, 5).einsaetze).toBe(zeile(ohne, GESANG, 5).einsaetze - 1);
    expect(zeile(mit, GESANG, 11).einsaetze).toBe(zeile(ohne, GESANG, 11).einsaetze + 1);
  });

  it('Zelle „zurueck“ (P2b): ein gültiger Entwurf nimmt die Person am Platz weg – Zurückziehen UND Ersetzen', () => {
    const anna = platzIn(0, GESANG, 'Anna Gans');
    const weg = entwurfFuer({ art: 'frei' }, 1, GESANG, anna);
    const ersetzt = entwurfFuer(
      { art: 'person', personId: 11, name: 'Clara Neu' },
      1,
      GESANG,
      anna,
    );
    expect(zeile(rechne([]), GESANG, 5).zellen[0].zustand).toBe('zugesagt');
    expect(zeile(rechne([weg]), GESANG, 5).zellen[0].zustand).toBe('zurueck');
    expect(zeile(rechne([ersetzt]), GESANG, 5).zellen[0].zustand).toBe('zurueck');
    // Die neue Person steht als Entwurf in ihrer Zeile (wie bisher).
    expect(zeile(rechne([ersetzt]), GESANG, 11).zellen[0].zustand).toBe('entwurf');
    // Andere Termine derselben Person bleiben, wie sie sind.
    expect(zeile(rechne([weg]), GESANG, 5).zellen.slice(1)).toEqual(
      zeile(rechne([]), GESANG, 5).zellen.slice(1),
    );
  });

  it('Zelle „zurueck“: kein Warnfall mehr, auch wenn die Person abwesend ist (eingeteilt + abwesend wäre sonst einer)', () => {
    const anna = platzIn(0, GESANG, 'Anna Gans');
    const weg = entwurfFuer({ art: 'frei' }, 1, GESANG, anna);
    // Anna ist am ersten Termin abwesend (mehrtägig, beginnt davor).
    const urlaub = new Map<number, GruppenStand>([
      [100, da([DANIEL])],
      [
        90,
        da(
          [ANNA, BEN, DANIEL, CLARA],
          abwesenheitenAus([abwesend(1, 5, '2026-11-28', '2026-12-07')]),
        ),
      ],
    ]);
    const rechneMit = (liste: Entwurf[]) =>
      personenRaster({
        plan: PLAN,
        spalten: ALLE_SPALTEN,
        gruppen: ALLE_GRUPPEN,
        daten: urlaub,
        entwurf: suche(liste),
      });
    // Ohne Entwurf: ein Warnfall (abwesend UND eingeteilt) – die Gegenprobe, dass die Daten stimmen.
    expect(zeile(rechneMit([]), GESANG, 5).zellen[0]).toMatchObject({
      zustand: 'zugesagt',
      warnung: true,
    });
    const z = zeile(rechneMit([weg]), GESANG, 5).zellen[0];
    expect(z.zustand).toBe('zurueck');
    expect(z.abwesend).not.toBeNull();
    expect(z.warnung).toBe(false);
  });

  it('ein veralteter Entwurf macht keine „zurueck“-Zelle – dort gilt ChurchTools', () => {
    const anna = platzIn(0, GESANG, 'Anna Gans');
    const alt = entwurfFuer({ art: 'frei' }, 1, GESANG, { ...anna, belegung: { art: 'frei' } });
    expect(zeile(rechne([alt]), GESANG, 5).zellen[0].zustand).toBe('zugesagt');
  });

  it('Gast: ein gültiger Entwurf am Platz → „zurueck“ und Klick „entwurf“, ohne Entwurf „belegt“, veraltet nichts', () => {
    const g = platzIn(1, GESANG, 'Gastsängerin');
    const gastAn = (liste: Entwurf[]) => block(rechne(liste), GESANG).gaeste[1];
    expect(gastAn([])).toMatchObject([{ zurueck: false, klick: 'belegt' }]);
    const weg = entwurfFuer({ art: 'frei' }, 2, GESANG, g);
    expect(gastAn([weg])).toMatchObject([
      { name: 'Gastsängerin', zurueck: true, klick: 'entwurf' },
    ]);
    const alt = entwurfFuer({ art: 'frei' }, 2, GESANG, { ...g, belegung: { art: 'frei' } });
    expect(gastAn([alt])).toMatchObject([{ zurueck: false, klick: null }]);
  });

  it('veraltete Entwürfe zählen nicht – weder „Noch offen“ noch „Einsätze“', () => {
    // Auf einen belegten Platz „gesehen: frei“ (inzwischen belegt) und Zurückziehen auf einen freien Platz.
    const p = platzIn(0, GESANG, 'Anna Gans');
    const veraltetPerson = entwurfFuer(
      { art: 'person', personId: 11, name: 'Clara Neu' },
      1,
      GESANG,
      {
        ...p,
        belegung: { art: 'frei' },
      },
    );
    const veraltetWeg = entwurfFuer({ art: 'frei' }, 1, CAFE, {
      ...freierPlatz(0, CAFE),
      belegung: { art: 'zusage', personId: 11 },
    });
    const ohne = rechne([]);
    const mit = rechne([veraltetPerson, veraltetWeg]);
    expect(mit.offen).toEqual(ohne.offen);
    expect(zeile(mit, GESANG, 5).einsaetze).toBe(zeile(ohne, GESANG, 5).einsaetze);
    expect(zeile(mit, GESANG, 11).einsaetze).toBe(zeile(ohne, GESANG, 11).einsaetze);
  });

  it('„Noch offen“ summiert wie der Termin-Kopf der Matrix (`terminStand` mit denselben Entwürfen)', () => {
    const liste = [
      entwurfFuer(
        { art: 'person', personId: 11, name: 'Clara Neu' },
        1,
        CAFE,
        freierPlatz(0, CAFE),
      ),
      entwurfFuer({ art: 'frei' }, 1, GESANG, platzIn(0, GESANG, 'Anna Gans')),
    ];
    const r = rechne(liste);
    ALLE_SPALTEN.forEach((i) => {
      const summe = r.offen[i].dienste.reduce((n, d) => n + d.anzahl, 0);
      expect(summe).toBe(
        PLAN.spalten[i].abgesagt ? 0 : (terminStand(ALLE_GRUPPEN, i, suche(liste))?.frei ?? 0),
      );
    });
  });
});

describe('personenRaster – Ladezustand der Gruppen', () => {
  it('ein vorübergehender Fehler einer Gruppe steht im Block der Gruppe, der Rest bleibt', () => {
    const daten = new Map<number, GruppenStand>([
      [100, da([DANIEL])],
      [90, { art: 'fehler', text: 'ChurchTools antwortet gerade nicht.', nochmal: true }],
    ]);
    const r = personenRaster({ plan: PLAN, spalten: ALLE_SPALTEN, gruppen: ALLE_GRUPPEN, daten });
    expect(block(r, GESANG).fehler).toEqual({
      gruppenIds: [90],
      text: 'ChurchTools antwortet gerade nicht.',
      nochmal: true,
    });
    expect(block(r, GITARRE).fehler).toBeNull();
    // Die Eingeteilten stehen trotzdem da.
    expect(block(r, GESANG).zeilen.map((z) => z.name)).toEqual(['Anna Gans', 'Daniel Fink']);
  });

  it('Mitglieder nicht sichtbar (403) ist kein Fehler zum Wiederholen', () => {
    const daten = new Map<number, GruppenStand>([[90, da('verborgen')]]);
    const r = personenRaster({ plan: PLAN, spalten: ALLE_SPALTEN, gruppen: ALLE_GRUPPEN, daten });
    expect(block(r, GESANG).mitgliederVerborgen).toBe(true);
    expect(block(r, GESANG).fehler).toBeNull();
  });

  it('noch nichts geladen: nur die Eingeteilten, ohne Hinweise', () => {
    const r = personenRaster({
      plan: PLAN,
      spalten: ALLE_SPALTEN,
      gruppen: ALLE_GRUPPEN,
      daten: new Map(),
    });
    expect(block(r, GESANG).zeilen.map((z) => z.name)).toEqual(['Anna Gans', 'Daniel Fink']);
    expect(block(r, GESANG)).toMatchObject({ fehler: null, abwesenheit: 'ok' });
  });
});

describe('Ende der Spalte – dieselbe Regel wie in der Terminliste', () => {
  it('`PlanSpalte.ende` = `TerminZeile.ende`, auch ohne Ende am Termin', () => {
    const roh = [
      termin(1, T1, []),
      { id: 2, name: 'Ohne Ende', startDate: T2, endDate: T2, eventServices: [] },
      {
        id: 3,
        name: 'Ende vor Beginn',
        startDate: T3,
        endDate: '2026-12-13T07:00:00Z',
        eventServices: [],
      },
    ] as RohTermin[];
    const plan = planDaraus(roh);
    const zeilen = termineAus(roh, {
      ichId: 1,
      dienste: DIENSTE,
      planbar: () => true,
      zeitzone: 'Europe/Berlin',
    });
    expect(plan.spalten.map((s) => s.ende)).toEqual(zeilen.map((z) => z.ende));
    expect(plan.spalten[0].ende).toBe('2026-12-06T10:00:00Z');
    expect(plan.spalten[2].ende).toBe(T3);
  });
});
