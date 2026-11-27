import { describe, expect, it } from 'vitest';
import { anmeldungenAus, mitgliederstandAus, type ListenAnmeldung } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import {
  einstellungenAlsText,
  einstellungenLesen,
  type OeffentlicheEinstellungen,
} from './formular';
import { AMPEL_TEXT } from './nachweisAmpel';
import { nachweisLageBauen } from './nachweisAmpelLage';
import type { NachweisAblage } from './nachweisStandAblage';
import {
  gezeigteSpalten,
  mitSpaltenWahl,
  personSchluessel,
  personZeilen,
  personZellText,
  personenSortiert,
  sortiert,
  spaltenKatalog,
  spaltenWahl,
  vorgabeWahl,
  zellText,
} from './tabelle';
import {
  filterAntworten,
  filterArt,
  filterBereinigt,
  filterName,
  gefilterteListe,
  passtAnmeldung,
  passtPerson,
  personenSpalte,
} from './tabellenFilter';

/**
 * Die Nachweis-Spalte in der Tabelle (N3d): Katalog, Zellen, Sortierung, Filter, Ansichten. Die Lage kommt aus dem Erzeuger
 * (`nachweisLageBauen`), nicht aus Literalen. AAAAAA Jonas 10 + Lena 11, BBBBBB Jonas 20 + Lena 21 (wartet), CCCCCC 30 + 31.
 */
const HEUTE = '2026-11-20';
const ART = 61;
const SPALTE = 'nachweis:61';
const personen = new Map([
  ...PERSONEN,
  ...[20, 30].map((id) => [id, PERSONEN.get(10)!] as const),
  ...[21, 31].map((id) => [id, PERSONEN.get(11)!] as const),
]);
const basis = (): OeffentlicheEinstellungen => ({
  ...e(),
  termin: { beginn: '2026-11-20T10:00', ende: '2026-11-22T12:00', ort: '', terminId: null },
  nachweise: [{ artGruppeId: ART, fuer: 'alle' }],
});
const liste = (x: OeffentlicheEinstellungen): ListenAnmeldung[] =>
  anmeldungenAus(
    x,
    mitgliederstandAus(
      [
        ...mitglieder('AAAAAA', [true, true], 10),
        ...mitglieder('BBBBBB', [true, false], 20),
        ...mitglieder('CCCCCC', [true, true], 30),
      ],
      [],
      FELDER,
      new Set([35]),
      personen,
    ),
    STICHTAG,
  );
const ablage: NachweisAblage = {
  art: 'gelesen',
  staende: new Map([
    [
      ART,
      new Map([
        [10, '2030-01-01'],
        [11, 'rot'],
        [30, '2026-11-21'],
        [31, '2026-11-21'],
      ]),
    ],
  ]),
  namen: new Map([[ART, 'Führungszeugnis']]),
};
/** Einstellungen mit der Lage – so, wie der Reiter sie der Tabelle gibt. */
const mitLage = (a: NachweisAblage | 'laedt' | 'nichtLesbar' = ablage) => {
  const x = basis();
  return { ...x, nachweisLage: nachweisLageBauen(x, liste(x), a, HEUTE) };
};
const WERTE = (x: OeffentlicheEinstellungen) =>
  personZeilen(liste(x)).map((z) => [z.p.personId, personZellText(x, SPALTE, z)] as const);

