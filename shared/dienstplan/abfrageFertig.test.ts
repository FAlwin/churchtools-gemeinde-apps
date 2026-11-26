import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import type { CtAbsence } from '../ct/typen';
import type { Person } from '../organigramm/mitglieder';
import { standardInhalt } from './abfragenSpeicher';
import type { Abfrage } from './abfragen';
import { standardText, mailFuer, STANDARD_TEXT, STANDARD_TEXT_ABWESEND } from './abfrageMail';
import {
  ABFRAGE_FERTIG_TEXT,
  abfrageBandTextAbwesend,
  abfrageKartenText,
  meinStandInAbfrage,
} from './abfrageStand';
import {
  abfrageRegelAus,
  beantwortetNach,
  einleitungStandard,
  EINLEITUNG_ABWESEND,
  EINLEITUNG_STANDARD,
  fehlendeInGruppe,
  ohneAbfrageGrund,
  ZUSAGEN_REGEL,
  type AbfrageRegel,
  type GruppenErgebnis,
} from './erinnern';
import { abwesenheitenAus, type GruppenStand, type PersonenDaten } from './personenDaten';
import { hatBestaetigt, type PersonenAntworten } from './personenAntworten';
import { planAus, type Plan } from './plan';
import type { RohTermin } from './termine';
import { antwortBereinigt, type Antworten, type Fertig } from './verfuegbarkeit';

/**
 * **V-4: „fertig“ je Art der Abfrage – eine Regel** (`beantwortetNach`). Die Tabelle gilt für beide Arten und für beide Rechner
 * (Planer: `fehlendeInGruppe`, Mitarbeitende: `meinStandInAbfrage`) – dasselbe Ergebnis aus denselben Eingaben.
 *
 * Technik (3), Dienst Ton (CT-Gruppe 7), drei Termine 06./13./20.12. – Mitglieder: Anna (5) und Clara (11).
 * Heute = 01.12.2026, Abfrage `a1`.
 */
