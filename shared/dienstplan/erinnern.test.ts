import { describe, expect, it } from 'vitest';
import { tagKurz } from '../ct/datum';
import { diensteAus } from '../ct/dienste';
import type { Person } from '../organigramm/mitglieder';
import {
  betreffAus,
  betreffStandard,
  empfaengerAus,
  erinnerSpalten,
  fehlendeInGruppe,
  gruppeGrund,
  htmlText,
  mailInhalt,
  pausiertAusgelassen,
  offenKurz,
  terminZeile,
  vorname,
  type Fehlende,
  type GruppenErgebnis,
} from './erinnern';
import { abwesenheitenAus, type GruppenStand, type PersonenDaten } from './personenDaten';
import type { PersonenAntworten } from './personenAntworten';
import { planAus, type Plan, type PlanGruppe } from './plan';
import { leereListe, pauseSetzen, type Personenliste } from './personenliste';
import { liste } from './personenliste.testutil';
import type { RohTermin } from './termine';
import { antwortBereinigt, type Antworten, type Zusage } from './verfuegbarkeit';

/**
 * E5c-5 „Erinnern“: wer fehlt, wen sperrt die unsichere Lage, wie wird die Mail. Tests gegen die Erzeuger: Plan aus
 * `planAus`, Abwesenheiten aus `abwesenheitenAus`, Antworten aus `antwortBereinigt` (dieselbe Form wie beim Lesen/Schreiben).
 *
 * Musik (Dienstgruppe 4): Gitarre (CT-Gruppe 100) und Gesang (CT-Gruppe 90). Technik (3): Ton (CT-Gruppe 7).
 * Termine: 1 = So 06.12. (Daniel in Gitarre und Gesang, Ben im Ton) · 2 = So 13.12. (Anna im Gesang) · 3 = So 20.12.
 * (Daniel in Gitarre) · 4 = Mi 23.12. (nur Ton – Musik hat dort keinen Dienst).
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
const platz = (serviceId: number, personId: number | null, name: string | null, zu = true) => ({
  serviceId,
  personId,
  name,
  isAccepted: zu,
  index: null,
});
const termin = (
  id: number,
  start: string,
  eventServices: object[],
  extra: Partial<RohTermin> = {},
): RohTermin => ({
  id,
  name: 'Gottesdienst',
  startDate: start,
  endDate: start.replace('T08:00', 'T10:00'),
  eventServices,
  ...extra,
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

const planMit = (roh: RohTermin[]): Plan =>
  planAus(roh, {
    ichId: 1,
    dienste: DIENSTE,
    dienstgruppen: GRUPPEN,
    zeitzone: 'Europe/Berlin',
    planbar: () => true,
    ganzSichtbar: () => true,
  });
const ROH: RohTermin[] = [
  termin(1, '2026-12-06T08:00:00Z', [
    platz(GITARRE, 12, 'Daniel Fink'),
    platz(GESANG, 12, 'Daniel Fink'),
    platz(TON, 8, 'Ben Kunz'),
  ]),
  termin(2, '2026-12-13T08:00:00Z', [platz(GESANG, 5, 'Anna Gans')]),
  termin(3, '2026-12-20T08:00:00Z', [platz(GITARRE, 12, 'Daniel Fink')]),
  termin(4, '2026-12-23T08:00:00Z', [platz(TON, 8, 'Ben Kunz')]),
];
const PLAN = planMit(ROH);
const musik = (plan: Plan = PLAN): PlanGruppe => plan.gruppen.find((g) => g.gruppe?.id === MUSIK)!;
const technik = (plan: Plan = PLAN): PlanGruppe =>
  plan.gruppen.find((g) => g.gruppe?.id === TECHNIK)!;
const ALLE = [0, 1, 2, 3];
const T = PLAN.spalten.map((s) => String(s.id)); // Schlüssel der Antworten = Termin-ID als Text

const da = (
  mitglieder: Person[],
  abwesenheiten: Extract<GruppenStand, { art: 'da' }>['abwesenheiten'] = [],
): GruppenStand => ({ art: 'da', mitglieder, abwesenheiten });
const urlaub = (id: number, personId: number, tag: string) => ({
  id,
  person: { domainIdentifier: String(personId) },
  absenceReason: { nameTranslated: 'Urlaub' },
  startDate: tag,
  endDate: tag,
});
/** Mitglieder: Gitarre = Daniel, Eva · Gesang = Anna, Daniel, Clara · Ton = Ben; `abw` für alle. */
const daten = (abw: ReturnType<typeof urlaub>[] = []): PersonenDaten => {
  const liste = abwesenheitenAus(abw);
  return new Map<number, GruppenStand>([
    [100, da([DANIEL, EVA], liste)],
    [90, da([ANNA, DANIEL, CLARA], liste)],
    [7, da([BEN], liste)],
  ]);
};
const antwort = (z: Zusage, tag: string, extra: { notiz?: string; dienste?: number[] } = {}) =>
  antwortBereinigt({ a: z, tag, ...extra });