describe('Katalog', () => {
  it('je eingeschalteter Art eine Spalte – je Anmeldung und je Person, hinten; ohne Art keine', () => {
    for (const modus of ['anmeldung', 'person'] as const) {
      const k = spaltenKatalog(mitLage(), modus).map((s) => s.schluessel);
      expect(k.at(-1)).toBe(SPALTE);
      expect(spaltenKatalog(e(), modus).some((s) => s.schluessel.startsWith('nachweis:'))).toBe(
        false,
      );
    }
  });
  it('Titel: der Name aus der Ablage, solange er fehlt „Nachweis-Art Nr. …“ (wie die Karte)', () => {
    const titel = (x: OeffentlicheEinstellungen) =>
      spaltenKatalog(x, 'person').find((s) => s.schluessel === SPALTE)?.titel;
    expect(titel(mitLage())).toBe('Führungszeugnis');
    expect(titel(basis())).toBe(`Nachweis-Art Nr. ${ART}`);
    expect(titel(mitLage('laedt'))).toBe(`Nachweis-Art Nr. ${ART}`);
  });
  it('sichtbar von Anfang an; eine gemerkte Wahl aus der Zeit davor zeigt sie ebenfalls (neue Spalten stehen hinten)', () => {
    const x = mitLage();
    expect(vorgabeWahl(x, 'person').aus).not.toContain(SPALTE);
    const alt = { ...x, tabelle: { person: { reihe: ['vor', 'nach'], aus: [], fest: ['vor'] } } };
    expect(spaltenWahl(alt, 'person').reihe).toContain(SPALTE);
    expect(spaltenWahl(alt, 'person').aus).not.toContain(SPALTE);
    expect(
      gezeigteSpalten(alt, 'person', spaltenWahl(alt, 'person'), { warteliste: false }).map(
        (s) => s.schluessel,
      ),
    ).toContain(SPALTE);
  });
  it('ausgeblendet und gemerkt: die Wahl überlebt (Schlüssel passt ins Schema), die Lage nie', () => {
    const x = mitLage();
    const w = { ...vorgabeWahl(x, 'person'), aus: [SPALTE] };
    const gespeichert = mitSpaltenWahl(x, 'person', w);
    const zurueck = einstellungenLesen(einstellungenAlsText(gespeichert))!;
    expect(zurueck.tabelle?.person?.aus).toEqual([SPALTE]);
    expect('nachweisLage' in zurueck).toBe(false);
    expect(einstellungenAlsText(gespeichert)).not.toContain('nachweisLage');
  });
});

describe('Zellen und Sortierung', () => {
  it('je Person: der Text der Ampel; je Anmeldung: der schlechteste Wert ihrer Personen', () => {
    const x = mitLage();
    expect(Object.fromEntries(WERTE(x))).toEqual({
      10: 'gültig bis 01/2030',
      11: 'fehlt',
      20: 'noch nicht angefordert',
      21: 'nicht nötig',
      30: 'läuft vor Ende ab',
      31: 'läuft vor Ende ab',
    });
    const l = liste(x);
    expect(l.map((a) => zellText(x, SPALTE, a))).toEqual([
      'fehlt',
      'noch nicht angefordert',
      'läuft vor Ende ab',
    ]);
  });
  it('solange der Stand lädt: leere Zelle (die Oberfläche zeigt „…“), nie ein Wert', () => {
    const x = mitLage('laedt');
    expect(WERTE(x).every(([, t]) => t === '')).toBe(true);
    expect(liste(x).every((a) => zellText(x, SPALTE, a) === '')).toBe(true);
  });
  it('sortieren je Person nach dem Rang: erst fehlt, dann noch nicht angefordert, läuft ab, gültig, nicht nötig', () => {
    const x = mitLage();
    const auf = personenSortiert(x, personZeilen(liste(x)), {
      schluessel: SPALTE,
      absteigend: false,
    });
    expect(auf.map((z) => z.p.personId)).toEqual([11, 20, 30, 31, 10, 21]);
    const ab = personenSortiert(x, personZeilen(liste(x)), {
      schluessel: SPALTE,
      absteigend: true,
    });
    expect(ab.map((z) => z.p.personId)).toEqual([21, 10, 30, 31, 20, 11]);
  });
  it('sortieren je Anmeldung nach dem schlechtesten Wert', () => {
    const x = mitLage();
    const auf = sortiert(x, liste(x), { schluessel: SPALTE, absteigend: false });
    expect(auf.map((a) => a.nr)).toEqual(['AAAAAA', 'BBBBBB', 'CCCCCC']);
    const ab = sortiert(x, liste(x), { schluessel: SPALTE, absteigend: true });
    expect(ab.map((a) => a.nr)).toEqual(['CCCCCC', 'BBBBBB', 'AAAAAA']);
  });
});

