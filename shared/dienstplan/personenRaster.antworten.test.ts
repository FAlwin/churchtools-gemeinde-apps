import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import type { Person } from '../organigramm/mitglieder';
import { planAus, type Plan } from './plan';
import { abwesenheitenAus, type GruppenStand, type PersonenDaten } from './personenDaten';
import { personenRaster } from './personenRaster';
import {
  antwortText,
  flaecheAus,
  zahlenText,
  zellenAntwort,
  type PersonenAntworten,
} from './personenAntworten';
import { antwortBereinigt, type Antworten, type Zusage } from './verfuegbarkeit';
import type { RohTermin } from './termine';

/**
 * E5c-3: Antworten aus „Verfügbarkeit“ in der Ansicht „Personen“. Tests gegen die Erzeuger: Plan aus `planAus`,
 * Abwesenheiten aus `abwesenheitenAus`, Antworten aus `antwortBereinigt` (dieselbe Form wie beim Lesen und Schreiben).
 *
 * Dienste: Gitarre und Gesang (Musik = Dienstgruppe 4), Ton (Technik = 3). Termine 1, 2, 3 (Schlüssel der Antworten = ID als Text).
 */
const GITARRE = 10;
const GESANG = 9;
const TON = 6;
const MUSIK = 4;
const TECHNIK = 3;
const DIENSTE = diensteAus([
  { id: TON, name: 'Ton', serviceGroupId: TECHNIK, groupIds: [7], sortKey: 1 },
  { id: GITARRE, name: 'Gitarre', serviceGroupId: MUSIK, groupIds: [100], sortKey: 2 },
  { id: GESANG, name: 'Gesang', serviceGroupId: MUSIK, groupIds: [90], sortKey: 3 },
]);
const GRUPPEN = [
  { id: TECHNIK, name: 'Technik', fuerAlle: false },
  { id: MUSIK, name: 'Musik', fuerAlle: false },
];
const platz = (serviceId: number, personId: number, name: string) => ({
  serviceId,
  personId,
  name,
  isAccepted: true,
  index: null,
});
const termin = (id: number, start: string, eventServices: object[]): RohTermin => ({
  id,
  name: 'Gottesdienst',
  startDate: start,
  endDate: start.replace('T08:00', 'T10:00'),
  eventServices,
});
const person = (id: number, name: string): Person => ({
  id,
  name,
  bild: null,
  initialen: name
    .split(' ')
    .map((w) => w[0])
    .join(''),
});
const ANNA = person(5, 'Anna Gans');
const BEN = person(8, 'Ben Kunz');
const CLARA = person(11, 'Clara Neu');
const DANIEL = person(12, 'Daniel Fink');
const EVA = person(13, 'Eva Hell');

const PLAN: Plan = planAus(
  [
    // Daniel steht in Gitarre UND Gesang (zwei Blöcke), Ben im Ton.
    termin(1, '2026-12-06T08:00:00Z', [
      platz(GITARRE, 12, 'Daniel Fink'),
      platz(GESANG, 12, 'Daniel Fink'),
      platz(TON, 8, 'Ben Kunz'),
    ]),
    termin(2, '2026-12-13T08:00:00Z', [platz(GESANG, 5, 'Anna Gans')]),
    termin(3, '2026-12-20T08:00:00Z', [platz(GITARRE, 12, 'Daniel Fink')]),
  ],
  {
    ichId: 1,
    dienste: DIENSTE,
    dienstgruppen: GRUPPEN,
    zeitzone: 'Europe/Berlin',
    planbar: () => true,
    ganzSichtbar: () => true,
  },
);

const da = (
  mitglieder: Person[],
  abwesenheiten: Extract<GruppenStand, { art: 'da' }>['abwesenheiten'] = [],
): GruppenStand => ({ art: 'da', mitglieder, abwesenheiten });
const DATEN: PersonenDaten = new Map<number, GruppenStand>([
  [100, da([DANIEL, EVA])],
  [90, da([ANNA, DANIEL, CLARA])],
  [7, da([BEN])],
]);
const urlaub = (id: number, personId: number, tag: string) => ({
  id,
  person: { domainIdentifier: String(personId) },
  absenceReason: { nameTranslated: 'Urlaub' },
  startDate: tag,
  endDate: tag,
});

