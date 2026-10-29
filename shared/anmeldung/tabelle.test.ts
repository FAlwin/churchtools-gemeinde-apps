import { describe, expect, it } from 'vitest';
import { anmeldungenAus, antwortText, listenZahlen, mitgliederstandAus } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import { fragen } from './druckliste';
import type { Feld } from './formular';
import { euroText } from './preis';
import {
  anmeldungsSpalten,
  frageSumme,
  mehrfachAntworten,
  passtZurSuche,
  sortiert,
  summe,
  zellText,
} from './tabelle';

/**
 * Tabelle der Anmeldungen (U2-1): Spalten aus dem Formular, Zellen, Summen und Sortierung – gegen die Anmeldungen, wie
 * das Formular sie schreibt (`liste.testdaten.ts`: Kinder-Event, Maria meldet Jonas und Lena an), und gegen die
 * Erzeuger, die Druckliste und Kacheln schon benutzen (`fragen`, `antwortText`, `listenZahlen`).
 */
const liste = (x = e()) => {
  const roh = [
    ...mitglieder('AAAAAA', [true, true], 10, { bezahlt: true }),
    ...mitglieder('BBBBBB', [true, false], 20),
    ...mitglieder('CCCCCC', [false, false], 30),
  ];
  const personen = new Map([
    ...PERSONEN,
    [20, { name: 'Jonas Beispiel', email: null, geburtstag: '2017-05-01' }],
    [21, { name: 'Lena Beispiel', email: null, geburtstag: '2019-02-02' }],
    [30, { name: 'Jonas Beispiel', email: null, geburtstag: '2017-05-01' }],
    [31, { name: 'Lena Beispiel', email: null, geburtstag: '2019-02-02' }],
  ]);
  return anmeldungenAus(x, mitgliederstandAus(roh, [], FELDER, new Set([35]), personen), STICHTAG);
};

const feld = (typ: Feld['typ'], antworten: string[] = [], verborgen?: string[]): Feld => ({
  id: 'f1',
  art: 'eigen',
  typ,
  frage: 'Frage',
  hilfe: '',
  zustand: 'freiwillig',
  antworten,
  ...(verborgen ? { verborgen } : {}),
});

describe('Spalten je Anmeldung', () => {
  it('Name, Nr., Personen, die Fragen der Anmeldung (wie die Druckliste), Betrag, Bezahlt, Angemeldet am', () => {
    const x = e();
    const titel = anmeldungsSpalten(x, { kostet: true, warteliste: false }).map((s) => s.titel);
    const fragenDerAnmeldung = fragen(x)
      .filter((f) => x.formular.anmeldung.includes(f))
      .map((f) => f.frage);
    expect(fragenDerAnmeldung.length).toBeGreaterThan(0);
    expect(titel).toEqual([
      'Name',
      'Nr.',
      'Personen',
      ...fragenDerAnmeldung,
      'Betrag',
      'Bezahlt',
      'Angemeldet am',
    ]);
    // Fragen je Person (Allergien …) kommen erst mit „je Person“ (U2-2).
    const jePerson = fragen(x).filter((f) => x.formular.person.includes(f));
    for (const f of jePerson) expect(titel).not.toContain(f.frage);
  });

  it('kostet nichts → ohne Betrag und Bezahlt; Warteliste → Warteplatz nach der Nr.', () => {
    const k = anmeldungsSpalten(e(), { kostet: false, warteliste: true }).map((s) => s.schluessel);
    expect(k).not.toContain('betrag');
    expect(k).not.toContain('bezahlt');
    expect(k.slice(0, 4)).toEqual(['name', 'nr', 'warteplatz', 'personen']);
  });

  it('Zelle einer Frage = die Antwort, wie das Fenster sie zeigt (`antwortText` aus den Werten der Anmeldung)', () => {
    const x = e();
    const [a] = liste(x);
    for (const f of fragen(x).filter((y) => x.formular.anmeldung.includes(y)))
      expect(zellText(x, `frage:${f.id}`, a)).toBe(antwortText(f, a.einmal, x.ctFelder) ?? '');
    expect(zellText(x, 'frage:tel', a)).toBe('0151 111');
    expect(zellText(x, 'name', a)).toBe('Maria Beispiel');
    expect(zellText(x, 'nr', a)).toBe('AAAAAA');
  });
});

