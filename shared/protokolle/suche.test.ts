import { describe, expect, it } from 'vitest';
import { alsGeloescht, neueAufgabe, statusSetzen, type Aufgabe } from './aufgaben';
import type { Block } from './dokument';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from './speicher';
import type { Sitzung } from './sitzungen';
import { begriffe, fundstellen, suchen, suchIndex, type SuchGruppe } from './suche';

const t = (text: string) => [{ type: 'text', text, styles: {} }];
const punkt = (id: string, titel: string): Block => ({
  id,
  type: 'heading',
  props: { level: 1 },
  content: t(titel),
  children: [],
});
const absatz = (id: string, text: string, children: Block[] = []): Block => ({
  id,
  type: 'paragraph',
  content: t(text),
  children,
});
const beschluss = (id: string, text: string): Block => ({
  id,
  type: 'beschluss',
  content: t(text),
  children: [],
});
const aufgabeBlock = (id: string, aufgabe: string, text: string): Block => ({
  id,
  type: 'aufgabe',
  props: { aufgabe },
  content: t(text),
  children: [],
});
const termin = (id: string, datum: string, text: string): Block => ({
  id,
  type: 'termin',
  props: { datum },
  content: t(text),
  children: [],
});

/** Ein Protokoll im echten Speicherformat: Kopf + Teile aus `teileBauen`. */
function protokoll(
  sitzung: string,
  titel: string,
  beginn: string,
  status: ProtokollKopf['status'],
  dokument: Block[],
): { s: Sitzung; teile: ProtokollTeil[] } {
  const { stand, werte } = teileBauen(dokument, sitzung);
  const kopf: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    sitzung,
    titel,
    status,
    beginn,
    termin: null,
    treffen: null,
    freigabe: status === 'frei' ? { von: 1, am: beginn } : null,
    sperre: null,
    stand,
  };
  return {
    s: {
      schluessel: `p:${sitzung}`,
      beginn,
      titel,
      termin: null,
      treffen: null,
      kopf,
      anfragen: [],
    },
    teile: werte.map((w) => JSON.parse(w) as ProtokollTeil),
  };
}

const aufgabe = (id: string, sitzung: string | null, text: string): Aufgabe =>
  neueAufgabe({ id, gruppe: 11, sitzung, text, wer: [1], von: 1, am: '2026-10-14T18:00:00Z' });

const OKT = protokoll('okt', 'Leitungssitzung', '2026-10-14T17:00:00Z', 'frei', [
  absatz('vorweg', 'Begrüßung durch Peter'),
  punkt('p1', 'Technik'),
  absatz('a1', 'Der alte Beamer fällt immer wieder aus.', [absatz('a1u', 'Ton ebenfalls prüfen')]),
  beschluss('b1', 'Zweites Beamer-Angebot wird angenommen.'),
  aufgabeBlock('x1', 'auf-1', 'Angebote einholen'),
  punkt('p2', 'Freizeit'),
  beschluss('b2', 'Gemeindefreizeit 2027 im Hunsrück.'),
  termin('t1', '2027-01-15', 'Anmeldung öffnet'),
]);
const SEPT = protokoll('sept', 'Leitungssitzung September', '2026-09-09T17:00:00Z', 'frei', [
  punkt('q1', 'Finanzen'),
  beschluss('c1', 'Kollekte im Oktober geht an die Mission.'),
]);
const ENTWURF = protokoll('nov', 'Leitungssitzung November', '2026-11-11T18:00:00Z', 'entwurf', [
  punkt('r1', 'Technik'),
  beschluss('d1', 'Noch nicht beschlossen: neuer Beamer.'),
  aufgabeBlock('y1', 'auf-2', 'Kabel kaufen'),
]);
const JUGEND = protokoll('jug', 'Teamtreffen', '2026-10-02T16:00:00Z', 'frei', [
  punkt('j1', 'Räume'),
  beschluss('e1', 'Jugendraum wird im November gestrichen.'),
]);