const a = (z: Zusage, tag: string, extra: { notiz?: string; dienste?: number[] } = {}) =>
  antwortBereinigt({ a: z, tag, ...extra });
const antworten = (
  jePerson: [number, Antworten][],
  sichtbar: number[] = [MUSIK, TECHNIK],
): PersonenAntworten => ({ jePerson: new Map(jePerson), sichtbar: new Set(sichtbar) });

const raster = (
  ant: PersonenAntworten | undefined,
  daten: PersonenDaten = DATEN,
  spalten = [0, 1, 2],
) => personenRaster({ plan: PLAN, spalten, gruppen: PLAN.gruppen, daten, antworten: ant });
const zelle = (r: ReturnType<typeof raster>, dienst: number, personId: number, pos: number) =>
  r.blocks.find((b) => b.dienst.id === dienst)!.zeilen.find((z) => z.personId === personId)!.zellen[
    pos
  ];
const T1 = String(PLAN.spalten[0].id);
const T2 = String(PLAN.spalten[1].id);
const T3 = String(PLAN.spalten[2].id);

describe('Zelle → Antwort: Farbe und Vorrang', () => {
  it('Ja = grün, Vielleicht = gelblich, keine Antwort = weiß; der Schlüssel ist die Termin-ID als Text', () => {
    const r = raster(
      antworten([
        [
          ANNA.id,
          {
            [T1]: a('ja', '2026-12-06'),
            [T2]: a('vielleicht', '2026-12-13'),
          },
        ],
      ]),
    );
    expect(PLAN.spalten.map((s) => String(s.id))).toEqual([T1, T2, T3]);
    expect(zelle(r, GESANG, ANNA.id, 0).flaeche).toBe('ja');
    expect(zelle(r, GESANG, ANNA.id, 1).flaeche).toBe('vielleicht');
    expect(zelle(r, GESANG, ANNA.id, 2).flaeche).toBeNull();
    expect(zelle(r, GESANG, ANNA.id, 2).antwort).toBeNull();
  });

  it('Abwesenheit schlägt eine Ja-Antwort am selben Termin – und die Person zählt im Kopf nicht', () => {
    const daten = new Map(DATEN).set(
      90,
      da([ANNA, DANIEL, CLARA], abwesenheitenAus([urlaub(1, ANNA.id, '2026-12-13')])),
    );
    const ant = antworten([[ANNA.id, { [T2]: a('ja', '2026-12-13') }]]);
    const r = raster(ant, daten);
    const z = zelle(r, GESANG, ANNA.id, 1);
    expect(z.abwesend).not.toBeNull();
    expect(z.flaeche).toBe('nein');
    expect(z.antwort?.a).toBe('ja'); // die Antwort bleibt bekannt (Tooltip) – nur die Fläche gehört der Abwesenheit
    expect(r.antwortZahlen[1]).toEqual({ ja: 0, vielleicht: 0 });
  });

  it('Abwesend ohne Antwort und ohne sichtbare Antworten: trotzdem „nein“ (wie bisher die Schraffur)', () => {
    const daten = new Map(DATEN).set(
      90,
      da([ANNA, DANIEL, CLARA], abwesenheitenAus([urlaub(1, CLARA.id, '2026-12-06')])),
    );
    const z = zelle(raster(undefined, daten), GESANG, CLARA.id, 0);
    expect(z.flaeche).toBe('nein');
    expect(z.antwort).toBeNull();
  });

  it('„nur bestimmte Dienste“: im genannten Dienst gilt sie, in einem anderen bleibt die Zelle weiß – der Text sagt es', () => {
    const ant = antworten([[DANIEL.id, { [T1]: a('ja', '2026-12-06', { dienste: [GESANG] }) }]]);
    const r = raster(ant);
    const gesang = zelle(r, GESANG, DANIEL.id, 0);
    const gitarre = zelle(r, GITARRE, DANIEL.id, 0);
    expect(gesang.flaeche).toBe('ja');
    expect(gitarre.flaeche).toBeNull(); // weiß
    expect(gitarre.antwort).toMatchObject({ a: 'ja', gilt: false, nurFuer: ['Gesang'] });
    expect(antwortText(gitarre.antwort!)).toBe('Ja – nur für Gesang');
  });

  it('ohne „dienste“ (fehlt = alle) gilt sie in jedem Dienst', () => {
    const r = raster(antworten([[DANIEL.id, { [T1]: a('vielleicht', '2026-12-06') }]]));
    expect(zelle(r, GESANG, DANIEL.id, 0).flaeche).toBe('vielleicht');
    expect(zelle(r, GITARRE, DANIEL.id, 0).flaeche).toBe('vielleicht');
  });

  it('die Notiz steht im Text der Zelle', () => {
    const r = raster(
      antworten([[ANNA.id, { [T2]: a('ja', '2026-12-13', { notiz: 'nur bis 12 Uhr' }) }]]),
    );
    expect(antwortText(zelle(r, GESANG, ANNA.id, 1).antwort!)).toBe('Ja – nur bis 12 Uhr');
  });

  it('Antworten einer nicht sichtbaren Dienstgruppe färben nicht – der Block sagt es (nie „keine Antwort“)', () => {
    const ant = antworten(
      [[BEN.id, { [T1]: a('ja', '2026-12-06') }]],
      [MUSIK], // Technik fehlt
    );
    const r = raster(ant);
    const ton = r.blocks.find((b) => b.dienst.id === TON)!;
    expect(ton.antworten).toBe('nichtSichtbar');
    expect(zelle(r, TON, BEN.id, 0).antwort).toBeNull();
    expect(zelle(r, TON, BEN.id, 0).flaeche).toBeNull();
    expect(r.blocks.find((b) => b.dienst.id === GESANG)!.antworten).toBe('ok');
  });

  it('ohne geladene Antworten ist nichts sichtbar', () => {
    const r = raster(undefined);
    expect(r.blocks.every((b) => b.antworten === 'nichtSichtbar')).toBe(true);
    expect(r.antwortZahlen).toEqual([null, null, null]);
  });
});

