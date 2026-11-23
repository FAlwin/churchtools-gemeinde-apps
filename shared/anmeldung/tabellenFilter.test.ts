import { describe, expect, it } from 'vitest';
import { anmeldungenAus, mitgliederstandAus, type ListenAnmeldung } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import { antworten } from './senden.testdaten';
import type { Feld, OeffentlicheEinstellungen, SpaltenFilter } from './formular';
import { personZeilen, spaltenKatalog } from './tabelle';
import {
  filterAntworten,
  filterArt,
  filterBereinigt,
  filterName,
  filterSetzen,
  filterText,
  filterVollstaendig,
  gefilterteListe,
  passtAnmeldung,
  passtPerson,
} from './tabellenFilter';

/**
 * Filter der Tabelle (R2) – gegen Anmeldungen, wie das Formular sie schreibt (`liste.testdaten.ts`, Kinder-Event):
 *  - AAAAAA: bezahlt, Jonas (9, Allergie „Nüsse“, Fotos Ja) und Lena (7, keine Allergie, Fotos Nein) mit Platz,
 *  - BBBBBB: offen, dieselben Antworten, Lena auf der Warteliste,
 *  - CCCCCC: offen, keine Allergien, beide Fotos Nein, kein Telefon.
 */
const ohneAllergie = () => {
  const a = antworten();
  a.anmeldung.tel = '';
  a.personen = a.personen.map((p) => ({ ...p, allergy: '', foto: 'Nein' }));
  return a;
};
const personen = new Map([
  ...PERSONEN,
  ...[20, 30].map((id) => [id, PERSONEN.get(10)!] as const),
  ...[21, 31].map((id) => [id, PERSONEN.get(11)!] as const),
]);
const liste = (x: OeffentlicheEinstellungen = e()) => {
  const roh = [
    ...mitglieder('AAAAAA', [true, true], 10, { bezahlt: true }),
    ...mitglieder('BBBBBB', [true, false], 20),
    ...mitglieder('CCCCCC', [true, true], 30, { antworten: ohneAllergie() }),
  ];
  return anmeldungenAus(x, mitgliederstandAus(roh, [], FELDER, new Set([35]), personen), STICHTAG);
};

const nrs = (l: ListenAnmeldung[]) => l.map((x) => x.nr);
const je = (filter: SpaltenFilter[], x = e(), l = liste(x)) =>
  nrs(l.filter((a) => passtAnmeldung(x, filter, a)));
const jePerson = (filter: SpaltenFilter[], x = e(), l = liste(x)) =>
  personZeilen(l)
    .filter((z) => passtPerson(x, filter, z))
    .map((z) => `${z.p.vor} ${z.x.nr}`);

const FOTO = 'frage:foto';
const ALLERGIE = 'frage:allergy';

describe('Welche Spalte wie gefiltert wird', () => {
  it('nach der Art der Spalte – Name, Nr., Datum ohne Trichter', () => {
    const x = e();
    const art = (m: 'anmeldung' | 'person') =>
      Object.fromEntries(
        spaltenKatalog(x, m).map((s) => [s.schluessel, filterArt(x, s.schluessel)]),
      );
    expect(art('anmeldung')).toMatchObject({
      name: null,
      nr: null,
      am: null,
      personen: 'zahl',
      betrag: 'zahl',
      bezahlt: 'antworten',
      'frage:tel': 'text',
    });
    expect(art('person')).toMatchObject({
      vor: null,
      nach: null,
      geburtstag: null,
      status: 'antworten',
      alter: 'zahl',
      kontakt: 'text',
      [FOTO]: 'antworten',
      [ALLERGIE]: 'text',
    });
  });

  it('Antworten zur Wahl: Ja/Nein, bezahlt/offen, Platz/Warteliste; der Name der Spalte wie in der Tabelle', () => {
    const x = e();
    expect(filterAntworten(x, FOTO)).toEqual(['Ja', 'Nein']);
    expect(filterAntworten(x, 'bezahlt')).toEqual(['bezahlt', 'offen']);
    expect(filterAntworten(x, 'status')).toEqual(['Platz', 'Warteliste']);
    expect(filterName(x, 'betrag')).toBe('Betrag');
    expect(filterName(x, FOTO)).toBe('Dürfen Fotos veröffentlicht w…');
  });
});

