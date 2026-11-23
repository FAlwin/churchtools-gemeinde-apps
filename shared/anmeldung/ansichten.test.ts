import { describe, expect, it } from 'vitest';
import { e as einst } from './liste.testdaten';
import {
  einstellungenEntpacken,
  einstellungenPacken,
  type OeffentlicheEinstellungen,
} from './formular';
import {
  ANSICHTEN_MAX,
  ansichtenAus,
  ansichtGeaendert,
  ansichtNameFehler,
  ansichtPlatzFehler,
  ansichtSpalten,
  ansichtStand,
  mitAnsichtName,
  mitAnsichtSpalten,
  mitAnsichtStand,
  mitAnsichtVerschoben,
  mitAnsichtZurueck,
  mitNeuerAnsicht,
  neueAnsichtId,
  ohneAnsicht,
  type AnsichtStand,
} from './ansichten';
import { mitSpaltenWahl, spalteZeigen, spaltenWahl } from './tabelle';

/**
 * Eigene Ansichten (U3) – gegen die Einstellungen, wie die Erweiterung sie schreibt und liest (`einstellungenPacken`
 * / `einstellungenEntpacken`), und gegen die Spaltenwahl des Teams (`spaltenWahl`, `mitSpaltenWahl`).
 */
const KUECHE: AnsichtStand = {
  filter: [{ spalte: 'frage:foto', werte: ['Ja'] }],
  sortierung: null,
  jePerson: true,
};
const mit = (e: OeffentlicheEinstellungen, id: string, name: string, stand = KUECHE) =>
  mitNeuerAnsicht(e, { id, name, stand });
// Die Testdaten haben einen Termin ohne Ort – für Speichern/Lesen ohne Termin.
const rund = (e: OeffentlicheEinstellungen) =>
  einstellungenEntpacken(einstellungenPacken({ ...e, termin: null }))!;