describe('Spaltenkopf: verschiedene Personen mit Ja / Vielleicht', () => {
  it('eine Person in zwei Blöcken (Daniel: Gitarre und Gesang) zählt einmal', () => {
    const ant = antworten([
      [DANIEL.id, { [T1]: a('ja', '2026-12-06') }],
      [ANNA.id, { [T1]: a('ja', '2026-12-06') }],
      [CLARA.id, { [T1]: a('vielleicht', '2026-12-06') }],
    ]);
    const r = raster(ant);
    // Daniel steht in beiden Musik-Blöcken – im Raster zwei Zeilen, aber eine Person.
    expect(r.blocks.filter((b) => b.zeilen.some((z) => z.personId === DANIEL.id))).toHaveLength(2);
    expect(r.antwortZahlen[0]).toEqual({ ja: 2, vielleicht: 1 });
    expect(zahlenText(r.antwortZahlen[0]!)).toBe('2 ja · 1 vielleicht');
  });

  it('„nur bestimmte Dienste“: im Kopf zählt die Person trotzdem – auch wenn sie in keinem gezeigten Dienst färbt', () => {
    const ant = antworten([[DANIEL.id, { [T1]: a('ja', '2026-12-06', { dienste: [TON] }) }]]);
    const r = raster(ant);
    expect(zelle(r, GESANG, DANIEL.id, 0).flaeche).toBeNull();
    expect(zelle(r, GITARRE, DANIEL.id, 0).flaeche).toBeNull();
    expect(r.antwortZahlen[0]).toEqual({ ja: 1, vielleicht: 0 });
  });

  it('gezählt wird je Termin; Personen ohne Zeile im Raster zählen nicht', () => {
    const ant = antworten([
      [ANNA.id, { [T2]: a('vielleicht', '2026-12-13') }],
      [99, { [T1]: a('ja', '2026-12-06'), [T2]: a('ja', '2026-12-13') }], // niemand im Raster
    ]);
    const r = raster(ant);
    expect(r.antwortZahlen).toEqual([
      { ja: 0, vielleicht: 0 },
      { ja: 0, vielleicht: 1 },
      { ja: 0, vielleicht: 0 },
    ]);
  });

  it('Personen eines Blocks ohne sichtbare Antworten zählen nicht; ist nirgends etwas sichtbar, gibt es keinen Kopf', () => {
    const nurMusik = raster(antworten([[BEN.id, { [T1]: a('ja', '2026-12-06') }]], [MUSIK]));
    expect(nurMusik.antwortZahlen[0]).toEqual({ ja: 0, vielleicht: 0 });
    expect(raster(antworten([], [])).antwortZahlen).toEqual([null, null, null]);
  });
});

