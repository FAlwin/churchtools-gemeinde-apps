import { describe, expect, it } from 'vitest';
import { anmeldungenAus, antwortText, listenZahlen, mitgliederstandAus } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import { druckWahlFuer, fragen, teilnehmerSpalten, teilnehmerZelle } from './druckliste';
import {
  einstellungenEntpacken,
  einstellungenPacken,
  type Feld,
  type OeffentlicheEinstellungen,
} from './formular';
import { euroText } from './preis';
import {
  frageSumme,
  gezeigteSpalten,
  mitSpaltenWahl,
  mehrfachAntworten,
  passtZurSuche,
  obenZuerst,
  personSchluessel,
  personZeilen,
  personZellText,
  personenSortiert,
  personSumme,
  sortiert,
  spalteAnheften,
  spaltenGruppen,
  spaltenKatalog,
  spaltenWahl,
  spalteVerschieben,
  spalteZeigen,
  summe,
  vorgabeWahl,
  wahlGeaendert,
  zellText,
  type TabellenModus,
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

/** Was die Tabelle ohne Wahl zeigt (Vorgabe, U2-3). */
const vorgabeSpalten = (x: OeffentlicheEinstellungen, modus: TabellenModus, warteliste = false) =>
  gezeigteSpalten(x, modus, spaltenWahl(x, modus), { warteliste });

/** Dieselbe Veranstaltung, kostenlos – ohne Betrag und Bezahlt (`kannEtwasKosten`). */
const kostenlos = (x = e()): OeffentlicheEinstellungen => ({
  ...x,
  preis: {
    ...x.preis,
    grundpreis: { ...x.preis.grundpreis, art: 'fest', betragCent: 0, optionen: [] },
    alter: [],
    anpassungen: [],
    extras: [],
  },
});

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
    const titel = vorgabeSpalten(x, 'anmeldung').map((s) => s.titel);
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

  it('kostet nichts → ohne Betrag und Bezahlt; Warteliste → Warteplatz gleich hinter dem angehefteten Namen', () => {
    expect(listenZahlen(kostenlos(), []).kostet).toBe(false);
    const k = vorgabeSpalten(kostenlos(), 'anmeldung', true).map((s) => s.schluessel);
    expect(k).not.toContain('betrag');
    expect(k).not.toContain('bezahlt');
    expect(k.slice(0, 4)).toEqual(['name', 'warteplatz', 'nr', 'personen']);
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

describe('Je Person (U2-2)', () => {
  it('Spalten aus dem Katalog der Druckliste: Alter und Fragen der Person, „Angemeldet von“, Nr., Betrag der Anmeldung', () => {
    const x = e();
    const katalog = teilnehmerSpalten(x);
    const titel = (k: string) => katalog.find((s) => s.schluessel === k)!.titel;
    const personFragen = fragen(x).filter((f) => x.formular.person.includes(f));
    expect(personFragen.length).toBeGreaterThan(0);
    expect(vorgabeSpalten(x, 'person').map((s) => s.titel)).toEqual([
      'Vorname',
      'Nachname',
      'Status',
      titel('alter'),
      ...personFragen.map((f) => f.frage),
      titel('kontakt'),
      titel('nr'),
      'Betrag der Anmeldung',
      'Bezahlt',
    ]);
    // Fragen der Anmeldung sind in dieser Ansicht ohne Wahl ausgeblendet (U2-3: wählbar).
    const k = vorgabeSpalten(kostenlos(x), 'person', true).map((s) => s.schluessel);
    expect(k.slice(0, 4)).toEqual(['vor', 'nach', 'warteplatz', 'status']);
    expect(k).not.toContain('betrag');
    for (const f of fragen(x).filter((y) => x.formular.anmeldung.includes(y)))
      expect(k).not.toContain(`frage:${f.id}`);
  });

  it('eine Zeile je Person; Zellen wie auf der Druckliste (`teilnehmerZelle`)', () => {
    const x = e();
    const l = liste(x);
    const z = personZeilen(l);
    expect(z).toHaveLength(6);
    expect(z.map((y) => `${y.p.vor} ${y.x.nr}`).slice(0, 3)).toEqual([
      'Jonas AAAAAA',
      'Lena AAAAAA',
      'Jonas BBBBBB',
    ]);
    for (const s of teilnehmerSpalten(x))
      for (const y of z)
        expect(personZellText(x, s.schluessel, y)).toBe(teilnehmerZelle(x, s.schluessel, y.x, y.p));
    expect(personZellText(x, 'status', z[3])).toBe('Warteliste');
    expect(personZellText(x, 'warteplatz', z[3])).toBe('1');
    expect(personZellText(x, 'warteplatz', z[0])).toBe('');
  });

  it('Summen: Personen mit Platz, Fragen je Person, Betrag zählt jede Anmeldung einmal', () => {
    const x = e();
    const l = liste(x);
    const z = personZeilen(l);
    expect(personSumme(x, 'vor', z)).toEqual({
      text: '3 Personen',
      klein: '+ 3 auf der Warteliste',
    });
    // Allergie nur bei Jonas: zweimal mit Platz, einmal wartend (zählt nicht).
    expect(personSumme(x, 'frage:allergy', z)?.text).toBe('2 ausgefüllt');
    expect(personSumme(x, 'frage:foto', z)?.text).toBe('2× Ja');
    // Je Person stünde der Betrag der Anmeldung zweimal da – gezählt wird er einmal, wie in den Kacheln.
    expect(personSumme(x, 'betrag', z)).toEqual(summe(x, 'betrag', l));
    expect(personSumme(x, 'bezahlt', z)?.text).toBe('1× bezahlt');
    expect(personSumme(x, 'nach', z)).toBeNull();
    // Reiter Warteliste: nur Wartende → die zählen.
    expect(
      personSumme(
        x,
        'vor',
        z.filter((y) => y.p.status === 'wartet'),
      ),
    ).toEqual({
      text: '3 Personen',
    });
  });

  it('Alter in den Altersstufen der Preise – ohne Stufen keine Summe', () => {
    const x = e();
    const z = personZeilen(liste(x));
    expect(personSumme(x, 'alter', z)).toBeNull();
    x.preis = {
      ...x.preis,
      alter: [
        { von: 8, bis: 12, art: 'prozent', wert: 70 },
        { von: 0, bis: 3, art: 'frei', wert: 0 },
      ],
    };
    // Mit Platz: Jonas 9, Lena 7, Jonas 9 → 8–12 zweimal, Lena 7 in keiner Stufe (zwischen 3 und 8).
    expect(personSumme(x, 'alter', z)).toEqual({
      text: '8–12: 2 · übrige: 1',
      klein: 'Personen je Altersstufe der Preise',
    });
    x.preis = { ...x.preis, alter: [{ von: 0, bis: 8, art: 'frei', wert: 0 }] };
    expect(personSumme(x, 'alter', z)?.text).toBe('0–8: 1 · ab 9: 2');
  });

  it('Sortieren wie je Anmeldung: Alter als Zahl, Warteliste nach Warteplatz, Leere hinten', () => {
    const x = e();
    const z = personZeilen(liste(x));
    const name = (r: typeof z) => r.map((y) => `${y.p.vor} ${y.x.nr}`);
    expect(personenSortiert(x, z, null)).toBe(z);
    expect(
      name(personenSortiert(x, z, { schluessel: 'alter', absteigend: false })).slice(0, 2),
    ).toEqual(['Lena AAAAAA', 'Lena BBBBBB']);
    expect(name(personenSortiert(x, z, { schluessel: 'status', absteigend: true })).at(-1)).toBe(
      'Jonas BBBBBB',
    );
    // Warteliste ohne Wahl: Warteplatz 1 vorn, wer einen Platz hat, hinten.
    expect(name(personenSortiert(x, z, null, true)).slice(-3)).toEqual([
      'Jonas AAAAAA',
      'Lena AAAAAA',
      'Jonas BBBBBB',
    ]);
  });
});

describe('Spalten wählen (U2-3)', () => {
  const anmFragen = (x: OeffentlicheEinstellungen) =>
    fragen(x)
      .filter((f) => x.formular.anmeldung.includes(f))
      .map((f) => `frage:${f.id}`);
  const persFragen = (x: OeffentlicheEinstellungen) =>
    fragen(x)
      .filter((f) => x.formular.person.includes(f))
      .map((f) => `frage:${f.id}`);
  const schluessel = (x: OeffentlicheEinstellungen, modus: TabellenModus) =>
    vorgabeSpalten(x, modus).map((s) => s.schluessel);

  it('Vorgabe: alles in der Reihenfolge des Katalogs; je Person ohne Geburtsdatum und ohne die Fragen der Anmeldung', () => {
    const x = e();
    expect(vorgabeWahl(x, 'anmeldung')).toEqual({
      reihe: spaltenKatalog(x, 'anmeldung').map((s) => s.schluessel),
      aus: [],
      fest: ['name'],
    });
    const p = vorgabeWahl(x, 'person');
    expect(p.reihe).toEqual(spaltenKatalog(x, 'person').map((s) => s.schluessel));
    expect(p.aus).toEqual(['geburtstag', ...anmFragen(x)]);
    expect(p.fest).toEqual(['vor', 'nach']);
    // Angeheftet heißt: vorn und `fest`.
    expect(
      vorgabeSpalten(x, 'person')
        .filter((s) => s.fest)
        .map((s) => s.schluessel),
    ).toEqual(['vor', 'nach']);
  });

  it('der Katalog je Person nimmt die Druckliste (`teilnehmerSpalten`) ganz auf, dazu Name, Status und Geld', () => {
    const x = e();
    const k = spaltenKatalog(x, 'person');
    for (const d of teilnehmerSpalten(x))
      expect(k.find((s) => s.schluessel === d.schluessel)?.titel).toBe(d.titel);
    expect(k.map((s) => s.schluessel)).toEqual(
      expect.arrayContaining(['vor', 'nach', 'status', 'betrag', 'bezahlt', ...anmFragen(x)]),
    );
    // Kostenlos: kein Geld – in beiden Ansichten dieselbe Bedingung wie die Kacheln.
    for (const m of ['anmeldung', 'person'] as const)
      expect(spaltenKatalog(kostenlos(x), m).map((s) => s.schluessel)).not.toContain('betrag');
  });

  it('ausblenden, anheften (mehrere, in der Reihenfolge des Anheftens), verschieben → so zeigt es die Tabelle', () => {
    const x = e();
    let w = vorgabeWahl(x, 'anmeldung');
    w = spalteZeigen(w, 'am');
    w = spalteAnheften(w, 'nr');
    w = spalteVerschieben(w, 'nr', -1); // vor den Namen
    w = spalteVerschieben(w, 'betrag', -1);
    const k = gezeigteSpalten(x, 'anmeldung', w, { warteliste: true }).map((s) => s.schluessel);
    expect(k.slice(0, 3)).toEqual(['nr', 'name', 'warteplatz']);
    expect(k).not.toContain('am');
    const ohneFest = k.slice(3);
    expect(ohneFest.indexOf('betrag')).toBeLessThan(ohneFest.indexOf(anmFragen(x).at(-1)!));
    expect(spaltenGruppen(w).aus).toEqual(['am']);
  });

  it('eine angeheftete Spalte ausblenden lässt sie los; eine ausgeblendete anheften zeigt sie; die letzte bleibt', () => {
    const x = e();
    let w = spalteZeigen(vorgabeWahl(x, 'person'), 'vor');
    expect(w.fest).toEqual(['nach']);
    expect(w.aus).toContain('vor');
    w = spalteAnheften(w, 'geburtstag');
    expect(w.aus).not.toContain('geburtstag');
    expect(w.fest).toEqual(['nach', 'geburtstag']);
    // Alles bis auf eine Spalte weg – die letzte bleibt stehen.
    let nur = vorgabeWahl(x, 'anmeldung');
    for (const k of nur.reihe) nur = spalteZeigen(nur, k);
    expect(spaltenGruppen(nur).fest.length + spaltenGruppen(nur).sichtbar.length).toBe(1);
  });

  it('verschieben bleibt in der eigenen Gruppe; am Rand und ausgeblendet passiert nichts', () => {
    const x = e();
    const w = spalteZeigen(vorgabeWahl(x, 'anmeldung'), 'am');
    expect(spalteVerschieben(w, 'name', -1)).toBe(w);
    expect(spalteVerschieben(w, 'name', 1)).toBe(w); // einzige angeheftete
    expect(spalteVerschieben(w, 'am', -1)).toBe(w); // ausgeblendet
    const erste = spaltenGruppen(w).sichtbar[0];
    expect(spalteVerschieben(w, erste, -1)).toBe(w);
  });

  it('gemerkt wird nur die Abweichung; zurück zur Vorgabe fällt die Ansicht weg; die andere bleibt', () => {
    const x = e();
    expect(mitSpaltenWahl(x, 'anmeldung', vorgabeWahl(x, 'anmeldung')).tabelle).toBeUndefined();
    const w = spalteZeigen(vorgabeWahl(x, 'anmeldung'), 'am');
    const p = spalteAnheften(vorgabeWahl(x, 'person'), 'status');
    let y = mitSpaltenWahl(mitSpaltenWahl(x, 'anmeldung', w), 'person', p);
    expect(y.tabelle).toEqual({ anmeldung: w, person: p });
    expect(spaltenWahl(y, 'anmeldung')).toEqual(w);
    expect(wahlGeaendert(y, 'anmeldung', w)).toBe(false);
    expect(wahlGeaendert(x, 'anmeldung', w)).toBe(true);
    y = mitSpaltenWahl(y, 'anmeldung', vorgabeWahl(y, 'anmeldung'));
    expect(y.tabelle).toEqual({ person: p });
    y = mitSpaltenWahl(y, 'person', vorgabeWahl(y, 'person'));
    expect('tabelle' in y).toBe(false);
  });

  it('übersteht Packen und Entpacken (das Schema kennt das Feld) und bleibt klein', () => {
    // Der Termin der Testdaten ist für das Speicherformat unvollständig – für die Spalten egal.
    const x: OeffentlicheEinstellungen = { ...e(), termin: null };
    let w = vorgabeWahl(x, 'person');
    for (const k of [...w.reihe].reverse()) w = spalteAnheften(w, k);
    const v = {
      ...vorgabeWahl(x, 'anmeldung'),
      reihe: [...vorgabeWahl(x, 'anmeldung').reihe].reverse(),
    };
    const y = mitSpaltenWahl(mitSpaltenWahl(x, 'person', w), 'anmeldung', v);
    const zurueck = einstellungenEntpacken(einstellungenPacken(y))!;
    expect(zurueck.tabelle).toEqual(y.tabelle);
    expect(spaltenWahl(zurueck, 'person')).toEqual(w);
    // Beide Ansichten, alles umgestellt: gepackt wenige hundert Zeichen (Bauplan: Platz in der Beschreibung).
    expect(einstellungenPacken(y).length - einstellungenPacken(x).length).toBeLessThan(400);
  });

  it('bereinigt wie die Druckliste: eine gelöschte Frage fällt aus Wahl und Druckliste; neue Fragen nach der Vorgabe', () => {
    const x = e();
    const [weg] = persFragen(x);
    const nurAnm = anmFragen(x)[0];
    let w = spalteAnheften(vorgabeWahl(x, 'person'), weg);
    w = spalteZeigen(w, nurAnm);
    const y: OeffentlicheEinstellungen = {
      ...mitSpaltenWahl(x, 'person', w),
      druck: { spalten: ['alter', weg], sortierung: 'nachname' },
    };
    const ohne = (z: OeffentlicheEinstellungen): OeffentlicheEinstellungen => ({
      ...z,
      formular: {
        ...z.formular,
        person: z.formular.person.filter((f) => `frage:${f.id}` !== weg),
      },
    });
    const g = spaltenWahl(ohne(y), 'person');
    for (const liste of [g.reihe, g.aus, g.fest]) expect(liste).not.toContain(weg);
    expect(druckWahlFuer(ohne(y)).spalten).toEqual(['alter']);
    expect(g.aus).not.toContain(nurAnm);

    // Neue Fragen nach dem Speichern: hinten; je Person eine der Person sichtbar, eine der Anmeldung ausgeblendet.
    const neuP: Feld = { ...feld('text'), id: 'neuP', frage: 'Schuhgröße' };
    const neuA: Feld = { ...feld('text'), id: 'neuA', frage: 'Bemerkung' };
    const mehr = {
      ...y,
      formular: {
        anmeldung: [...y.formular.anmeldung, neuA],
        person: [...y.formular.person, neuP],
      },
    };
    const ctFelder = { ...mehr.ctFelder, neuP: 901, neuA: 902 };
    const n = spaltenWahl({ ...mehr, ctFelder }, 'person');
    expect(n.reihe.slice(-2).sort()).toEqual(['frage:neuA', 'frage:neuP']);
    expect(n.aus).toContain('frage:neuA');
    expect(n.aus).not.toContain('frage:neuP');
  });

  it('alles ausgeblendet (die gezeigten Fragen gelöscht) → Vorgabe statt leerer Tabelle', () => {
    const x = e();
    const [nurDie] = anmFragen(x);
    const w = {
      reihe: [nurDie],
      aus: vorgabeWahl(x, 'anmeldung').reihe.filter((k) => k !== nurDie),
      fest: [],
    };
    const y = mitSpaltenWahl(x, 'anmeldung', w);
    expect(schluessel(y, 'anmeldung')).toEqual([nurDie]);
    const ohne = {
      ...y,
      formular: {
        ...y.formular,
        anmeldung: y.formular.anmeldung.filter((f) => `frage:${f.id}` !== nurDie),
      },
    };
    expect(spaltenWahl(ohne, 'anmeldung')).toEqual(vorgabeWahl(ohne, 'anmeldung'));
  });

  it('je Person: Fragen der Anmeldung zählen einmal je Anmeldung; Geburtsdatum sortiert nach dem Datum', () => {
    const x = e();
    const l = liste(x);
    const z = personZeilen(l);
    for (const k of anmFragen(x)) {
      const je = summe(x, k, l);
      const p = personSumme(x, k, z);
      expect(p?.text).toBe(je?.text);
      if (je && !je.klein) expect(p?.klein).toBe('einmal je Anmeldung');
      for (const y of z) expect(personZellText(x, k, y)).toBe(zellText(x, k, y.x));
    }
    // Als Text („15.01.2019“ vor „20.05.2017“) stünde die Jüngere vorn – sortiert wird nach dem Datum.
    const geburt = [
      { ...z[0], p: { ...z[0].p, geburtstag: '2019-01-15' } },
      { ...z[1], p: { ...z[1].p, geburtstag: '2017-05-20' } },
    ];
    expect(
      personenSortiert(x, geburt, { schluessel: 'geburtstag', absteigend: false }).map(
        (y) => y.p.geburtstag,
      ),
    ).toEqual(['2017-05-20', '2019-01-15']);
  });
});

describe('Zeilen anheften (U2-4)', () => {
  it('angeheftete zuerst, untereinander und darunter in der Reihenfolge, in der sie sonst stünden', () => {
    expect(obenZuerst([1, 2, 3, 4, 5], (n) => n === 4 || n === 2)).toEqual([2, 4, 1, 3, 5]);
    expect(obenZuerst([3, 1, 2], () => false)).toEqual([3, 1, 2]);
  });

  it('nach dem Sortieren angeheftet: bleibt oben, die Sortierung gilt darunter weiter', () => {
    const x = e();
    const l = liste(x);
    const ab = sortiert(x, l, { schluessel: 'nr', absteigend: true });
    expect(ab.map((y) => y.nr)).toEqual(['CCCCCC', 'BBBBBB', 'AAAAAA']);
    expect(obenZuerst(ab, (y) => y.nr === 'AAAAAA').map((y) => y.nr)).toEqual([
      'AAAAAA',
      'CCCCCC',
      'BBBBBB',
    ]);
  });

  it('eine Zeile je Person hat einen eigenen Schlüssel – auch bei gleichem Namen in zwei Anmeldungen', () => {
    const z = personZeilen(liste());
    const k = z.map(personSchluessel);
    expect(new Set(k).size).toBe(z.length);
    // „Jonas Beispiel“ steht in AAAAAA und BBBBBB – die Schlüssel unterscheiden sich.
    expect(z.filter((y) => y.p.vor === 'Jonas').map(personSchluessel)).toHaveLength(3);
  });
});
