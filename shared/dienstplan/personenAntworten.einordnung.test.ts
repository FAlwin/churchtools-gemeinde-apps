import { describe, expect, it } from 'vitest';
import {
  antwortenFuerPlatz,
  antwortenSichtbar,
  antwortFuer,
  antwortenGelten,
  fragtNurAbwesend,
  antwortStufe,
  antwortZeile,
  KEINE_ANTWORTEN,
  STUFEN,
  zellenAntwort,
  type PersonenAntworten,
} from './personenAntworten';
import { abschnitteAus, kandidatenAus, type RohKandidat } from './werKann';
import { antwortBereinigt, type Antworten } from './verfuegbarkeit';

/**
 * E5c-4: Die EINE Einordnung einer Antwort (`antwortStufe`) und ihre Helfer. Tests gegen die Erzeuger: Antworten aus
 * `antwortBereinigt`, Kandidaten aus `kandidatenAus` (nicht von Hand gebaute Literale).
 */
const GESANG = 9;
const TON = 6;
const MUSIK = 4;
const TERMIN = 20;
const namen = (id: number) => ({ [GESANG]: 'Gesang', [TON]: 'Ton' })[id];

const DATEN: PersonenAntworten = {
  jePerson: new Map<number, Antworten>([
    [1, { [TERMIN]: antwortBereinigt({ a: 'ja', tag: '2026-12-06' }) }],
    [
      2,
      {
        [TERMIN]: antwortBereinigt({ a: 'vielleicht', tag: '2026-12-06', notiz: 'nur bis 12 Uhr' }),
      },
    ],
    [3, { [TERMIN]: antwortBereinigt({ a: 'ja', tag: '2026-12-06', dienste: [GESANG] }) }],
    [4, { 99: antwortBereinigt({ a: 'ja', tag: '2026-12-13' }) }], // anderer Termin
  ]),
  sichtbar: new Set([MUSIK]),
};

const fuer = (personId: number, dienstId: number) =>
  antwortFuer(DATEN, { gruppeId: MUSIK, personId, terminId: TERMIN, dienstId, dienstName: namen });

describe('antwortStufe (E5c-4)', () => {
  it('Ja, Vielleicht, keine Antwort', () => {
    expect(antwortStufe(false, fuer(1, TON))).toBe('ja');
    expect(antwortStufe(false, fuer(2, TON))).toBe('vielleicht');
    expect(antwortStufe(false, fuer(4, TON))).toBe('keine'); // Antwort nur auf einen anderen Termin
    expect(antwortStufe(false, null)).toBe('keine');
  });

  it('„nur bestimmte Dienste“: für den genannten Dienst gilt sie, für einen anderen = kann nicht', () => {
    expect(antwortStufe(false, fuer(3, GESANG))).toBe('ja');
    expect(antwortStufe(false, fuer(3, TON))).toBe('kannNicht');
  });

  it('abwesend schlägt die Antwort – auch ein Ja', () => {
    expect(antwortStufe(true, fuer(1, TON))).toBe('kannNicht');
    expect(antwortStufe(true, null)).toBe('kannNicht');
  });

  it('die Reihenfolge der Stufen: Ja, Vielleicht, keine, kann nicht', () => {
    expect(STUFEN).toEqual(['ja', 'vielleicht', 'keine', 'kannNicht']);
  });
});

describe('antwortFuer / antwortenFuerPlatz: Sichtbarkeit', () => {
  it('nicht sichtbare Gruppe: keine Antwort und keine Map – nicht „keine Antwort“ für alle', () => {
    const o = { gruppeId: 3, terminId: TERMIN, dienstId: TON, dienstName: namen };
    expect(antwortFuer(DATEN, { ...o, personId: 1 })).toBeNull();
    expect(antwortenFuerPlatz(DATEN, o)).toBeNull();
    expect(antwortenFuerPlatz(KEINE_ANTWORTEN, { ...o, gruppeId: MUSIK })).toBeNull();
    expect(antwortenFuerPlatz(null, o)).toBeNull();
    expect(antwortenFuerPlatz(DATEN, { ...o, gruppeId: null })).toBeNull();
    expect(antwortenSichtbar(DATEN, MUSIK)).toBe(true);
    expect(antwortenSichtbar(DATEN, 3)).toBe(false);
  });

  it('sichtbar: nur wer auf DIESEN Termin geantwortet hat', () => {
    const m = antwortenFuerPlatz(DATEN, {
      gruppeId: MUSIK,
      terminId: TERMIN,
      dienstId: TON,
      dienstName: namen,
    });
    expect([...(m?.keys() ?? [])].sort()).toEqual([1, 2, 3]);
    expect(m?.get(3)).toEqual(zellenAntwort(DATEN.jePerson.get(3)?.[TERMIN], TON, namen));
  });
});