const antworten = (
  jePerson: [number, Antworten][] = [],
  sichtbar: number[] = [MUSIK, TECHNIK],
): PersonenAntworten => ({ jePerson: new Map(jePerson), sichtbar: new Set(sichtbar) });

const HEUTE = '2026-12-01';
const musikFehlend = (
  o: {
    plan?: Plan;
    spalten?: number[];
    daten?: PersonenDaten;
    antworten?: PersonenAntworten;
    heute?: string;
    personenlisten?: ReadonlyMap<number, Personenliste>;
  } = {},
): GruppenErgebnis => {
  const plan = o.plan ?? PLAN;
  return fehlendeInGruppe({
    plan,
    spalten: o.spalten ?? ALLE,
    gruppe: musik(plan),
    daten: o.daten ?? daten(),
    antworten: o.antworten ?? antworten(),
    heute: o.heute ?? HEUTE,
    personenlisten: o.personenlisten,
  });
};
/** Je Person die Tage der offenen Termine – `Name → ['2026-12-06', …]`. */
const offen = (e: GruppenErgebnis): Record<string, string[]> => {
  if (e.art !== 'ok') throw new Error(`gesperrt: ${e.grund}`);
  return Object.fromEntries(e.personen.map((p) => [p.name, p.termine.map((t) => t.tag)]));
};