describe('„Nur abwesend“ (V-5)', () => {
  const ant = (): PersonenAntworten => ({
    ...antworten([
      [ANNA.id, { [T1]: a('ja', '2026-12-06'), [T2]: a('vielleicht', '2026-12-13') }],
      [BEN.id, { [T1]: a('ja', '2026-12-06') }],
    ]),
    nurAbwesend: new Set([MUSIK]),
  });

  it('die Blöcke der Gruppe zeigen kein Ja/Vielleicht und keinen Hinweis – andere Gruppen wie bisher', () => {
    const r = raster(ant());
    expect(r.blocks.find((b) => b.dienst.id === GESANG)!.antworten).toBe('nurAbwesend');
    expect(r.blocks.find((b) => b.dienst.id === GITARRE)!.antworten).toBe('nurAbwesend');
    expect(zelle(r, GESANG, ANNA.id, 0).antwort).toBeNull();
    expect(zelle(r, GESANG, ANNA.id, 0).flaeche).toBeNull();
    expect(zelle(r, GESANG, ANNA.id, 1).flaeche).toBeNull();
    expect(r.blocks.find((b) => b.dienst.id === TON)!.antworten).toBe('ok');
    expect(zelle(r, TON, BEN.id, 0).flaeche).toBe('ja');
  });

  it('die Abwesenheit zeigt sie weiter („nein“)', () => {
    const daten = new Map(DATEN).set(
      90,
      da([ANNA, DANIEL, CLARA], abwesenheitenAus([urlaub(1, ANNA.id, '2026-12-13')])),
    );
    expect(zelle(raster(ant(), daten), GESANG, ANNA.id, 1).flaeche).toBe('nein');
  });

  it('im Spaltenkopf zählt sie nicht; fragen alle gezeigten Gruppen „Nur abwesend“, gibt es keinen Kopf', () => {
    expect(raster(ant()).antwortZahlen[0]).toEqual({ ja: 1, vielleicht: 0 }); // nur Ben (Technik)
    const alle = { ...ant(), nurAbwesend: new Set([MUSIK, TECHNIK]) };
    expect(raster(alle).antwortZahlen).toEqual([null, null, null]);
  });
});

describe('Bausteine', () => {
  const name = (id: number) => ({ [GESANG]: 'Gesang', [TON]: 'Ton' })[id];
  it('zellenAntwort: unbekannte Dienst-IDs fallen aus der Namensliste, bleiben aber „nur für bestimmte Dienste“', () => {
    const z = zellenAntwort(a('ja', '2026-12-06', { dienste: [999] }), GESANG, name);
    expect(z).toMatchObject({ gilt: false, nurFuer: [] });
    expect(antwortText(z!)).toBe('Ja – nur für bestimmte Dienste');
    expect(zellenAntwort(undefined, GESANG, name)).toBeNull();
  });
  it('flaecheAus: Abwesenheit vor Antwort, Antwort nur wenn sie gilt', () => {
    const ja = zellenAntwort(a('ja', 'x'), GESANG, name);
    const nurTon = zellenAntwort(a('vielleicht', 'x', { dienste: [TON] }), GESANG, name);
    expect(flaecheAus(true, ja)).toBe('nein');
    expect(flaecheAus(false, ja)).toBe('ja');
    expect(flaecheAus(false, nurTon)).toBeNull();
    expect(flaecheAus(false, null)).toBeNull();
  });
});