describe('„Nur abwesend“ (V-5): Ja/Vielleicht gelten nicht', () => {
  const NUR_ABWESEND: PersonenAntworten = { ...DATEN, nurAbwesend: new Set([MUSIK]) };
  const o = { gruppeId: MUSIK, terminId: TERMIN, dienstId: TON, dienstName: namen };

  it('antwortFuer und antwortenFuerPlatz geben nichts – wie vor E5c, nur die Abwesenheit zählt', () => {
    expect(antwortFuer(NUR_ABWESEND, { ...o, personId: 1 })).toBeNull();
    expect(antwortenFuerPlatz(NUR_ABWESEND, o)).toBeNull();
    expect(antwortenGelten(NUR_ABWESEND, MUSIK)).toBe(false);
    expect(fragtNurAbwesend(NUR_ABWESEND, MUSIK)).toBe(true);
  });

  it('nur ausgeblendet: die Antworten bleiben geladen, die Gruppe bleibt sichtbar', () => {
    expect(antwortenSichtbar(NUR_ABWESEND, MUSIK)).toBe(true);
    expect(NUR_ABWESEND.jePerson.get(1)?.[TERMIN]?.a).toBe('ja');
  });

  it('andere Gruppen und „fehlt“ (= keine) bleiben bei Zusagen', () => {
    expect(fragtNurAbwesend(DATEN, MUSIK)).toBe(false);
    expect(antwortenGelten(DATEN, MUSIK)).toBe(true);
    expect(fragtNurAbwesend({ nurAbwesend: new Set([3]) }, MUSIK)).toBe(false);
    expect(fragtNurAbwesend(NUR_ABWESEND, null)).toBe(false);
    expect(antwortFuer(DATEN, { ...o, personId: 1 })?.a).toBe('ja');
  });
});

describe('antwortZeile (zweite Zeile unter dem Namen)', () => {
  it('Notiz kursiv als Vielleicht: „…“; ohne Notiz keine Zeile', () => {
    expect(antwortZeile(fuer(2, TON), false)).toBe('Vielleicht: „nur bis 12 Uhr“');
    expect(antwortZeile(fuer(1, TON), false)).toBeNull();
    expect(antwortZeile(null, false)).toBeNull();
  });

  it('nur andere Dienste: derselbe Text wie im Raster („Ja – nur für Gesang“)', () => {
    expect(antwortZeile(fuer(3, TON), false)).toBe('Ja – nur für Gesang');
  });

  it('abwesend trotz Ja: sagt es', () => {
    expect(antwortZeile(fuer(1, TON), true)).toBe('Ja – aber abwesend');
  });
});

describe('abschnitteAus („Wer kann?“, Variante A)', () => {
  const roh = (id: number, name: string, o: Partial<RohKandidat> = {}): RohKandidat => ({
    person: { domainIdentifier: String(id), title: name },
    score: 0,
    ...o,
  });
  const liste = kandidatenAus(
    [
      roh(5, 'Egon', { score: 9 }),
      roh(1, 'Anna', { score: 5 }),
      roh(2, 'Ben', { score: 4 }),
      roh(3, 'Clara', { score: 3 }),
      roh(6, 'Dora', { score: 2, absences: [{ absenceReason: { nameTranslated: 'Urlaub' } }] }),
      roh(7, 'Finn', { score: 1 }),
    ],
    { monat: '2026-12', schonDa: new Set() },
  );
  // Dora ist abwesend UND hat Ja gesagt.
  const antworten = new Map([
    ...(antwortenFuerPlatz(DATEN, {
      gruppeId: MUSIK,
      terminId: TERMIN,
      dienstId: TON,
      dienstName: namen,
    }) ?? []),
    [6, zellenAntwort(antwortBereinigt({ a: 'ja', tag: '2026-12-06' }), TON, namen)!] as const,
  ]);

  it('vier Abschnitte in fester Reihenfolge, in jedem die Reihenfolge von oben', () => {
    const a = abschnitteAus(liste, antworten);
    expect(a?.map((x) => [x.stufe, x.personen.map((p) => p.kandidat.name)])).toEqual([
      ['ja', ['Anna']],
      ['vielleicht', ['Ben']],
      ['keine', ['Egon', 'Finn']],
      ['kannNicht', ['Clara', 'Dora']], // Clara: Ja nur für Gesang; Dora: abwesend trotz Ja
    ]);
  });

  it('Antworten nicht sichtbar (null) → keine Abschnitte, nicht „alle ohne Antwort“', () => {
    expect(abschnitteAus(liste, null)).toBeNull();
  });
});