const LEITUNG: SuchGruppe = {
  gruppe: { id: 11, name: 'Leitungsteam' },
  sitzungen: {
    kommend: [ENTWURF.s],
    protokolle: [OKT.s, SEPT.s],
    teile: [...OKT.teile, ...SEPT.teile, ...ENTWURF.teile],
  },
  aufgaben: [
    statusSetzen(
      aufgabe('auf-1', 'okt', 'Beamer-Angebote einholen'),
      'arbeit',
      1,
      '2026-10-20T08:00:00Z',
    ),
    aufgabe('auf-2', 'nov', 'Kabel kaufen'),
    aufgabe('auf-3', 'weg', 'Schlüssel abgeben'),
    alsGeloescht(aufgabe('auf-4', 'okt', 'Beamer gelöscht'), 1, '2026-10-21T08:00:00Z'),
  ],
};
const JUGENDLEITUNG: SuchGruppe = {
  gruppe: { id: 7, name: 'Jugendleitung' },
  sitzungen: { kommend: [], protokolle: [JUGEND.s], teile: JUGEND.teile },
  aufgaben: [],
};
const INDEX = suchIndex([LEITUNG, JUGENDLEITUNG]);
const texte = (liste: { text: string }[]) => liste.map((e) => e.text);

describe('suchIndex (S3-4)', () => {
  it('Beschlüsse nur aus freigegebenen Protokollen – neueste Sitzung zuerst, im Dokument der Reihe nach', () => {
    expect(texte(INDEX.filter((e) => e.art === 'beschluss'))).toEqual([
      'Zweites Beamer-Angebot wird angenommen.',
      'Gemeindefreizeit 2027 im Hunsrück.',
      'Jugendraum wird im November gestrichen.',
      'Kollekte im Oktober geht an die Mission.',
    ]);
  });

  it('Beschluss mit Gruppe, Sitzung und Tagesordnungspunkt (Nummer aus der Ableitung)', () => {
    const b = INDEX.find((e) => e.text.startsWith('Gemeindefreizeit'))!;
    expect(b.gruppe).toEqual({ id: 11, name: 'Leitungsteam' });
    expect(b.sitzung).toEqual({
      schluessel: 'p:okt',
      titel: 'Leitungssitzung',
      beginn: '2026-10-14T17:00:00Z',
    });
    expect(b.punkt).toEqual({ blockId: 'p2', nummer: 2, titel: 'Freizeit' });
  });

  it('Termine mit Datum; Protokolltext auch aus Unterpunkten – aber keine Punkt-Überschriften', () => {
    const termin = INDEX.find((e) => e.art === 'termin')!;
    expect([termin.text, termin.datum, termin.punkt?.titel]).toEqual([
      'Anmeldung öffnet',
      '2027-01-15',
      'Freizeit',
    ]);
    expect(
      texte(INDEX.filter((e) => e.art === 'text' && e.sitzung?.schluessel === 'p:okt')),
    ).toEqual([
      'Begrüßung durch Peter',
      'Der alte Beamer fällt immer wieder aus.',
      'Ton ebenfalls prüfen',
    ]);
    expect(INDEX.find((e) => e.text === 'Begrüßung durch Peter')?.punkt).toBeNull();
    expect(INDEX.find((e) => e.text === 'Ton ebenfalls prüfen')?.punkt?.titel).toBe('Technik');
  });

  it('To-Dos aus allen Protokollen (auch Entwurf), mit Stand und Punkt; gelöschte nie, ohne Protokoll am Ende', () => {
    const todos = INDEX.filter((e) => e.art === 'aufgabe');
    expect(texte(todos)).toEqual(['Kabel kaufen', 'Beamer-Angebote einholen', 'Schlüssel abgeben']);
    expect(todos[0].punkt?.titel).toBe('Technik');
    expect(todos[0].sitzung?.schluessel).toBe('p:nov');
    expect(todos[1].aufgabe?.status).toBe('arbeit');
    expect(todos[1].punkt).toEqual({ blockId: 'p1', nummer: 1, titel: 'Technik' });
    expect([todos[2].sitzung, todos[2].punkt]).toEqual([null, null]);
  });

  it('nichts aus dem Entwurf außer seinen To-Dos', () => {
    expect(INDEX.filter((e) => e.sitzung?.schluessel === 'p:nov').map((e) => e.art)).toEqual([
      'aufgabe',
    ]);
  });

  it('ein Protokoll, dessen Teile fehlen, fällt still weg – kein halber Stand', () => {
    const ohneTeile = suchIndex([
      { ...LEITUNG, sitzungen: { ...LEITUNG.sitzungen, teile: SEPT.teile } },
    ]);
    expect(texte(ohneTeile.filter((e) => e.art === 'beschluss'))).toEqual([
      'Kollekte im Oktober geht an die Mission.',
    ]);
    // Das To-Do kennt seine Sitzung noch, nur den Punkt nicht.
    const todo = ohneTeile.find((e) => e.text === 'Beamer-Angebote einholen')!;
    expect([todo.sitzung?.schluessel, todo.punkt]).toEqual(['p:okt', null]);
  });
});