describe('Wer fehlt: Antwort, Abwesenheit, Einteilung', () => {
  it('ohne Antworten fehlt jedem Mitglied jeder Termin – außer, wo es schon eingeteilt ist oder die Gruppe keinen Dienst hat', () => {
    expect(offen(musikFehlend())).toEqual({
      // Anna: 06. und 20.; am 13. ist sie im Gesang eingeteilt.
      'Anna Gans': ['2026-12-06', '2026-12-20'],
      // Clara steht nirgends: alle drei Termine mit Musik-Diensten – NICHT der 23. (nur Ton).
      'Clara Neu': ['2026-12-06', '2026-12-13', '2026-12-20'],
      // Daniel ist am 06. (Gitarre + Gesang) und 20. (Gitarre) eingeteilt – offen nur der 13.
      'Daniel Fink': ['2026-12-13'],
      'Eva Hell': ['2026-12-06', '2026-12-13', '2026-12-20'],
    });
  });

  it('Ja und Vielleicht zählen als beantwortet – und „nur bestimmte Dienste“ auch, wenn sie den Dienst der Person nicht nennt', () => {
    const e = musikFehlend({
      antworten: antworten([
        [
          ANNA.id,
          {
            [T[0]]: antwort('ja', '2026-12-06'),
            // Anna ist im Gesang; „nur Gitarre“ gilt für sie nicht – beantwortet ist es trotzdem.
            [T[2]]: antwort('vielleicht', '2026-12-20', { dienste: [GITARRE] }),
          },
        ],
      ]),
    });
    expect(offen(e)['Anna Gans']).toBeUndefined(); // 06. und 20. beantwortet, 13. eingeteilt → niemand fehlt mehr
  });

  it('Nein = Abwesenheit aus ChurchTools (decktTermin): an dem Tag fehlt nichts, an den anderen schon', () => {
    const e = musikFehlend({ daten: daten([urlaub(1, CLARA.id, '2026-12-13')]) });
    expect(offen(e)['Clara Neu']).toEqual(['2026-12-06', '2026-12-20']);
  });

  it('wer an dem Termin in der Gruppe eingeteilt ist (zugesagt ODER angefragt, in irgendeinem Dienst), fehlt dort nicht', () => {
    const plan = planMit([
      termin(1, '2026-12-06T08:00:00Z', [
        platz(GESANG, 5, 'Anna Gans', false), // angefragt
        platz(GITARRE, 13, 'Eva Hell', true), // zugesagt, anderer Dienst der Gruppe
      ]),
    ]);
    const e = musikFehlend({ plan, spalten: [0] });
    expect(offen(e)).toEqual({
      'Clara Neu': ['2026-12-06'],
      'Daniel Fink': ['2026-12-06'],
    });
  });

  it('Vergangenes zählt nicht; ein Termin von heute schon', () => {
    const plan = planMit([
      termin(1, '2026-12-06T08:00:00Z', [platz(GESANG, null, null)]),
      termin(2, '2026-12-13T08:00:00Z', [platz(GESANG, null, null)]),
      termin(3, '2026-12-20T08:00:00Z', [platz(GESANG, null, null)]),
    ]);
    expect(erinnerSpalten(plan, [0, 1, 2], '2026-12-13')).toEqual([1, 2]); // der 13. ist heute und zählt
    expect(erinnerSpalten(plan, [0, 1, 2], '2026-12-14')).toEqual([2]);
    const e = musikFehlend({ plan, spalten: [0, 1, 2], heute: '2026-12-14' });
    expect(offen(e)['Clara Neu']).toEqual(['2026-12-20']);
  });

  it('ein abgesagter Termin zählt nicht (auch in der Zukunft)', () => {
    const plan = planMit([
      termin(1, '2026-12-06T08:00:00Z', [platz(GESANG, null, null)]),
      termin(2, '2026-12-13T08:00:00Z', [platz(GESANG, null, null)], { isCanceled: true }),
      termin(3, '2026-12-20T08:00:00Z', [platz(GESANG, null, null)]),
    ]);
    expect(erinnerSpalten(plan, [0, 1, 2], HEUTE)).toEqual([0, 2]);
    const e = musikFehlend({ plan, spalten: [0, 1, 2] });
    expect(offen(e)['Clara Neu']).toEqual(['2026-12-06', '2026-12-20']);
  });

  it('nur die gezeigten Spalten zählen – und gezeigt werden die Mitglieder der Dienste, die dort vorkommen (wie in „Personen“)', () => {
    // 13.12.: Gesang ist vorgesehen, Gitarre nicht – Clara (Gesang) fehlt, Eva (nur Gitarre) steht dort nicht im Raster.
    expect(offen(musikFehlend({ spalten: [1] }))).toEqual({
      'Clara Neu': ['2026-12-13'],
      'Daniel Fink': ['2026-12-13'],
    });
  });

  it('ein Termin, an dem die Gruppe keinen Dienst hat, zählt nicht – auch nicht als einziger', () => {
    // Spalte 3 = 23.12., nur Ton (Technik): für Musik gibt es nichts zu beantworten.
    expect(offen(musikFehlend({ spalten: [3] }))).toEqual({});
  });

  it('Name und Reihenfolge: nach Name sortiert, Termine in der Reihenfolge der Spalten, jeder mit Titel und Uhrzeit', () => {
    const e = musikFehlend();
    if (e.art !== 'ok') throw new Error('gesperrt');
    expect(e.personen.map((p) => p.name)).toEqual([
      'Anna Gans',
      'Clara Neu',
      'Daniel Fink',
      'Eva Hell',
    ]);
    expect(e.personen[0].termine[0]).toEqual({
      terminId: PLAN.spalten[0].id,
      tag: '2026-12-06',
      name: 'Gottesdienst',
      uhrzeit: PLAN.spalten[0].uhrzeit,
    });
  });
});