describe('Passt die Anmeldung? (je Anmeldung)', () => {
  it('Antworten: eine davon reicht', () => {
    expect(je([{ spalte: FOTO, werte: ['Ja'] }])).toEqual(['AAAAAA', 'BBBBBB']);
    expect(je([{ spalte: FOTO, werte: ['Nein'] }])).toEqual(['AAAAAA', 'BBBBBB', 'CCCCCC']);
    expect(je([{ spalte: 'bezahlt', werte: ['offen'] }])).toEqual(['BBBBBB', 'CCCCCC']);
    expect(je([{ spalte: 'bezahlt', werte: ['bezahlt', 'offen'] }])).toEqual([
      'AAAAAA',
      'BBBBBB',
      'CCCCCC',
    ]);
    expect(je([{ spalte: 'status', werte: ['Warteliste'] }])).toEqual(['BBBBBB']);
  });

  it('mehrere Filter gelten zusammen – Filter je Person muss EINE Person alle erfüllen (E4)', () => {
    expect(
      je([
        { spalte: ALLERGIE, text: 'ausgefuellt' },
        { spalte: FOTO, werte: ['Ja'] },
      ]),
    ).toEqual(['AAAAAA', 'BBBBBB']);
    // Jonas hat Nüsse (Fotos Ja), Lena Fotos Nein (keine Allergie) – niemand hat beides.
    expect(
      je([
        { spalte: ALLERGIE, text: 'ausgefuellt' },
        { spalte: FOTO, werte: ['Nein'] },
      ]),
    ).toEqual([]);
    expect(
      je([
        { spalte: 'bezahlt', werte: ['offen'] },
        { spalte: FOTO, werte: ['Ja'] },
      ]),
    ).toEqual(['BBBBBB']);
  });

  it('Zahlen ab/bis – Betrag in Euro, Personen, Alter', () => {
    expect(je([{ spalte: 'betrag', ab: 10, bis: null }])).toEqual(['AAAAAA', 'CCCCCC']);
    expect(je([{ spalte: 'betrag', ab: null, bis: 6 }])).toEqual(['BBBBBB']);
    expect(je([{ spalte: 'betrag', ab: 6, bis: 6 }])).toEqual(['BBBBBB']);
    expect(je([{ spalte: 'personen', ab: 3, bis: null }])).toEqual([]);
    expect(je([{ spalte: 'personen', ab: 2, bis: 2 }])).toEqual(['AAAAAA', 'BBBBBB', 'CCCCCC']);
    expect(je([{ spalte: 'alter', ab: 8, bis: null }])).toEqual(['AAAAAA', 'BBBBBB', 'CCCCCC']);
    expect(je([{ spalte: 'alter', ab: 10, bis: null }])).toEqual([]);
  });

  it('Text ausgefüllt / leer / enthält (ohne Groß und klein)', () => {
    expect(je([{ spalte: 'frage:tel', text: 'ausgefuellt' }])).toEqual(['AAAAAA', 'BBBBBB']);
    expect(je([{ spalte: 'frage:tel', text: 'leer' }])).toEqual(['CCCCCC']);
    expect(je([{ spalte: ALLERGIE, text: 'enthaelt', suche: 'NÜSS' }])).toEqual([
      'AAAAAA',
      'BBBBBB',
    ]);
    // Jede Anmeldung hat eine Person ohne Allergie.
    expect(je([{ spalte: ALLERGIE, text: 'leer' }])).toEqual(['AAAAAA', 'BBBBBB', 'CCCCCC']);
    expect(je([{ spalte: 'kontakt', text: 'enthaelt', suche: 'maria' }])).toHaveLength(3);
  });

  it('ohne Filter passt alles', () => {
    expect(je([])).toEqual(['AAAAAA', 'BBBBBB', 'CCCCCC']);
  });
});