const TECHNIK = 3;
const TON = 6;
const DIENSTE = diensteAus([
  { id: TON, name: 'Ton', serviceGroupId: TECHNIK, groupIds: [7], sortKey: 1 },
]);
const GRUPPEN = [{ id: TECHNIK, name: 'Technik', fuerAlle: false }];
const platz = () => ({
  serviceId: TON,
  personId: null,
  name: null,
  isAccepted: false,
  index: null,
});
const termin = (id: number, start: string): RohTermin => ({
  id,
  name: 'Gottesdienst',
  startDate: start,
  endDate: start.replace('T08:00', 'T10:00'),
  eventServices: [platz()],
});
const PLAN: Plan = planAus(
  [
    termin(1, '2026-12-06T08:00:00Z'),
    termin(2, '2026-12-13T08:00:00Z'),
    termin(3, '2026-12-20T08:00:00Z'),
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
const CLARA = person(11, 'Clara Neu');
const HEUTE = '2026-12-01';
const ABFRAGE_ID = 'a1';
const ABFRAGE: Abfrage = {
  id: ABFRAGE_ID,
  von: '2026-12-05',
  bis: '2026-12-31',
  frist: '2026-12-03',
  oeffnen: '2026-12-01',
  termine: [1, 2, 3],
  gestartet: { personId: 1, name: 'Alwin', zeit: '2026-12-01T07:00:00Z' },
  beendet: null,
};
const urlaub = (id: number, personId: number, tag: string) => ({
  id,
  person: { domainIdentifier: String(personId) },
  absenceReason: { nameTranslated: 'Urlaub' },
  startDate: tag,
  endDate: tag,
});
const TAGE = ['2026-12-06', '2026-12-13', '2026-12-20'];
const da = (abw: ReturnType<typeof urlaub>[]): PersonenDaten =>
  new Map<number, GruppenStand>([
    [7, { art: 'da', mitglieder: [ANNA, CLARA], abwesenheiten: abwesenheitenAus(abw) }],
  ]);
const antwort = (tag: string) => antwortBereinigt({ a: 'ja', tag });
const antworten = (o: {
  ja?: [number, Antworten][];
  fertig?: [number, Fertig][];
}): PersonenAntworten => ({
  jePerson: new Map(o.ja ?? []),
  sichtbar: new Set([TECHNIK]),
  fertig: new Map(o.fertig ?? []),
});
const ZEIT = '2026-12-02T10:00:00.000Z';
const ABWESEND: AbfrageRegel = { art: 'abwesend', abfrageId: ABFRAGE_ID };

const planer = (o: {
  regel?: AbfrageRegel;
  abw?: ReturnType<typeof urlaub>[];
  antworten?: PersonenAntworten;
}): GruppenErgebnis =>
  fehlendeInGruppe({
    plan: PLAN,
    spalten: [0, 1, 2],
    gruppe: PLAN.gruppen.find((g) => g.gruppe?.id === TECHNIK)!,
    daten: da(o.abw ?? []),
    antworten: o.antworten ?? antworten({}),
    heute: HEUTE,
    regel: o.regel,
  });
const offen = (e: GruppenErgebnis): Record<string, number> => {
  if (e.art !== 'ok') throw new Error(`gesperrt: ${e.grund}`);
  return Object.fromEntries(e.personen.map((p) => [p.name, p.termine.length]));
};

describe('beantwortetNach – die Tabelle', () => {
  const alle = [false, true];
  it.each(
    alle.flatMap((antwortDa) =>
      alle.flatMap((abwesend) =>
        alle.flatMap((bestaetigt) => [
          { art: 'zusagen' as const, antwortDa, abwesend, bestaetigt },
          { art: 'abwesend' as const, antwortDa, abwesend, bestaetigt },
        ]),
      ),
    ),
  )('$art: Antwort $antwortDa · abwesend $abwesend · bestätigt $bestaetigt', (f) => {
    const erwartet = f.abwesend || (f.art === 'zusagen' ? f.antwortDa : f.bestaetigt);
    expect(
      beantwortetNach(f.art, {
        antwort: f.antwortDa,
        abwesend: f.abwesend,
        bestaetigt: f.bestaetigt,
      }),
    ).toBe(erwartet);
  });
});

describe('Planer: fehlendeInGruppe nach Art', () => {
  it('Nur abwesend: nichts → beiden fehlen alle drei Termine', () => {
    expect(offen(planer({ regel: ABWESEND }))).toEqual({ 'Anna Gans': 3, 'Clara Neu': 3 });
  });

  it('Nur abwesend: an ALLEN Terminen abwesend → fertig (Clara), an einem Termin → Anna bleibt offen (2 Termine)', () => {
    const abw = [...TAGE.map((t, i) => urlaub(10 + i, CLARA.id, t)), urlaub(20, ANNA.id, TAGE[0])];
    expect(offen(planer({ regel: ABWESEND, abw }))).toEqual({ 'Anna Gans': 2 });
  });

  it('Nur abwesend: bestätigt → fertig, obwohl kein Termin abwesend ist (Anna); Clara bleibt offen', () => {
    const e = planer({
      regel: ABWESEND,
      antworten: antworten({ fertig: [[ANNA.id, { [ABFRAGE_ID]: ZEIT }]] }),
    });
    expect(offen(e)).toEqual({ 'Clara Neu': 3 });
    if (e.art === 'ok') expect(e.mitglieder.map((m) => m.name)).toEqual(['Anna Gans', 'Clara Neu']);
  });

  it('Nur abwesend: eine Bestätigung einer ANDEREN Abfrage zählt nicht; ohne Abfrage-ID (Start) auch keine', () => {
    const fremd = antworten({ fertig: [[ANNA.id, { andere: ZEIT }]] });
    expect(offen(planer({ regel: ABWESEND, antworten: fremd }))).toEqual({
      'Anna Gans': 3,
      'Clara Neu': 3,
    });
    const richtig = antworten({ fertig: [[ANNA.id, { [ABFRAGE_ID]: ZEIT }]] });
    expect(
      offen(planer({ regel: { art: 'abwesend', abfrageId: null }, antworten: richtig })),
    ).toEqual({ 'Anna Gans': 3, 'Clara Neu': 3 });
  });

  it('Nur abwesend: gespeicherte Ja-Antworten zählen NICHT (nur ausgeblendet)', () => {
    const ja = antworten({
      ja: [[ANNA.id, Object.fromEntries(['1', '2', '3'].map((id, i) => [id, antwort(TAGE[i])]))]],
    });
    expect(offen(planer({ regel: ABWESEND, antworten: ja }))).toEqual({
      'Anna Gans': 3,
      'Clara Neu': 3,
    });
  });

  it('Zusagen: Ja zählt, eine Bestätigung zählt NICHT (Gegenstück)', () => {
    const ja = antworten({ ja: [[ANNA.id, { '1': antwort(TAGE[0]) }]] });
    expect(offen(planer({ regel: ZUSAGEN_REGEL, antworten: ja }))).toEqual({
      'Anna Gans': 2,
      'Clara Neu': 3,
    });
    const nurFertig = antworten({ fertig: [[ANNA.id, { [ABFRAGE_ID]: ZEIT }]] });
    expect(offen(planer({ regel: ZUSAGEN_REGEL, antworten: nurFertig }))).toEqual({
      'Anna Gans': 3,
      'Clara Neu': 3,
    });
    // Ohne `regel` ist es genau die Zusagen-Regel (wie vor V-4).
    expect(offen(planer({ antworten: ja }))).toEqual(
      offen(planer({ regel: ZUSAGEN_REGEL, antworten: ja })),
    );
  });

  it('hatBestaetigt: nur die eigene Abfrage-ID der Person', () => {
    const a = antworten({ fertig: [[ANNA.id, { [ABFRAGE_ID]: ZEIT }]] });
    expect(hatBestaetigt(a, ANNA.id, ABFRAGE_ID)).toBe(true);
    expect(hatBestaetigt(a, CLARA.id, ABFRAGE_ID)).toBe(false);
    expect(hatBestaetigt(a, ANNA.id, 'andere')).toBe(false);
    expect(hatBestaetigt(a, ANNA.id, null)).toBe(false);
    expect(hatBestaetigt(null, ANNA.id, ABFRAGE_ID)).toBe(false);
  });
});

describe('Mitarbeitende: meinStandInAbfrage – dieselbe Tabelle', () => {
  const termine = TAGE.map((tag, i) => ({
    id: i + 1,
    tag,
    beginn: `${tag}T08:00:00Z`,
    ende: `${tag}T10:00:00Z`,
  }));
  const abw = (tag: string): CtAbsence => ({
    id: 1,
    startDate: tag,
    endDate: tag,
    startTime: null,
    endTime: null,
  });
  const stand = (o: {
    art: 'zusagen' | 'abwesend';
    abwesenheiten?: CtAbsence[];
    fertig?: Fertig;
    antworten?: Antworten;
  }) =>
    meinStandInAbfrage({
      abfrage: ABFRAGE,
      art: o.art,
      termine,
      antworten: o.antworten ?? {},
      fertig: o.fertig ?? {},
      abwesenheiten: o.abwesenheiten ?? [],
      eingeteilt: new Set<number>(),
      heute: HEUTE,
    }).offen.map((t) => t.id);

  it('Nur abwesend: nichts → alle drei offen; teils abwesend → die übrigen; alle abwesend → nichts; bestätigt → nichts', () => {
    expect(stand({ art: 'abwesend' })).toEqual([1, 2, 3]);
    expect(stand({ art: 'abwesend', abwesenheiten: [abw(TAGE[1])] })).toEqual([1, 3]);
    expect(stand({ art: 'abwesend', abwesenheiten: TAGE.map(abw) })).toEqual([]);
    expect(stand({ art: 'abwesend', fertig: { [ABFRAGE_ID]: ZEIT } })).toEqual([]);
  });

  it('Nur abwesend: Bestätigung einer anderen Abfrage und Ja-Antworten zählen nicht', () => {
    expect(stand({ art: 'abwesend', fertig: { andere: ZEIT } })).toEqual([1, 2, 3]);
    expect(
      stand({ art: 'abwesend', antworten: { '1': antwort(TAGE[0]), '2': antwort(TAGE[1]) } }),
    ).toEqual([1, 2, 3]);
  });

  it('Zusagen: wie bisher – Ja zählt, eine Bestätigung nicht', () => {
    expect(stand({ art: 'zusagen', antworten: { '1': antwort(TAGE[0]) } })).toEqual([2, 3]);
    expect(stand({ art: 'zusagen', fertig: { [ABFRAGE_ID]: ZEIT } })).toEqual([1, 2, 3]);
    expect(stand({ art: 'zusagen', abwesenheiten: [abw(TAGE[2])] })).toEqual([1, 2]);
  });

  it('Planer und Mitarbeitende rechnen gleich: dieselben Eingaben, dasselbe „fertig“ (Anna bestätigt, Clara überall abwesend)', () => {
    const planerErgebnis = planer({
      regel: ABWESEND,
      abw: TAGE.map((t, i) => urlaub(30 + i, CLARA.id, t)),
      antworten: antworten({ fertig: [[ANNA.id, { [ABFRAGE_ID]: ZEIT }]] }),
    });
    expect(offen(planerErgebnis)).toEqual({});
    expect(stand({ art: 'abwesend', abwesenheiten: TAGE.map(abw) })).toEqual([]);
    expect(stand({ art: 'abwesend', fertig: { [ABFRAGE_ID]: ZEIT } })).toEqual([]);
  });
});

describe('Regel einer Dienstgruppe', () => {
  const inhalt = (verfuegbarkeit: 'zusagen' | 'abwesend', a: Abfrage[] = [ABFRAGE]) => ({
    ...standardInhalt(),
    verfuegbarkeit,
    abfragen: a,
  });
  it('Zusagen und „nicht gelesen“ → Zusagen; Nur abwesend → mit der ID der LAUFENDEN Abfrage (beendete zählen nicht)', () => {
    expect(abfrageRegelAus(null, HEUTE)).toEqual({ art: 'zusagen' });
    expect(abfrageRegelAus(inhalt('zusagen'), HEUTE)).toEqual({ art: 'zusagen' });
    expect(abfrageRegelAus(inhalt('abwesend'), HEUTE)).toEqual(ABWESEND);
    expect(abfrageRegelAus(inhalt('abwesend', []), HEUTE)).toEqual({
      art: 'abwesend',
      abfrageId: null,
    });
    expect(abfrageRegelAus(inhalt('abwesend', [{ ...ABFRAGE, beendet: HEUTE }]), HEUTE)).toEqual({
      art: 'abwesend',
      abfrageId: null,
    });
  });
  it('Erinnern: „Nur abwesend“ ohne laufende Abfrage hat keinen Weg („Fertig“ gibt es nur in einer Abfrage)', () => {
    expect(ohneAbfrageGrund({ art: 'abwesend', abfrageId: null })).toMatch(/laufenden Abfrage/);
    expect(ohneAbfrageGrund(ABWESEND)).toBeNull();
    expect(ohneAbfrageGrund(ZUSAGEN_REGEL)).toBeNull();
  });
  it('Einleitung für Erinnern: nur wenn ALLE gewählten Gruppen „Nur abwesend“ fragen, der Text mit „Fertig“', () => {
    expect(einleitungStandard(true)).toBe(EINLEITUNG_ABWESEND);
    expect(EINLEITUNG_ABWESEND).toContain('„Fertig“');
    expect(einleitungStandard(false)).toBe(EINLEITUNG_STANDARD);
  });
});

describe('Texte bei „Nur abwesend“', () => {
  it('Karte: Bitte statt Zahl; Zusagen bleibt „Noch n offen“', () => {
    const o = { gruppe: 'Technik', abfrage: ABFRAGE, stand: { gesamt: 3, offen: 2 } };
    expect(abfrageKartenText({ ...o, art: 'abwesend' })).toBe(
      'Technik fragt für 3 Termine (05.12.–31.12.). Trag ein, wann du nicht kannst, und tippe auf „Fertig“.',
    );
    expect(abfrageKartenText({ ...o, art: 'zusagen' })).toBe(
      'Technik fragt für 3 Termine (05.12.–31.12.). Noch 2 offen.',
    );
  });
  it('Band und grünes Band', () => {
    expect(abfrageBandTextAbwesend({ gruppe: 'Technik', abfrage: ABFRAGE })).toBe(
      'Abfrage Technik · 05.12.–31.12. – Häkchen setzen, wo du nicht kannst, dann:',
    );
    expect(ABFRAGE_FERTIG_TEXT).toBe(
      'Danke! An allen anderen Terminen im Zeitraum kannst du. Ändern geht jederzeit.',
    );
  });
  it('Mail: der Standardtext je Art; ein eigener Text des Plans gilt für beide Arten', () => {
    expect(standardText('zusagen')).toBe(STANDARD_TEXT);
    expect(standardText('abwesend')).toBe(STANDARD_TEXT_ABWESEND);
    const link = 'https://ct.example/ccm/dienstplaner/#/abwesenheiten?abfrage=3';
    const mail = (
      art: 'zusagen' | 'abwesend',
      plan = { mail: null as null | { betreff: string; text: string } },
    ) => mailFuer(plan, ABFRAGE, 'Technik', link, art);
    const abw = mail('abwesend');
    expect(abw.html).toContain('an welchen Terminen du nicht kannst, und tippe auf „Fertig“');
    expect(abw.html).not.toContain('Ja, Vielleicht oder Nein');
    expect(abw.html).toContain(link);
    expect(mail('zusagen').html).toContain('Ja, Vielleicht oder Nein');
    expect(mail('zusagen').html).not.toContain('„Fertig“');
    const eigen = { mail: { betreff: 'Betreff', text: 'Mein Text {gruppe}' } };
    expect(mail('abwesend', eigen).html).toBe(mail('zusagen', eigen).html);
  });
});
