import { describe, expect, it } from 'vitest';
import { anmeldungenAus, mitgliederstandAus } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import {
  DRUCK_STANDARD,
  abholTabelle,
  druckDateiname,
  druckTabelle,
  kuecheTabelle,
  listenAngebot,
  zahlungenTabelle,
  zimmerTabelle,
  druckWahlFuer,
  teilnehmerSpalten,
  teilnehmerTabelle,
} from './druckliste';

/**
 * Druckliste (A8-1): Spalten aus dem Formular, Zeilen aus den Anmeldungen, wie das Formular sie schreibt
 * (`liste.testdaten.ts`: Kinder-Event, Maria meldet Jonas und Lena an).
 */
const liste = (x = e()) => {
  const roh = [
    ...mitglieder('AAAAAA', [true, true], 10, { bezahlt: true }),
    ...mitglieder('BBBBBB', [true, false], 20),
  ];
  const personen = new Map([
    ...PERSONEN,
    [20, { name: 'Jonas Beispiel', email: null, geburtstag: '2017-05-01' }],
    [21, { name: 'Lena Beispiel', email: null, geburtstag: '2019-02-02' }],
  ]);
  return anmeldungenAus(x, mitgliederstandAus(roh, [], FELDER, new Set([35]), personen), STICHTAG);
};

describe('Spalten', () => {
  it('Alter und Geburtsdatum nur mit Geburtsdatum im Formular; danach die Fragen', () => {
    const titel = teilnehmerSpalten(e()).map((s) => s.titel);
    expect(titel.slice(0, 4)).toEqual(['Alter', 'Geburtsdatum', 'Angemeldet von', 'Anmelde-Nr.']);
    // Erst die Fragen je Person, dann die der Anmeldung – in der Reihenfolge des Formulars.
    expect(titel.slice(4, 7)).toEqual([
      'Allergien oder Unverträglichkeiten',
      'Dürfen Fotos veröffentlicht werden?',
      'Telefon',
    ]);
    const ohne = e();
    ohne.formular.person = ohne.formular.person.map((f) =>
      f.id === 'birth' ? { ...f, zustand: 'aus' as const } : f,
    );
    expect(teilnehmerSpalten(ohne).map((s) => s.schluessel)).not.toContain('alter');
  });

  it('gemerkte Wahl ohne gelöschte Fragen; ohne Wahl der Standard', () => {
    expect(druckWahlFuer(e())).toEqual(DRUCK_STANDARD);
    const x = e();
    x.druck = { spalten: ['frage:tel', 'frage:gibtsnicht'], sortierung: 'alter' };
    expect(druckWahlFuer(x)).toEqual({ spalten: ['frage:tel'], sortierung: 'alter' });
  });
});

describe('Teilnehmerliste', () => {
  it('nur mit Platz, nach Nachname; Antworten der Anmeldung bei jeder Person', () => {
    const t = teilnehmerTabelle(
      e(),
      liste(),
      // Gewählt in anderer Reihenfolge – gedruckt wie im Formular.
      { spalten: ['frage:tel', 'alter', 'kontakt', 'frage:allergy'], sortierung: 'nachname' },
      false,
    );
    expect(t.kopf[0]).toBe('Name');
    expect(t.kopf.slice(1)).toEqual([
      'Alter',
      'Angemeldet von',
      'Allergien oder Unverträglichkeiten',
      'Telefon',
    ]);
    expect(t.zeilen).toEqual([
      { zellen: ['Beispiel, Jonas', '9', 'Maria Beispiel', 'Nüsse', '0151 111'] },
      { zellen: ['Beispiel, Jonas', '9', 'Maria Beispiel', 'Nüsse', '0151 111'] },
      { zellen: ['Beispiel, Lena', '7', 'Maria Beispiel', '', '0151 111'] },
    ]);
    expect(t.summe).toBe('3 mit Platz · 1 auf der Warteliste (nicht gedruckt)');
  });

  it('mit Warteliste: eigener Abschnitt mit Platz; Sortierung nach Alter und Anmeldung', () => {
    const t = teilnehmerTabelle(e(), liste(), { spalten: ['nr'], sortierung: 'alter' }, true);
    expect(t.zeilen).toEqual([
      { zellen: ['Beispiel, Lena', 'AAAAAA'] },
      { zellen: ['Beispiel, Jonas', 'AAAAAA'] },
      { zellen: ['Beispiel, Jonas', 'BBBBBB'] },
      { abschnitt: 'Warteliste' },
      { zellen: ['1. Beispiel, Lena', 'BBBBBB'] },
    ]);
    expect(t.summe).toBe('3 mit Platz · 1 auf der Warteliste');
    const n = teilnehmerTabelle(e(), liste(), { spalten: ['nr'], sortierung: 'anmeldung' }, false);
    expect(n.zeilen.map((z) => ('zellen' in z ? z.zellen[1] : ''))).toEqual([
      'AAAAAA',
      'AAAAAA',
      'BBBBBB',
    ]);
  });

  it('Dateiname ohne Zeichen, die Dateisysteme nicht mögen', () => {
    expect(druckDateiname('Freizeit 2027/28: Teil "1"', 'Teilnehmer')).toBe(
      'Freizeit 2027 28 Teil 1 – Teilnehmer',
    );
  });
});