describe('Unsichere Lage sperrt die Gruppe – nie „alle fehlen“', () => {
  const grund = (e: GruppenErgebnis) => (e.art === 'gesperrt' ? e.grund : null);

  it('Antworten der Gruppe nicht sichtbar (kein Recht, keine Kategorie, nicht geladen)', () => {
    expect(grund(musikFehlend({ antworten: antworten([], [TECHNIK]) }))).toBe(
      'Antworten nicht sichtbar',
    );
    expect(grund(musikFehlend({ antworten: antworten([], []) }))).toBe('Antworten nicht sichtbar');
  });

  it('Abwesenheiten nicht sichtbar – auch wenn nur EINE CT-Gruppe eines Dienstes sie nicht zeigt', () => {
    const d = new Map(daten());
    d.set(90, da([ANNA, DANIEL, CLARA], 'nichtSichtbar'));
    expect(grund(musikFehlend({ daten: d }))).toBe('Abwesenheiten nicht sichtbar');
  });

  it('Mitglieder verborgen (403)', () => {
    const d = new Map(daten());
    d.set(100, { art: 'da', mitglieder: 'verborgen', abwesenheiten: [] });
    expect(grund(musikFehlend({ daten: d }))).toBe('Mitglieder nicht sichtbar');
  });

  it('Ladefehler einer Gruppe und noch nicht geladene Gruppe: gesperrt, „Erneut versuchen“ lohnt', () => {
    const d = new Map(daten());
    d.set(90, { art: 'fehler', text: 'ChurchTools antwortet gerade nicht.', nochmal: true });
    const e = musikFehlend({ daten: d });
    expect(e).toEqual({
      art: 'gesperrt',
      grund: 'ChurchTools hat nicht geantwortet',
      nochmal: true,
    });
    d.delete(90);
    expect(musikFehlend({ daten: d })).toEqual({
      art: 'gesperrt',
      grund: 'Mitglieder noch nicht geladen',
      nochmal: true,
    });
  });

  it('die Rechte-Gründe sind dauerhaft (kein „Erneut versuchen“)', () => {
    const e = musikFehlend({ antworten: antworten([], []) });
    expect(e.art === 'gesperrt' && e.nochmal).toBe(false);
  });

  it('eine andere Gruppe ändert nichts: Technik ist beurteilbar, auch wenn Musik gesperrt ist', () => {
    const ant = antworten([], [TECHNIK]);
    expect(grund(musikFehlend({ antworten: ant }))).not.toBeNull();
    const t = fehlendeInGruppe({
      plan: PLAN,
      spalten: ALLE,
      gruppe: technik(),
      daten: daten(),
      antworten: ant,
      heute: HEUTE,
    });
    expect(t.art).toBe('ok');
  });

  it('gruppeGrund prüft nur Dienste, die an den Terminen vorkommen', () => {
    // Am 23.12. hat Musik keinen Dienst – dort braucht es auch keine Mitglieder-Daten der Musik-Gruppen.
    expect(
      gruppeGrund({
        plan: PLAN,
        spalten: [3],
        gruppe: musik(),
        daten: new Map(),
        antworten: antworten(),
      }),
    ).toBeNull();
  });
});

describe('Empfänger über mehrere Gruppen', () => {
  const t = (id: number, tag: string, uhr = '10:00') => ({
    terminId: id,
    tag,
    name: 'Gottesdienst',
    uhrzeit: uhr,
  });
  const f = (personId: number, name: string, ...termine: ReturnType<typeof t>[]): Fehlende => ({
    personId,
    name,
    termine,
  });

  it('jede Person einmal, mit vereinigten Terminen (ein Termin einmal, nach Tag sortiert) und beiden Gruppen', () => {
    const e = empfaengerAus([
      { gruppe: 'Musik', personen: [f(12, 'Daniel Fink', t(1, '2026-12-06'), t(3, '2026-12-20'))] },
      {
        gruppe: 'Technik',
        personen: [
          f(12, 'Daniel Fink', t(3, '2026-12-20'), t(2, '2026-12-13')),
          f(8, 'Ben Kunz', t(1, '2026-12-06')),
        ],
      },
    ]);
    expect(e.map((x) => x.name)).toEqual(['Ben Kunz', 'Daniel Fink']);
    const daniel = e[1];
    expect(daniel.gruppen).toEqual(['Musik', 'Technik']);
    expect(daniel.termine.map((x) => x.terminId)).toEqual([1, 2, 3]);
  });

  it('dieselbe Person aus echten Ergebnissen zweier Gruppen (Erzeuger) steht einmal da', () => {
    const d = new Map(daten());
    d.set(7, da([BEN, DANIEL])); // Daniel ist auch Mitglied der Technik
    const ant = antworten();
    const von = (gruppe: PlanGruppe, name: string) => {
      const e = fehlendeInGruppe({
        plan: PLAN,
        spalten: ALLE,
        gruppe,
        daten: d,
        antworten: ant,
        heute: HEUTE,
      });
      if (e.art !== 'ok') throw new Error('gesperrt');
      return { gruppe: name, personen: e.personen };
    };
    const e = empfaengerAus([von(musik(), 'Musik'), von(technik(), 'Technik')]);
    expect(e.filter((x) => x.personId === DANIEL.id)).toHaveLength(1);
    expect(e.find((x) => x.personId === DANIEL.id)?.gruppen).toEqual(['Musik', 'Technik']);
  });
});