describe('Passt die Person? (je Person, E4)', () => {
  it('Fragen je Person prüfen die Person, Angaben der Anmeldung die Anmeldung', () => {
    expect(jePerson([{ spalte: FOTO, werte: ['Ja'] }])).toEqual(['Jonas AAAAAA', 'Jonas BBBBBB']);
    expect(jePerson([{ spalte: ALLERGIE, text: 'leer' }])).toEqual([
      'Lena AAAAAA',
      'Lena BBBBBB',
      'Jonas CCCCCC',
      'Lena CCCCCC',
    ]);
    expect(jePerson([{ spalte: 'status', werte: ['Warteliste'] }])).toEqual(['Lena BBBBBB']);
    expect(jePerson([{ spalte: 'alter', ab: null, bis: 8 }])).toEqual([
      'Lena AAAAAA',
      'Lena BBBBBB',
      'Lena CCCCCC',
    ]);
    // Bezahlt gehört der Anmeldung – es gilt für jede ihrer Personen.
    expect(jePerson([{ spalte: 'bezahlt', werte: ['offen'] }])).toEqual([
      'Jonas BBBBBB',
      'Lena BBBBBB',
      'Jonas CCCCCC',
      'Lena CCCCCC',
    ]);
  });
});

describe('Auswahl, Mehrfachauswahl, Zahlenfrage', () => {
  // Eine Frage der Anmeldung mit Gruppenfeld; der Wert steht, wie ChurchTools ihn liefert (Mehrfachauswahl mit Komma).
  const mitFrage = (f: Feld, id: number) => {
    const x = e();
    x.formular.anmeldung.push(f);
    x.ctFelder = { ...x.ctFelder, [f.id]: id };
    return x;
  };
  const frage = (id: string, typ: Feld['typ'], antworten: string[] = []): Feld => ({
    id,
    art: 'eigen',
    typ,
    frage: id,
    hilfe: '',
    zustand: 'freiwillig',
    antworten,
  });

  it('Mehrfachauswahl: eine der gewählten Antworten reicht', () => {
    const x = mitFrage(frage('tage', 'multi', ['Fr', 'Sa', 'So']), 700);
    const l = liste(x);
    l[0].einmal[700] = 'Fr, Sa';
    l[1].einmal[700] = 'So';
    expect(filterArt(x, 'frage:tage')).toBe('antworten');
    expect(filterAntworten(x, 'frage:tage')).toEqual(['Fr', 'Sa', 'So']);
    expect(je([{ spalte: 'frage:tage', werte: ['Sa'] }], x, l)).toEqual(['AAAAAA']);
    expect(je([{ spalte: 'frage:tage', werte: ['Sa', 'So'] }], x, l)).toEqual(['AAAAAA', 'BBBBBB']);
  });

  it('Auswahl mit freier Antwort: gefiltert wird nach ihrer Beschriftung, nicht nach dem Getippten', () => {
    const f = {
      ...frage('hilfe', 'radio', ['Küche']),
      frei: { name: 'Sonstiges', textfeld: 'auf' as const },
    };
    const x = mitFrage(f, 701);
    x.ctFelder['hilfe.frei'] = 702;
    const l = liste(x);
    l[0].einmal[701] = 'Küche';
    l[1].einmal[701] = 'Sonstiges';
    l[1].einmal[702] = 'Fotos machen';
    expect(filterAntworten(x, 'frage:hilfe')).toEqual(['Küche', 'Sonstiges']);
    expect(je([{ spalte: 'frage:hilfe', werte: ['Sonstiges'] }], x, l)).toEqual(['BBBBBB']);
    expect(je([{ spalte: 'frage:hilfe', werte: ['Küche'] }], x, l)).toEqual(['AAAAAA']);
  });

  it('Zahlenfrage: auch mit Komma; ohne Antwort passt keine Grenze', () => {
    const x = mitFrage(frage('plaetze', 'number'), 703);
    const l = liste(x);
    l[0].einmal[703] = '2,5';
    l[1].einmal[703] = '4';
    expect(filterArt(x, 'frage:plaetze')).toBe('zahl');
    expect(je([{ spalte: 'frage:plaetze', ab: 2, bis: 3 }], x, l)).toEqual(['AAAAAA']);
    expect(je([{ spalte: 'frage:plaetze', ab: 3, bis: null }], x, l)).toEqual(['BBBBBB']);
    expect(je([{ spalte: 'frage:plaetze', ab: null, bis: 100 }], x, l)).toEqual([
      'AAAAAA',
      'BBBBBB',
    ]);
  });
});