describe('Filter (R2) und Ansichten (U3)', () => {
  const x = mitLage();
  it('Art „Antworten“, je Person, mit dem Namen der Art; nicht eingeschaltete Art: gar nicht', () => {
    expect(filterArt(x, SPALTE)).toBe('antworten');
    expect(personenSpalte(x, SPALTE)).toBe(true);
    expect(filterName(x, SPALTE)).toBe('Führungszeugnis');
    expect(filterArt(x, 'nachweis:99')).toBeNull();
    expect(filterArt({ ...x, nachweise: undefined }, SPALTE)).toBeNull();
  });
  it('die Antworten stehen fest da – mit und ohne Lage dieselben, damit gespeicherte Filter nicht wegfallen', () => {
    const fest = [
      'fehlt',
      'abgelaufen',
      'noch nicht angefordert',
      'läuft vor Ende ab',
      'gültig',
      'nicht nötig',
    ];
    expect(filterAntworten(x, SPALTE)).toEqual(fest);
    expect(filterAntworten(basis(), SPALTE)).toEqual(fest);
    expect(filterAntworten(mitLage('laedt'), SPALTE)).toEqual(fest);
  });
  it('„Stand nicht lesbar“ und „Bedingung prüfen“ kommen nur dazu, wenn es sie gibt', () => {
    expect(filterAntworten(mitLage('nichtLesbar'), SPALTE)).toContain(AMPEL_TEXT.nichtLesbar);
    expect(filterAntworten(x, SPALTE)).not.toContain(AMPEL_TEXT.nichtLesbar);
    const k = basis();
    k.nachweise = [{ artGruppeId: ART, fuer: 'nurWenn', feld: 'frage:weg', antworten: ['Ja'] }];
    const kl = { ...k, nachweisLage: nachweisLageBauen(k, liste(k), ablage, HEUTE) };
    expect(filterAntworten(kl, SPALTE)).toContain(AMPEL_TEXT.bedingung);
  });
  it('passt eine Person, wenn ihr Wert unter den gewählten ist; je Anmeldung, wenn eine Person passt (E4)', () => {
    const f = [{ spalte: SPALTE, werte: ['fehlt'] }];
    const ids = personZeilen(liste(x))
      .filter((z) => passtPerson(x, f, z))
      .map((z) => z.p.personId);
    expect(ids).toEqual([11]);
    expect(
      liste(x)
        .filter((a) => passtAnmeldung(x, f, a))
        .map((a) => a.nr),
    ).toEqual(['AAAAAA']);
    const mehrere = [{ spalte: SPALTE, werte: ['fehlt', 'läuft vor Ende ab'] }];
    expect(
      liste(x)
        .filter((a) => passtAnmeldung(x, mehrere, a))
        .map((a) => a.nr),
    ).toEqual(['AAAAAA', 'CCCCCC']);
  });
  it('Rundmail und Druckliste (`gefilterteListe`): nur die passenden Personen', () => {
    const r = gefilterteListe(x, liste(x), [
      { spalte: SPALTE, werte: ['noch nicht angefordert', 'läuft vor Ende ab'] },
    ]);
    expect(r.map((a) => [a.nr, a.personen.map((p) => p.personId)])).toEqual([
      ['BBBBBB', [20]],
      ['CCCCCC', [30, 31]],
    ]);
  });
  it('solange der Stand lädt, passt niemand – statt „alle“ (ein Filter ohne Daten zeigt nichts Falsches)', () => {
    const l = mitLage('laedt');
    const f = [{ spalte: SPALTE, werte: ['fehlt'] }];
    expect(personZeilen(liste(l)).filter((z) => passtPerson(l, f, z))).toEqual([]);
  });
  it('`filterBereinigt` (gespeicherte Ansicht): der Filter bleibt, auch ohne Lage; eine entfernte Art lässt ihn fallen', () => {
    const f = [{ spalte: SPALTE, werte: ['fehlt', 'gültig'] }];
    expect(filterBereinigt(basis(), f)).toEqual(f);
    expect(filterBereinigt(x, f)).toEqual(f);
    expect(filterBereinigt({ ...basis(), nachweise: undefined }, f)).toEqual([]);
    expect(filterBereinigt(x, [{ spalte: SPALTE, werte: ['gibt es nicht'] }])).toEqual([]);
  });
  it('die Schlüssel der Zeilen bleiben die der Personen (Anheften) – die Spalte ändert sie nicht', () => {
    const z = personZeilen(liste(x))[0];
    expect(personSchluessel(z)).toBe(`${z.x.schluessel}-${z.p.personId}`);
  });
});
