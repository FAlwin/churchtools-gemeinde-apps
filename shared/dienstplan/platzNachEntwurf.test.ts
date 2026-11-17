import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import { entwurfVeraltet, ortSchluessel, type Entwurf, type EntwurfZiel } from './entwuerfe';
import { platzPerson } from './fokus';
import {
  gruppenFrei,
  nimmtEintraegeAn,
  planAus,
  terminStand,
  type Plan,
  type PlanPlatz,
} from './plan';
import { gezeigteGruppen } from './planFilter';
import { platzGiltFrei, zaehleFrei, type EntwurfSuche } from './platzNachEntwurf';
import type { RohTermin } from './termine';

/**
 * **Zählen mit Entwürfen** (P2a-2, Alwin 16.11.2026). Tests gegen die Erzeuger: Der Plan kommt aus `planAus` mit rohen
 * Terminen, die Entwürfe sind echte `Entwurf`-Werte, ihre Gültigkeit entscheidet `entwurfVeraltet` wie in „Planen“.
 *
 * Termin 1 (Fr 20.11.): Ton – Anna zugesagt + 1 frei; Gesang – 2 frei.
 * Termin 2 (So 22.11., abgesagt): Ton – 1 frei.
 */
const TON = 6;
const GESANG = 9;
const DIENSTE = diensteAus([
  { id: TON, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
  { id: GESANG, name: 'Gesang', serviceGroupId: 4, groupIds: [90], sortKey: 2 },
]);
const GRUPPEN = [
  { id: 3, name: 'Technik', fuerAlle: false },
  { id: 4, name: 'Musik', fuerAlle: false },
];
const ROH = [
  {
    id: 20,
    name: 'Gottesdienst',
    startDate: '2026-11-20T18:00:00Z',
    endDate: '2026-11-20T19:30:00Z',
    eventServices: [
      { serviceId: TON, personId: 5, name: 'Anna Test', isAccepted: true, index: 1 },
      { serviceId: TON, personId: null, name: null, index: 2 },
      { serviceId: GESANG, personId: null, name: null, index: 1 },
      { serviceId: GESANG, personId: null, name: null, index: 2 },
    ],
  },
  {
    id: 21,
    name: 'Gottesdienst',
    startDate: '2026-11-22T09:00:00Z',
    endDate: '2026-11-22T10:30:00Z',
    isCanceled: true,
    eventServices: [{ serviceId: TON, personId: null, name: null, index: 1 }],
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
const ton = PLAN.gruppen[0].zeilen[0];
const gesang = PLAN.gruppen[1].zeilen[0];
const [belegt, frei] = ton.zellen[0]!;

const entwurfFuer = (
  ziel: EntwurfZiel,
  p: PlanPlatz,
  serviceId = TON,
  gesehen = p.belegung,
): Entwurf => ({
  ort: { eventId: 20, serviceId, index: p.index },
  ziel,
  modus: 'anfrage',
  gesehen,
  von: { personId: 1, name: 'Alwin' },
  zeit: '2026-11-16T10:00:00Z',
  version: 1,
});
/** Wie `entwurfAmPlatz` in „Planen“. */
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
const aufPlatz = (e: Entwurf, p: PlanPlatz) => ({
  entwurf: e,
  veraltet: entwurfVeraltet(e, p.belegung),
});

const EVA: EntwurfZiel = { art: 'person', personId: 2, name: 'Eva Hell' };
const GAST: EntwurfZiel = { art: 'gast', name: 'Onkel Otto' };
const WEG: EntwurfZiel = { art: 'frei' };

describe('platzGiltFrei – die eine Regel „gilt der Platz als frei?“', () => {
  it('ohne Entwurf gilt ChurchTools', () => {
    expect(platzGiltFrei(frei, null)).toBe(true);
    expect(platzGiltFrei(belegt, null)).toBe(false);
  });

  it('Person oder Gast auf einem freien Platz: besetzt', () => {
    expect(platzGiltFrei(frei, aufPlatz(entwurfFuer(EVA, frei), frei))).toBe(false);
    expect(platzGiltFrei(frei, aufPlatz(entwurfFuer(GAST, frei), frei))).toBe(false);
  });

  it('Zurückziehen auf einem belegten Platz: frei', () => {
    expect(platzGiltFrei(belegt, aufPlatz(entwurfFuer(WEG, belegt), belegt))).toBe(true);
  });

  it('eine Person durch eine andere oder einen Gast ersetzen: bleibt besetzt', () => {
    expect(platzGiltFrei(belegt, aufPlatz(entwurfFuer(EVA, belegt), belegt))).toBe(false);
    expect(platzGiltFrei(belegt, aufPlatz(entwurfFuer(GAST, belegt), belegt))).toBe(false);
  });

  it('ein veralteter Entwurf zählt nicht – dort gilt ChurchTools', () => {
    // Eingetragen auf einen freien Platz, inzwischen ist dort jemand: der Entwurf ist veraltet.
    const e = entwurfFuer(EVA, belegt, TON, { art: 'frei' });
    expect(aufPlatz(e, belegt).veraltet).toBe(true);
    expect(platzGiltFrei(belegt, aufPlatz(e, belegt))).toBe(false);
    // Zurückziehen gesehen: Anna – inzwischen ist der Platz in ChurchTools frei geworden.
    const w = entwurfFuer(WEG, frei, TON, belegt.belegung);
    expect(aufPlatz(w, frei).veraltet).toBe(true);
    expect(platzGiltFrei(frei, aufPlatz(w, frei))).toBe(true);
    // Und ein veralteter Entwurf auf einen belegten Platz macht ihn nicht frei.
    const w2 = entwurfFuer(WEG, belegt, TON, { art: 'frei' });
    expect(platzGiltFrei(belegt, aufPlatz(w2, belegt))).toBe(false);
  });

  it('passt zu „wer steht am Platz?“ (`platzPerson`, Fokus): dieselbe Gültigkeitsregel', () => {
    const faelle: { p: PlanPlatz; ziel: EntwurfZiel | null; gesehen?: PlanPlatz }[] = [
      { p: frei, ziel: null },
      { p: belegt, ziel: null },
      { p: frei, ziel: EVA },
      { p: frei, ziel: GAST },
      { p: belegt, ziel: WEG },
      { p: belegt, ziel: EVA },
      { p: belegt, ziel: GAST },
      { p: belegt, ziel: EVA, gesehen: frei }, // veraltet
      { p: frei, ziel: WEG, gesehen: belegt }, // veraltet
    ];
    for (const f of faelle) {
      const e = f.ziel
        ? aufPlatz(entwurfFuer(f.ziel, f.p, TON, (f.gesehen ?? f.p).belegung), f.p)
        : null;
      const giltFrei = platzGiltFrei(f.p, e);
      const wer = platzPerson(f.p, e);
      // Wer als Person am Platz steht, dort ist er nicht frei.
      if (wer) expect(giltFrei).toBe(false);
      // Ein gültiger Entwurf bestimmt beides: Person → besetzt, Zurückziehen → frei und niemand.
      if (e && !e.veraltet && f.ziel?.art === 'person') expect(wer?.personId).toBe(2);
      if (e && !e.veraltet && f.ziel?.art === 'frei') {
        expect(giltFrei).toBe(true);
        expect(wer).toBeNull();
      }
      // Sonst gilt ChurchTools – für beide.
      if (!e || e.veraltet) {
        expect(giltFrei).toBe(f.p.art === 'frei');
        expect(wer === null).toBe(f.p.art === 'frei' || f.p.verborgen || f.p.gast);
      }
    }
  });
});

describe('zaehleFrei, terminStand, gruppenFrei', () => {
  const eva = entwurfFuer(EVA, frei);
  const weg = entwurfFuer(WEG, belegt);

  it('ohne Entwurfs-Suche zählt nur ChurchTools', () => {
    expect(zaehleFrei(ton.zellen[0]!)).toBe(1);
    expect(terminStand(PLAN.gruppen, 0)).toEqual({ plaetze: 4, frei: 3 });
    expect(gruppenFrei(PLAN.gruppen[0], 0)).toBe(1);
  });

  it('ein Entwurf auf einen freien Platz: einer weniger frei – die Platzzahl bleibt', () => {
    const s = suche([eva]);
    expect(terminStand(PLAN.gruppen, 0, s)).toEqual({ plaetze: 4, frei: 2 });
    expect(gruppenFrei(PLAN.gruppen[0], 0, s)).toBe(0);
    expect(gruppenFrei(PLAN.gruppen[1], 0, s)).toBe(2);
  });

  it('Zurückziehen: einer mehr frei; Ersetzen: gleich viele', () => {
    expect(terminStand(PLAN.gruppen, 0, suche([weg]))?.frei).toBe(4);
    expect(gruppenFrei(PLAN.gruppen[0], 0, suche([weg]))).toBe(2);
    const ersetzt = entwurfFuer(EVA, belegt);
    expect(terminStand(PLAN.gruppen, 0, suche([ersetzt]))?.frei).toBe(3);
  });

  it('Entwürfe in einem anderen Dienst und an einem anderen Termin zählen nur dort', () => {
    const gesangEntwurf = entwurfFuer(EVA, gesang.zellen[0]![0], GESANG);
    const s = suche([gesangEntwurf]);
    expect(gruppenFrei(PLAN.gruppen[0], 0, s)).toBe(1);
    expect(gruppenFrei(PLAN.gruppen[1], 0, s)).toBe(1);
    expect(terminStand(PLAN.gruppen, 1, s)).toEqual({ plaetze: 1, frei: 1 });
  });

  it('`null`, wo die Gruppe keinen Dienst hat – auch mit Suche', () => {
    expect(gruppenFrei(PLAN.gruppen[1], 1, suche([eva]))).toBeNull();
    expect(terminStand([PLAN.gruppen[1]], 1, suche([eva]))).toBeNull();
  });

  it('`PlanGruppe.frei` bleibt der Stand in ChurchTools – auch nach dem Filter (Teilen/PDF)', () => {
    expect(PLAN.gruppen[0].frei).toEqual([1, 1]);
    const gezeigt = gezeigteGruppen(PLAN, { gruppen: [], dienste: [] });
    expect(gezeigt[0].frei).toEqual([1, 1]);
    expect(gruppenFrei(gezeigt[0], 0, suche([eva]))).toBe(0);
  });
});

describe('nimmtEintraegeAn', () => {
  it('abgesagte Termine nicht, alle anderen – auch vergangene – schon', () => {
    expect(PLAN.spalten.map(nimmtEintraegeAn)).toEqual([true, false]);
    expect(nimmtEintraegeAn({ abgesagt: false })).toBe(true);
  });
});