describe('Anlegen', () => {
  it('neue Ansicht hinten; nur, was nicht Vorgabe ist; übersteht Speichern und Lesen', () => {
    const e = mit(mit(einst(), 'a1', 'Küchenteam'), 'b2', 'Alle Fotos', {
      filter: [],
      sortierung: { schluessel: 'betrag', absteigend: true },
      jePerson: false,
    });
    expect(e.ansichten).toEqual([
      { id: 'a1', name: 'Küchenteam', filter: KUECHE.filter, jePerson: true },
      {
        id: 'b2',
        name: 'Alle Fotos',
        filter: [],
        sortierung: { schluessel: 'betrag', absteigend: true },
      },
    ]);
    expect(rund(e).ansichten).toEqual(e.ansichten);
    expect(einst().ansichten).toBeUndefined();
  });

  it('Spalten nur, wenn sie von denen des Teams abweichen – für den Modus der Ansicht', () => {
    const x = einst();
    const team = spaltenWahl(x, 'person');
    expect(
      mitNeuerAnsicht(x, { id: 'a', name: 'A', stand: KUECHE, spalten: team }).ansichten![0]
        .tabelle,
    ).toBeUndefined();
    const anders = spalteZeigen(team, 'geburtstag');
    const e = mitNeuerAnsicht(x, { id: 'a', name: 'A', stand: KUECHE, spalten: anders });
    expect(e.ansichten![0].tabelle).toEqual({ person: anders });
    expect(ansichtSpalten(e, e.ansichten![0], 'person')).toEqual(anders);
    // Der andere Modus folgt der Wahl des Teams.
    expect(ansichtSpalten(e, e.ansichten![0], 'anmeldung')).toEqual(spaltenWahl(x, 'anmeldung'));
  });

  it('Name: leer, zu lang, schon vergeben (auch feste Reiter, ohne Groß/klein) – höchstens 12', () => {
    const e = mit(einst(), 'a1', 'Küchenteam');
    expect(ansichtNameFehler(e, '  ')).toBe('Bitte einen Namen eingeben.');
    expect(ansichtNameFehler(e, 'x'.repeat(31))).toBe('Höchstens 30 Zeichen.');
    expect(ansichtNameFehler(e, 'küchenteam')).toBe('„küchenteam“ gibt es schon.');
    expect(ansichtNameFehler(e, 'warteliste')).toBe('„warteliste“ gibt es schon.');
    expect(ansichtNameFehler(e, 'Küchenteam', 'a1')).toBeNull();
    expect(() => mit(e, 'b', 'Küchenteam')).toThrow('gibt es schon');
    let voll = einst();
    for (let i = 0; i < ANSICHTEN_MAX; i++) voll = mit(voll, `v${i}`, `Ansicht ${i}`);
    expect(ansichtPlatzFehler(voll)).toMatch(/Höchstens 12/);
    expect(ansichtPlatzFehler(e)).toBeNull();
    expect(() => mit(voll, 'zu', 'Eine zu viel')).toThrow(/Höchstens 12/);
    // Auch beim Speichern: mehr als 12 nimmt die Prüfung nicht an.
    expect(rund(voll).ansichten).toHaveLength(12);
    expect(() =>
      einstellungenPacken({
        ...voll,
        termin: null,
        ansichten: [...voll.ansichten!, { id: 'x13', name: 'Dreizehn', filter: [] }],
      }),
    ).toThrow();
  });

  it('neue Kennung: frei, nur Buchstaben und Ziffern', () => {
    const e = mit(einst(), 'abc123', 'A');
    const zahlen = [0.0, 0.5];
    // Erster Wurf trifft eine vergebene Kennung – dann ein neuer.
    const vergeben = Number.parseInt('abc123', 36) / 36 ** 6;
    const z = [vergeben, ...zahlen];
    const id = neueAnsichtId(e, () => z.shift()!);
    expect(id).not.toBe('abc123');
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});

describe('Ändern', () => {
  const e = () => mit(mit(mit(einst(), 'a', 'A'), 'b', 'B'), 'c', 'C');

  it('geändert = Filter, Sortierung oder „je Person“ weichen ab; „Änderungen speichern“ übernimmt sie', () => {
    const x = e();
    const a = x.ansichten![0];
    expect(ansichtGeaendert(a, ansichtStand(a))).toBe(false);
    const neu: AnsichtStand = { ...ansichtStand(a), filter: [] };
    expect(ansichtGeaendert(a, neu)).toBe(true);
    expect(ansichtGeaendert(a, { ...ansichtStand(a), jePerson: false })).toBe(true);
    expect(
      ansichtGeaendert(a, {
        ...ansichtStand(a),
        sortierung: { schluessel: 'alter', absteigend: false },
      }),
    ).toBe(true);
    const gespeichert = mitAnsichtStand(x, 'a', neu);
    expect(gespeichert.ansichten![0]).toEqual({ id: 'a', name: 'A', filter: [], jePerson: true });
    expect(ansichtGeaendert(gespeichert.ansichten![0], neu)).toBe(false);
  });

  it('umbenennen; nach links/rechts, am Rand bleibt sie stehen', () => {
    const x = mitAnsichtName(e(), 'b', ' Bühne ');
    expect(x.ansichten!.map((a) => a.name)).toEqual(['A', 'Bühne', 'C']);
    expect(() => mitAnsichtName(x, 'b', 'a')).toThrow('gibt es schon');
    const namen = (y: OeffentlicheEinstellungen) => y.ansichten!.map((a) => a.id).join('');
    expect(namen(mitAnsichtVerschoben(x, 'b', -1))).toBe('bac');
    expect(namen(mitAnsichtVerschoben(x, 'b', 1))).toBe('acb');
    expect(mitAnsichtVerschoben(x, 'a', -1)).toBe(x);
    expect(mitAnsichtVerschoben(x, 'c', 1)).toBe(x);
  });

  it('Spalten der Ansicht: wie die des Teams → nichts gemerkt; abweichend → gemerkt', () => {
    const x = e();
    const team = spaltenWahl(x, 'person');
    const anders = spalteZeigen(team, 'geburtstag');
    const y = mitAnsichtSpalten(x, 'a', 'person', anders);
    expect(y.ansichten![0].tabelle).toEqual({ person: anders });
    expect(mitAnsichtSpalten(y, 'a', 'person', team).ansichten![0].tabelle).toBeUndefined();
    // Ändert das Team später seine Spalten, folgt eine Ansicht ohne eigene Spalten.
    const teamNeu = spalteZeigen(spaltenWahl(x, 'anmeldung'), 'am');
    const z = mitSpaltenWahl(x, 'anmeldung', teamNeu);
    expect(ansichtSpalten(z, z.ansichten![0], 'anmeldung')).toEqual(spaltenWahl(z, 'anmeldung'));
  });

  it('löschen und Rückgängig: wieder an ihrer Stelle; die letzte weg → kein Feld mehr', () => {
    const x = e();
    const { e: ohne, weg } = ohneAnsicht(x, 'b');
    expect(ohne.ansichten!.map((a) => a.id)).toEqual(['a', 'c']);
    expect(weg).toEqual({ ansicht: x.ansichten![1], stelle: 1 });
    expect(mitAnsichtZurueck(ohne, weg!).ansichten).toEqual(x.ansichten);
    expect(ohneAnsicht(x, 'gibtsnicht').weg).toBeNull();
    const nurEine = mit(einst(), 'a', 'A');
    expect('ansichten' in ohneAnsicht(nurEine, 'a').e).toBe(false);
  });
});

describe('Lesen: bereinigt wie die Spaltenwahl', () => {
  it('Filter auf gelöschte Fragen und Sortierung nach fehlender Spalte fallen still weg, die Ansicht bleibt', () => {
    const x = mitNeuerAnsicht(einst(), {
      id: 'a',
      name: 'A',
      stand: {
        filter: [
          { spalte: 'frage:foto', werte: ['Ja'] },
          { spalte: 'frage:gibtsnicht', text: 'leer' },
        ],
        sortierung: { schluessel: 'frage:gibtsnicht', absteigend: false },
        jePerson: true,
      },
    });
    expect(ansichtenAus(x)).toEqual([
      { id: 'a', name: 'A', filter: [{ spalte: 'frage:foto', werte: ['Ja'] }], jePerson: true },
    ]);
    expect(ansichtenAus(einst())).toEqual([]);
  });
});
