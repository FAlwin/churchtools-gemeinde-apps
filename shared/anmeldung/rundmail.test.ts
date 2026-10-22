import { describe, expect, it } from 'vitest';
import { anmeldungenAus, mitgliederstandAus } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import { mitCtPlatzhaltern, rundmailEmpfaenger, rundmailVorlage, textZuHtml } from './rundmail';

/**
 * Rundmail (A7-5): je Anmeldung eine Mail an den Kontakt, lesbare Platzhalter → ChurchTools, Text → HTML, Vorlagen.
 * Die Anmeldungen kommen aus dem, was das Formular schreibt (`liste.testdaten.ts`).
 */
const liste = (personen = PERSONEN) => {
  const x = e();
  const roh = [
    ...mitglieder('AAAAAA', [true, true], 10, { bezahlt: true }),
    ...mitglieder('BBBBBB', [true, false], 20),
  ];
  return anmeldungenAus(x, mitgliederstandAus(roh, [], FELDER, new Set([35]), personen), STICHTAG);
};

describe('Empfänger', () => {
  const mitAdressen = new Map([
    ...PERSONEN,
    [20, { name: 'Jonas Beispiel', email: null, geburtstag: '2017-05-01' }],
    [21, { name: 'Lena Beispiel', email: 'tom@beispiel.test', geburtstag: '2019-02-02' }],
  ]);

  it('je Anmeldung eine Mail an die erste Person – ohne Adresse an die nächste mit Adresse', () => {
    const { an, ohneAdresse } = rundmailEmpfaenger(liste(mitAdressen), 'alle');
    expect(an.map((x) => [x.nr, x.personId, x.email])).toEqual([
      ['AAAAAA', 10, 'maria@beispiel.test'],
      ['BBBBBB', 21, 'tom@beispiel.test'],
    ]);
    expect(ohneAdresse).toEqual([]);
  });

  it('Filter: Zahlung offen, Warteliste; ohne jede Adresse wird übersprungen und genannt', () => {
    expect(rundmailEmpfaenger(liste(mitAdressen), 'offen').an.map((x) => x.nr)).toEqual(['BBBBBB']);
    expect(rundmailEmpfaenger(liste(mitAdressen), 'warte').an.map((x) => x.nr)).toEqual(['BBBBBB']);
    const ohne = new Map([
      ...PERSONEN,
      [20, { name: 'Jonas Beispiel', email: null, geburtstag: null }],
      [21, { name: 'Lena Beispiel', email: null, geburtstag: null }],
    ]);
    expect(rundmailEmpfaenger(liste(ohne), 'alle')).toEqual({
      an: [expect.objectContaining({ nr: 'AAAAAA' })],
      ohneAdresse: ['Maria Beispiel'],
    });
  });
});

describe('Platzhalter und HTML', () => {
  const ct = new Map([
    ['Betrag', '{{{groupMemberField.betrag}}}'],
    ['Anmelde-Nr.', '{{{groupMemberField.anmelde-nr-}}}'],
  ]);

  it('lesbare Platzhalter → ChurchTools; Vorname/Nachname der Person; unbekannte bleiben und werden genannt', () => {
    expect(
      mitCtPlatzhaltern('[Vorname] [Nachname]: [Betrag] für [Anmelde-Nr.], [Schuhgröße]', ct),
    ).toEqual({
      text: '{{person.firstName}} {{person.lastName}}: {{{groupMemberField.betrag}}} für {{{groupMemberField.anmelde-nr-}}}, [Schuhgröße]',
      unbekannt: ['Schuhgröße'],
    });
  });

  it('Text → HTML: Absätze, Zeilenumbrüche, Sonderzeichen geschützt', () => {
    expect(textZuHtml('Hallo <Maria> & Tom,\r\n\r\nZeile 1\nZeile 2\n')).toBe(
      '<p>Hallo &lt;Maria&gt; &amp; Tom,</p><p>Zeile 1<br>Zeile 2</p>',
    );
  });
});

describe('Vorlagen', () => {
  it('Zahlungserinnerung mit Bankdaten aus „Bezahlung“, Verwendungszweck mit [Nachname]; ohne Konto ein Satz', () => {
    const x = e();
    x.bezahlung = {
      ...x.bezahlung,
      kontoinhaber: 'Gemeinde e.V.',
      iban: 'XXTEST',
      zweck: 'Freizeit [Nachname]',
    };
    x.kontakt = 'freizeit@gemeinde.test';
    const v = rundmailVorlage('zahlung', x, 'Kinderfreizeit');
    expect(v.betreff).toBe('Kinderfreizeit: Bitte noch überweisen');
    expect(v.text).toMatch(
      /^Hallo \[Angemeldet von\],\n\nfür eure Anmeldung \[Anmelde-Nr\.\] zu „Kinderfreizeit“ ist noch \[Betrag\] offen\./,
    );
    expect(v.text).toMatch(
      /Kontoinhaber: Gemeinde e\.V\.\nIBAN: XXTE ST\nVerwendungszweck: Freizeit \[Nachname\]/,
    );
    expect(v.text).toMatch(/Bei Fragen: freizeit@gemeinde\.test\n\nViele Grüße$/);
    // Alle Platzhalter der Vorlage gibt es (mit den Feldern einer Anmeldung).
    const ct = new Map(['Angemeldet von', 'Anmelde-Nr.', 'Betrag'].map((n) => [n, `{{{${n}}}}`]));
    expect(mitCtPlatzhaltern(v.text, ct).unbekannt).toEqual([]);
    expect(rundmailVorlage('zahlung', e(), 'Kinderfreizeit').text).toMatch(
      /Wie ihr bezahlt, sagen wir euch noch\./,
    );
  });

  it('Infos vorab mit Datum, Uhrzeit und Ort aus dem Termin; leer ist leer', () => {
    const x = e();
    x.termin = { beginn: '2026-11-20T10:00', ende: null, ort: 'Gemeindehaus', terminId: null };
    expect(rundmailVorlage('vorab', x, 'Kinderfreizeit').text).toMatch(
      /bald ist es so weit: „Kinderfreizeit“ am 20\.11\.2026, 10:00 Uhr in Gemeindehaus\./,
    );
    expect(rundmailVorlage('leer', x, 'Kinderfreizeit')).toEqual({ betreff: '', text: '' });
  });
});