describe('suchen (S3-4)', () => {
  const frage = { begriff: '', art: 'alles' as const, gruppe: null };

  it('ohne Begriff: kein Protokolltext; „Beschlüsse“ ist die Übersicht aller Beschlüsse', () => {
    expect(suchen(INDEX, frage).some((e) => e.art === 'text')).toBe(false);
    expect(suchen(INDEX, { ...frage, art: 'beschluss' })).toHaveLength(4);
    expect(suchen(INDEX, { ...frage, art: 'text' })).toEqual([]);
  });

  it('findet über alle Arten – Groß-/Kleinschreibung egal', () => {
    const treffer = suchen(INDEX, { ...frage, begriff: 'BEAMER' });
    expect(treffer.map((e) => [e.art, e.text])).toEqual([
      ['text', 'Der alte Beamer fällt immer wieder aus.'],
      ['beschluss', 'Zweites Beamer-Angebot wird angenommen.'],
      ['aufgabe', 'Beamer-Angebote einholen'],
    ]);
  });

  it('sucht auch im Tagesordnungspunkt und im Sitzungstitel', () => {
    expect(texte(suchen(INDEX, { ...frage, art: 'beschluss', begriff: 'freizeit' }))).toEqual([
      'Gemeindefreizeit 2027 im Hunsrück.',
    ]);
    expect(texte(suchen(INDEX, { ...frage, art: 'beschluss', begriff: 'september' }))).toEqual([
      'Kollekte im Oktober geht an die Mission.',
    ]);
    // „Technik“ steht nur im Punkt: Beschluss, Text und To-Do darunter.
    expect(suchen(INDEX, { ...frage, begriff: 'technik' }).map((e) => e.art)).toEqual([
      'aufgabe',
      'text',
      'text',
      'beschluss',
      'aufgabe',
    ]);
  });

  it('mehrere Wörter: alle müssen vorkommen', () => {
    expect(texte(suchen(INDEX, { ...frage, begriff: 'beamer angebot' }))).toEqual([
      'Zweites Beamer-Angebot wird angenommen.',
      'Beamer-Angebote einholen',
    ]);
    expect(suchen(INDEX, { ...frage, begriff: 'beamer mission' })).toEqual([]);
  });

  it('Filter nach Art und Gruppe', () => {
    expect(texte(suchen(INDEX, { ...frage, art: 'beschluss', gruppe: 7 }))).toEqual([
      'Jugendraum wird im November gestrichen.',
    ]);
    expect(texte(suchen(INDEX, { begriff: 'november', art: 'beschluss', gruppe: 11 }))).toEqual([]);
    expect(texte(suchen(INDEX, { begriff: 'kabel', art: 'aufgabe', gruppe: 11 }))).toEqual([
      'Kabel kaufen',
    ]);
  });
});

describe('begriffe und fundstellen (S3-4)', () => {
  it('Wörter klein, ohne Leerstellen', () => {
    expect(begriffe('  Beamer   ANGEBOT ')).toEqual(['beamer', 'angebot']);
    expect(begriffe('   ')).toEqual([]);
  });

  it('alle Stellen, sortiert; überlappende zusammengelegt', () => {
    expect(fundstellen('Beamer und beamer', ['beamer'])).toEqual([
      { von: 0, bis: 6 },
      { von: 11, bis: 17 },
    ]);
    expect(fundstellen('Beamer-Angebot', ['angebot', 'beamer-an'])).toEqual([{ von: 0, bis: 14 }]);
    expect(fundstellen('Gemeindefreizeit', ['xyz'])).toEqual([]);
  });

  it('Umlaute und ß bleiben an ihrer Stelle', () => {
    expect(fundstellen('Schlüssel für Grüße', ['grüße'])).toEqual([{ von: 14, bis: 19 }]);
  });
});