describe('Rundmail und Druckliste: das Gefilterte', () => {
  it('nur passende Anmeldungen, darin nur die passenden Personen', () => {
    const x = e();
    const l = liste(x);
    const g = gefilterteListe(x, l, [{ spalte: ALLERGIE, text: 'ausgefuellt' }]);
    expect(g.map((a) => `${a.nr}: ${a.personen.map((p) => p.vor).join(', ')}`)).toEqual([
      'AAAAAA: Jonas',
      'BBBBBB: Jonas',
    ]);
  });

  it('nur Filter der Anmeldung: die Anmeldungen bleiben ganz; ohne Filter die Liste selbst', () => {
    const x = e();
    const l = liste(x);
    const g = gefilterteListe(x, l, [{ spalte: 'bezahlt', werte: ['offen'] }]);
    expect(g).toEqual([l[1], l[2]]);
    expect(gefilterteListe(x, l, [])).toBe(l);
  });
});

describe('Chips, Vollständigkeit, Bereinigen', () => {
  it('Text auf dem Chip', () => {
    expect(filterText({ spalte: FOTO, werte: ['Ja', 'Nein'] })).toBe('Ja oder Nein');
    expect(filterText({ spalte: 'betrag', ab: 10, bis: null })).toBe('ab 10 €');
    expect(filterText({ spalte: 'personen', ab: 3, bis: 5 })).toBe('3–5');
    expect(filterText({ spalte: 'alter', ab: null, bis: 12.5 })).toBe('bis 12,5');
    expect(filterText({ spalte: ALLERGIE, text: 'enthaelt', suche: 'Nuss' })).toBe(
      'enthält „Nuss“',
    );
    expect(filterText({ spalte: ALLERGIE, text: 'leer' })).toBe('leer');
  });

  it('vollständig erst mit Antwort, Grenze bzw. Wort', () => {
    expect(filterVollstaendig({ spalte: FOTO, werte: [] })).toBe(false);
    expect(filterVollstaendig({ spalte: 'betrag', ab: null, bis: null })).toBe(false);
    expect(filterVollstaendig({ spalte: ALLERGIE, text: 'enthaelt', suche: '  ' })).toBe(false);
    expect(filterVollstaendig({ spalte: ALLERGIE, text: 'ausgefuellt' })).toBe(true);
  });

  it('gelöschte Frage, entfernte Antwort, andere Art: der Filter fällt still weg', () => {
    const x = e();
    expect(
      filterBereinigt(x, [
        { spalte: 'frage:gibtsnicht', werte: ['Ja'] },
        { spalte: FOTO, werte: ['Ja', 'Vielleicht'] },
        { spalte: FOTO, ab: 1, bis: null },
        { spalte: 'frage:tel', werte: ['x'] },
        { spalte: 'betrag', ab: 5, bis: null },
        { spalte: ALLERGIE, text: 'enthaelt', suche: '' },
      ]),
    ).toEqual([
      { spalte: FOTO, werte: ['Ja'] },
      { spalte: 'betrag', ab: 5, bis: null },
    ]);
  });

  it('Setzen ersetzt den Filter derselben Spalte an seiner Stelle; null entfernt', () => {
    const a: SpaltenFilter = { spalte: FOTO, werte: ['Ja'] };
    const b: SpaltenFilter = { spalte: 'betrag', ab: 5, bis: null };
    const c: SpaltenFilter = { spalte: FOTO, werte: ['Nein'] };
    expect(filterSetzen([a, b], FOTO, c)).toEqual([c, b]);
    expect(filterSetzen([b], FOTO, a)).toEqual([b, a]);
    expect(filterSetzen([a, b], FOTO, null)).toEqual([b]);
  });
});