describe('Summen', () => {
  it('Personen und Beträge wie die Kacheln (`listenZahlen`)', () => {
    const x = e();
    const l = liste(x);
    const z = listenZahlen(x, l);
    expect(summe(x, 'name', l)?.text).toBe('3 Anmeldungen');
    expect(summe(x, 'personen', l)).toEqual({
      text: `${z.belegt} Personen`,
      klein: `+ ${z.wartend} auf der Warteliste`,
    });
    expect(summe(x, 'betrag', l)).toEqual({
      text: euroText(z.offenCent + z.eingegangenCent),
      klein: `${euroText(z.offenCent)} offen · ${euroText(z.eingegangenCent)} eingegangen`,
    });
    expect(summe(x, 'bezahlt', l)?.text).toBe('1× bezahlt');
    expect(summe(x, 'am', l)).toBeNull();
  });

  it('Fragen zählen nur Anmeldungen mit Platz – im Reiter Warteliste (alle warten) die Wartenden', () => {
    const x = e();
    const l = liste(x);
    // Alle drei haben Telefon – zwei mit Platz, eine wartet ganz.
    expect(summe(x, 'frage:tel', l)?.text).toBe('2 ausgefüllt');
    const nurWartend = l.filter((a) => a.personen.every((p) => p.status === 'wartet'));
    expect(summe(x, 'frage:tel', nurWartend)?.text).toBe('1 ausgefüllt');
  });

  it('je Art: Zahl → Summe, Ja/Nein → Anzahl Ja, Ankreuzen, Auswahl je Antwort, Text → ausgefüllt', () => {
    expect(frageSumme(feld('number'), ['2', '3,5', null, '', 'x'])?.text).toBe('5,5');
    expect(frageSumme(feld('janein'), ['Ja', 'Nein', 'Ja', null])?.text).toBe('2× Ja');
    expect(frageSumme(feld('check'), ['ja', null, 'ja'])?.text).toBe('2× angekreuzt');
    expect(frageSumme(feld('select', ['Groß', 'Klein']), ['Klein', 'Groß', 'Klein'])).toEqual({
      text: 'Groß 1 · Klein 2',
      klein: 'Anmeldungen je Antwort',
    });
    expect(frageSumme(feld('text'), ['a', '', null, 'b'])?.text).toBe('2 ausgefüllt');
    expect(frageSumme(feld('radio', ['A']), [null])).toBeNull();
  });

  it('Mehrfachauswahl: je Antwort, auch mit Komma in der Antwort, verborgene und unbekannte hinten', () => {
    const f = feld('multi', ['Fr', 'Sa, abends', 'So'], ['Do']);
    expect(mehrfachAntworten(f, 'Fr, Sa, abends')).toEqual(['Fr', 'Sa, abends']);
    expect(mehrfachAntworten(f, null)).toEqual([]);
    expect(frageSumme(f, ['Fr, Sa, abends', 'Do, So', 'Fr'])?.text).toBe(
      'Fr 2 · Sa, abends 1 · So 1 · Do 1',
    );
    expect(frageSumme(feld('select', ['A']), ['A', 'Alt'])?.text).toBe('A 1 · Alt 1');
  });
});

describe('Sortieren und Suchen', () => {
  it('ohne Wahl Reihenfolge der Liste, auf der Warteliste nach Warteplatz', () => {
    const x = e();
    const l = liste(x);
    expect(sortiert(x, l, null)).toBe(l);
    const warte = sortiert(x, l, null, true);
    expect(warte.map((a) => a.nr)).toEqual(['BBBBBB', 'CCCCCC', 'AAAAAA']);
  });

  it('Zahlen als Zahl, Text deutsch, absteigend umgekehrt – Leere bleiben hinten', () => {
    const x = e();
    const l = liste(x);
    const nach = (k: string, absteigend: boolean) =>
      sortiert(x, l, { schluessel: k, absteigend }).map((a) => a.nr);
    expect(nach('personen', false)).toEqual(['CCCCCC', 'BBBBBB', 'AAAAAA']);
    expect(nach('personen', true)).toEqual(['AAAAAA', 'BBBBBB', 'CCCCCC']);
    expect(nach('nr', true)).toEqual(['CCCCCC', 'BBBBBB', 'AAAAAA']);
    // Bezahlt: nur AAAAAA bezahlt, CCCCCC hat keinen Betrag (alle warten) → hinten, egal in welcher Richtung.
    expect(nach('bezahlt', false).at(-1)).toBe('CCCCCC');
    expect(nach('bezahlt', true).at(-1)).toBe('CCCCCC');
    expect(nach('bezahlt', true)[0]).toBe('AAAAAA');
  });

  it('Suche: Name, Nr. und jede Person', () => {
    const [a] = liste();
    expect(passtZurSuche(a, '')).toBe(true);
    expect(passtZurSuche(a, 'aaaa')).toBe(true);
    expect(passtZurSuche(a, 'lena')).toBe(true);
    expect(passtZurSuche(a, 'Paul')).toBe(false);
  });
});