describe('Weitere Listen (A8-2)', () => {
  it('Angebot nach dem Formular: Kinder-Event mit Allergien und Eltern, ohne Auswahl im Preis', () => {
    expect(listenAngebot(e()).map((l) => [l.art, l.titel, l.passt])).toEqual([
      ['teilnehmer', 'Teilnehmer', true],
      ['kueche', 'Küche & Allergien', true],
      ['zimmer', 'Zimmer', false],
      ['abhol', 'Abholliste', true],
      ['zahlungen', 'Zahlungen', true],
    ]);
    const x = e();
    x.preis.grundpreis = {
      ...x.preis.grundpreis,
      art: 'auswahl',
      auswahlName: 'Zimmertyp',
      optionen: [],
    };
    x.formular.person = x.formular.person.filter((f) => f.id !== 'allergy');
    const a = listenAngebot(x);
    expect(a.find((l) => l.art === 'zimmer')).toMatchObject({ titel: 'Zimmertyp', passt: true });
    expect(a.find((l) => l.art === 'kueche')).toMatchObject({
      passt: false,
      hinweis: expect.stringContaining('keine Frage zu Allergien'),
    });
  });

  it('Küche: Zahlen oben, nur wer einen Hinweis hat; ohne Frage alle mit leerer Spalte', () => {
    const t = kuecheTabelle(e(), liste(), false);
    expect(t.oben).toBe('3 Personen · 3 Kinder unter 12 · 0 unter 3 · 2 mit Hinweis');
    expect(t.kopf).toEqual(['Name', 'Alter', 'Hinweis']);
    expect(t.zeilen).toEqual([
      { zellen: ['Beispiel, Jonas', '9', 'Nüsse'] },
      { zellen: ['Beispiel, Jonas', '9', 'Nüsse'] },
    ]);
    expect(kuecheTabelle(e(), liste(), true).oben).toMatch(/^4 Personen/);
    // Niemand hat etwas angegeben → ein Satz statt einer leeren Tabelle.
    const leer = liste();
    for (const x of leer) for (const p of x.personen) p.werte = {};
    expect(kuecheTabelle(e(), leer, false).zeilen).toEqual([
      { abschnitt: 'Niemand hat bei „Allergien oder Unverträglichkeiten“ etwas angegeben.' },
    ]);
    const ohne = e();
    ohne.formular.person = ohne.formular.person.filter((f) => f.id !== 'allergy');
    const o = kuecheTabelle(ohne, liste(), false);
    expect(o.zeilen).toHaveLength(3);
    expect(o.oben).toBe('3 Personen · 3 Kinder unter 12 · 0 unter 3');
  });

  it('Zimmer: je Option die Anmeldungen, Wartende markiert; ohne Auswahl alle', () => {
    const x = e();
    x.preis.grundpreis = {
      ...x.preis.grundpreis,
      art: 'auswahl',
      auswahlName: 'Zimmertyp',
      optionen: [
        { name: 'Zweibett', preisCent: 0, kontingent: 0, belegt: 0, personenJe: 0 },
        { name: 'Vierbett', preisCent: 0, kontingent: 0, belegt: 0, personenJe: 0 },
      ],
    };
    const l = liste(x);
    l[0].einmal[x.ctFelder.auswahl] = 'Vierbett';
    l[1].einmal[x.ctFelder.auswahl] = 'Gibt es nicht mehr';
    expect(zimmerTabelle(x, l, true).zeilen).toEqual([
      { abschnitt: 'Vierbett' },
      { zellen: ['Maria Beispiel', 'Jonas, Lena', ''] },
      { abschnitt: 'Ohne Auswahl' },
      { zellen: ['Maria Beispiel', 'Jonas, Lena (Warteliste)', ''] },
    ]);
    const ohne = zimmerTabelle(e(), liste(), false);
    expect(ohne.zeilen).toEqual([
      { zellen: ['Maria Beispiel', 'Jonas, Lena', ''] },
      { zellen: ['Maria Beispiel', 'Jonas', ''] },
    ]);
    expect(ohne.summe).toBe('2 Anmeldungen · 3 Personen');
  });

  it('Abholliste: Erziehungsberechtigte ohne Einverständnis-Zeile; ohne Baustein der Kontakt mit Telefon', () => {
    const t = abholTabelle(e(), liste(), false);
    expect(t.kopf).toEqual(['Kind', 'Abholen dürfen', 'Abgeholt von / Uhrzeit']);
    expect(t.zeilen[0]).toEqual({
      zellen: ['Beispiel, Jonas', 'Maria Beispiel, 0151 111\nTom Beispiel', ''],
    });
    const ohne = e();
    ohne.formular.anmeldung = ohne.formular.anmeldung.filter((f) => f.id !== 'eltern');
    expect(abholTabelle(ohne, liste(), false).zeilen[0]).toEqual({
      zellen: ['Beispiel, Jonas', 'Maria Beispiel, 0151 111', ''],
    });
  });

  it('ganz leer: ein Satz statt einer leeren Tabelle', () => {
    const alleWarten = liste().map((x) => ({
      ...x,
      personen: x.personen.map((p) => ({ ...p, status: 'wartet' as const })),
    }));
    for (const art of ['teilnehmer', 'zimmer', 'abhol'] as const)
      expect(druckTabelle(art, e(), alleWarten, DRUCK_STANDARD, false).zeilen).toEqual([
        { abschnitt: 'Niemand mit Platz – „Auch Warteliste“ nimmt die Wartenden dazu.' },
      ]);
    expect(druckTabelle('teilnehmer', e(), alleWarten, DRUCK_STANDARD, true).zeilen[0]).toEqual({
      abschnitt: 'Warteliste',
    });
  });

  it('Zahlungen (A8-3): je Zahlung eine Zeile, bezahlt mit Tag und Zahlart, Summen wie im Reiter', () => {
    const t = zahlungenTabelle(e(), liste(), false);
    expect(t.kopf).toEqual(['Anmeldung', 'Wofür', 'Betrag', 'Bezahlt']);
    expect(t.zeilen).toEqual([
      { zellen: ['Maria Beispiel · AAAAAA', 'Anmeldung (Jonas)', '12,00 €', '18.10.2026 · Bar'] },
      { zellen: ['Maria Beispiel · BBBBBB', 'Anmeldung (Jonas)', '6,00 €', 'offen'] },
    ]);
    expect(t.summe).toBe('18,00 € zusammen · 12,00 € da · 6,00 € offen (1 Anmeldung)');
    // Eine Anmeldung, in der alle warten: zahlt noch nichts – nur mit Warteliste gedruckt.
    const roh = [...mitglieder('CCCCCC', [false, false], 30)];
    const warten = anmeldungenAus(
      e(),
      mitgliederstandAus(roh, [], FELDER, new Set([35]), PERSONEN),
      STICHTAG,
    );
    expect(zahlungenTabelle(e(), warten, false).zeilen).toEqual([]);
    expect(zahlungenTabelle(e(), warten, true).zeilen).toEqual([
      { zellen: ['Maria Beispiel · CCCCCC', 'Anmeldung (Jonas)', '0,00 €', 'wartet'] },
    ]);
    // Kostenlos: passt nicht, mit Hinweis.
    const frei = e();
    frei.preis.grundpreis = { ...frei.preis.grundpreis, betragCent: 0 };
    expect(listenAngebot(frei).find((l) => l.art === 'zahlungen')).toMatchObject({
      passt: false,
      hinweis: expect.stringContaining('kostet nichts'),
    });
  });
});
