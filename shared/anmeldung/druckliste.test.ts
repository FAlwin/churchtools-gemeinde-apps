import { describe, expect, it } from 'vitest';
import { anmeldungenAus, mitgliederstandAus } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import {
  DRUCK_STANDARD,
  druckDateiname,
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