describe('Die Mail', () => {
  const T1 = { terminId: 1, tag: '2026-12-06', name: 'Gottesdienst', uhrzeit: '10:00' };
  const T2 = { terminId: 2, tag: '2026-12-09', name: 'Gebetsabend', uhrzeit: '19:00' };
  const LINK = 'https://ct.test/ccm/dienstplaner/#/abwesenheiten';

  it('Vorname, Einleitung, Terminliste und der eigene Knopf mit der vollen Adresse', () => {
    const html = mailInhalt({
      name: 'Anna Gans',
      einleitung: 'Bitte antworte kurz.',
      termine: [T1, T2],
      link: LINK,
    });
    expect(html).toContain('<p>Hallo Anna,</p>');
    expect(html).toContain('<p>Bitte antworte kurz.</p>');
    expect(html).toContain(`<li>${terminZeile(T1)}</li>`);
    expect(html).toContain('<li>So, 06.12. · Gottesdienst · 10:00 Uhr</li>');
    expect(html).toContain('<li>Mi, 09.12. · Gebetsabend · 19:00 Uhr</li>');
    expect(html).toMatch(
      new RegExp(
        `<a href="${LINK.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}" style="[^"]*">Im Dienstplaner eintragen</a>`,
      ),
    );
  });

  it('der Text des Planers ist maskiert (HTML wird nicht ausgeführt), Zeilenumbrüche werden zu <br>', () => {
    const html = mailInhalt({
      name: 'Ben <b>Kunz',
      einleitung: 'Zeile 1 & <script>alert(1)</script>\r\nZeile "2"\nZeile 3',
      termine: [{ ...T1, name: 'Fest <i>' }],
      link: 'https://ct.test/?a=1&b="2"',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Zeile 1 &amp; ');
    expect(html).toContain('<br>Zeile &quot;2&quot;<br>Zeile 3');
    expect(html).toContain('Hallo Ben,'); // Vorname = erstes Wort, ohne das < zu übernehmen
    expect(html).toContain('Fest &lt;i&gt;');
    expect(html).toContain('href="https://ct.test/?a=1&amp;b=&quot;2&quot;"');
    expect(htmlText(`'`)).toBe('&#39;');
  });

  it('leere Einleitung: kein leerer Absatz; kein Name: „du“', () => {
    const html = mailInhalt({ name: '  ', einleitung: '  ', termine: [T1], link: LINK });
    expect(html).toContain('<p>Hallo du,</p>');
    expect(html).not.toContain('<p></p>');
    expect(vorname('Anna Maria Gans')).toBe('Anna');
  });

  it('Betreff: ein Monat → „im Dezember“, mehrere → allgemein; leer fällt zurück', () => {
    expect(betreffStandard([T1, T2])).toBe('Wann kannst du im Dezember?');
    expect(betreffStandard([T1, { tag: '2027-01-03' }])).toBe(
      'Wann kannst du? Bitte trag dich im Dienstplaner ein',
    );
    expect(betreffAus('  ')).toBe('Wann kannst du? Bitte trag dich im Dienstplaner ein');
    expect(betreffAus(' Hallo ')).toBe('Hallo');
  });
});

describe('offenKurz – die kurze Terminliste im Fenster', () => {
  const t = (terminId: number, tag: string, uhrzeit: string) => ({
    terminId,
    tag,
    name: 'GD',
    uhrzeit,
  });
  it('ein Termin je Tag: nur der Tag', () => {
    expect(offenKurz([t(1, '2026-12-06', '10:00'), t(2, '2026-12-13', '10:00')])).toBe(
      'So, 06.12. · So, 13.12.',
    );
  });
  it('zwei Termine am selben Tag: mit Uhrzeit (sonst „So, 06.12. · So, 06.12.“, Probe 19.11.)', () => {
    expect(
      offenKurz([
        t(1, '2026-12-06', '09:00'),
        t(2, '2026-12-06', '10:30'),
        t(3, '2026-12-13', '10:00'),
      ]),
    ).toBe('So, 06.12. 09:00 · So, 06.12. 10:30 · So, 13.12.');
  });
});

describe('Dienste, die niemand vorgesehen hat (20.11.2026: Plan mit `immerZeigen`)', () => {
  // Schlagzeug (Musik, CT-Gruppe 200) ist planbar, kommt aber nirgends vor – „Planen“ zeigt ihn trotzdem.
  const SCHLAGZEUG = 11;
  const mitSchlagzeug = (): Plan =>
    planAus(ROH, {
      ichId: 1,
      dienste: diensteAus([
        { id: TON, name: 'Ton', serviceGroupId: TECHNIK, groupIds: [7], sortKey: 1 },
        { id: GITARRE, name: 'Gitarre', serviceGroupId: MUSIK, groupIds: [100], sortKey: 2 },
        { id: GESANG, name: 'Gesang', serviceGroupId: MUSIK, groupIds: [90], sortKey: 3 },
        { id: SCHLAGZEUG, name: 'Schlagzeug', serviceGroupId: MUSIK, groupIds: [200], sortKey: 4 },
      ]),
      dienstgruppen: GRUPPEN,
      zeitzone: 'Europe/Berlin',
      planbar: () => true,
      ganzSichtbar: () => true,
      immerZeigen: () => true,
    });

  it('der Plan führt die Zeile, die Erinnerung ignoriert sie – dieselben Fehlenden wie ohne', () => {
    const plan = mitSchlagzeug();
    expect(musik(plan).zeilen.map((z) => z.dienst.name)).toContain('Schlagzeug');
    // Die Mitglieder von 200 sind nicht geladen – das darf die Gruppe nicht sperren und niemanden zum Fehlenden machen.
    const mit = musikFehlend({ plan });
    expect(mit.art).toBe('ok');
    expect(offen(mit)).toEqual(offen(musikFehlend()));
  });
});

describe('Mitglieder im Ergebnis (R-2: „Fertig“ im Stand einer Abfrage)', () => {
  it('alle Mitglieder der Gruppe an diesen Terminen, nach Name – auch wer nichts mehr offen hat', () => {
    // Daniel hat den einzigen offenen Termin (13.12. = Termin 2) beantwortet: er fehlt nirgends mehr.
    const e = musikFehlend({
      antworten: antworten([[DANIEL.id, { '2': antwort('ja', '2026-12-13') }]]),
    });
    if (e.art !== 'ok') throw new Error('gesperrt');
    expect(e.mitglieder.map((m) => m.name)).toEqual([
      'Anna Gans',
      'Clara Neu',
      'Daniel Fink',
      'Eva Hell',
    ]);
    expect(e.personen.map((p) => p.name)).not.toContain('Daniel Fink');
    // Dieselben Leute, die `personen` und `pausiert` nennen, sind Mitglieder – nichts kommt von woanders her.
    const ids = new Set(e.mitglieder.map((m) => m.personId));
    for (const p of e.personen) expect(ids.has(p.personId)).toBe(true);
  });

  it('ohne Termine nichts zu rechnen: leer', () => {
    const e = musikFehlend({ spalten: [] });
    expect(e.art === 'ok' && e.mitglieder).toEqual([]);
  });
});

describe('Pause: wer pausiert, wird nicht erinnert (PL-3)', () => {
  /** Die Liste einer Dienstgruppe mit Pausen – gebaut mit `pauseSetzen`, gelesen mit `personenlisteAus` (Erzeuger). */
  const mitPausen = (...p: [number, string?][]): Personenliste =>
    liste(p.reduce((l, [id, bis]) => pauseSetzen(l, id, bis ? { bis } : {}), leereListe()));
  const fuerMusik = (l: Personenliste) => new Map([[MUSIK, l]]);
  const personen = (e: GruppenErgebnis) => (e.art === 'ok' ? e.personen.map((p) => p.name) : []);

  it('ohne Liste oder ohne Pausen ist alles wie vorher; pausiert ist leer', () => {
    const e = musikFehlend({ personenlisten: fuerMusik(liste()) });
    expect(offen(e)).toEqual(offen(musikFehlend()));
    expect(e.art === 'ok' && e.pausiert).toEqual([]);
  });

  it('eine unbefristete Pause nimmt die Person aus der Liste – sie bekommt keine Mail', () => {
    const e = musikFehlend({ personenlisten: fuerMusik(mitPausen([CLARA.id])) });
    expect(personen(e)).not.toContain('Clara Neu');
    expect(personen(e)).toContain('Eva Hell');
    expect(e.art === 'ok' && e.pausiert).toEqual([CLARA.id]);
  });

  it('„bis“ einschließlich: Clara pausiert bis 13.12. – offen bleibt nur der 20. (sie bekommt eine Mail, aber nur dafür)', () => {
    const e = musikFehlend({ personenlisten: fuerMusik(mitPausen([CLARA.id, '2026-12-13'])) });
    expect(offen(e)['Clara Neu']).toEqual(['2026-12-20']);
    expect(e.art === 'ok' && e.pausiert).toEqual([]); // sie wird erinnert, also nicht „ausgelassen“
  });

  it('eine Pause, die vor allen Terminen endet, wirkt nicht', () => {
    const e = musikFehlend({ personenlisten: fuerMusik(mitPausen([CLARA.id, '2026-12-05'])) });
    expect(offen(e)['Clara Neu']).toEqual(['2026-12-06', '2026-12-13', '2026-12-20']);
  });

  it('eine Pause aus der Liste einer ANDEREN Dienstgruppe wirkt in Musik nicht', () => {
    const technikListe = new Map([[TECHNIK, mitPausen([CLARA.id])]]);
    const e = musikFehlend({ personenlisten: technikListe });
    expect(personen(e)).toContain('Clara Neu');
    expect(e.art === 'ok' && e.pausiert).toEqual([]);
  });

  it('wer nichts mehr offen hat, steht auch nicht als „pausiert“ da (nur wirklich ausgelassene zählen)', () => {
    // Daniel ist am 06. und 20. eingeteilt, offen nur der 13. – Pause bis 12.12. ändert daran nichts.
    const e = musikFehlend({ personenlisten: fuerMusik(mitPausen([DANIEL.id, '2026-12-05'])) });
    expect(offen(e)['Daniel Fink']).toEqual(['2026-12-13']);
    const f = musikFehlend({ personenlisten: fuerMusik(mitPausen([ANNA.id])) });
    // Anna hätte offen: 06. und 20. → mit Pause ausgelassen und gezählt.
    expect(f.art === 'ok' && f.pausiert).toEqual([ANNA.id]);
  });

  it('der Mail-Inhalt nennt nur die nicht pausierten Termine', () => {
    const e = musikFehlend({ personenlisten: fuerMusik(mitPausen([CLARA.id, '2026-12-13'])) });
    const empf = empfaengerAus(e.art === 'ok' ? [{ gruppe: 'Musik', personen: e.personen }] : []);
    const clara = empf.find((x) => x.personId === CLARA.id)!;
    const html = mailInhalt({
      name: clara.name,
      einleitung: '',
      termine: clara.termine,
      link: 'https://x.test',
    });
    expect(html).toContain(tagKurz('2026-12-20'));
    expect(html).not.toContain(tagKurz('2026-12-06'));
    expect(html).not.toContain(tagKurz('2026-12-13'));
  });

  it('Hinweiszahl: jede ausgelassene Person einmal; wer über eine andere Gruppe doch eine Mail bekommt, zählt nicht', () => {
    expect(pausiertAusgelassen([{ pausiert: [1, 2] }, { pausiert: [2, 3] }], [])).toBe(3);
    expect(
      pausiertAusgelassen([{ pausiert: [1, 2] }, { pausiert: [2, 3] }], [{ personId: 2 }]),
    ).toBe(2);
    expect(pausiertAusgelassen([], [])).toBe(0);
    // mit echten Ergebnissen
    const e = musikFehlend({ personenlisten: fuerMusik(mitPausen([CLARA.id], [EVA.id])) });
    expect(
      e.art === 'ok' &&
        pausiertAusgelassen(
          [e],
          empfaengerAus([{ gruppe: 'Musik', personen: e.art === 'ok' ? e.personen : [] }]),
        ),
    ).toBe(2);
  });
});
