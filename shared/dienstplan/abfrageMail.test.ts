import { describe, expect, it } from 'vitest';
import { tagLang } from '../ct/datum';
import { monateText } from './abfrageStand';
import { htmlText } from './erinnern';
import {
  CT_VORNAME,
  PLATZHALTER_BETREFF,
  PLATZHALTER_TEXT,
  STANDARD_BETREFF,
  STANDARD_TEXT,
  mailFuer,
  unbekannteStellen,
} from './abfrageMail';

const A = { von: '2027-02-01', bis: '2027-03-31', frist: '2027-01-05' };
const LINK = 'https://ct.test/ccm/dienstplaner/#/abwesenheiten?abfrage=4';
const standard = { mail: null };

describe('mailFuer', () => {
  it('Standard: Betreff mit Zeitraum, Text mit Frist, Gruppe und dem ChurchTools-Vornamen', () => {
    const m = mailFuer(standard, A, 'Musik', LINK, 'zusagen');
    expect(m.betreff).toBe('Bitte eintragen: Wann kannst du im Februar und März?');
    expect(m.html).toContain(`Hallo ${CT_VORNAME},`);
    expect(m.html).toContain('die Musik plant <b>Februar und März</b>');
    expect(m.html).toContain('bis <b>Dienstag, 5. Januar</b>');
    expect(m.html).not.toMatch(/\{(zeitraum|frist|gruppe|vorname)\}/);
  });

  it('Zeitraum und Frist kommen aus den vorhandenen Regeln (monateText, tagLang)', () => {
    const m = mailFuer(standard, A, 'Musik', LINK, 'zusagen');
    expect(m.html).toContain(htmlText(monateText(A.von, A.bis)));
    expect(m.html).toContain(htmlText(tagLang(A.frist)));
  });

  it('der Knopf steht unter dem zweiten Absatz, der Nachsatz danach – mit dem Link', () => {
    const { html } = mailFuer(standard, A, 'Musik', LINK, 'zusagen');
    const knopf = html.indexOf('Im Dienstplaner eintragen');
    expect(html.indexOf('plant')).toBeLessThan(knopf);
    expect(knopf).toBeLessThan(html.indexOf('Hast du inzwischen alles eingetragen?'));
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toMatch(/<p style="[^"]*font-size:12px[^"]*">Hast du inzwischen/);
  });

  it('ein kurzer Text: der Knopf steht am Ende', () => {
    const { html } = mailFuer(
      { mail: { betreff: 'b', text: 'Nur ein Satz.' } },
      A,
      'Musik',
      LINK,
      'zusagen',
    );
    expect(html.endsWith('</a></p>')).toBe(true);
    expect(html).toContain('<p>Nur ein Satz.</p>');
  });

  it('eigener Text: Platzhalter ersetzt, Zeilenumbrüche bleiben, Betreff ist Klartext (nicht maskiert)', () => {
    const m = mailFuer(
      { mail: { betreff: 'Frist {frist} & {gruppe}', text: 'Zeile 1\nZeile 2 {vorname}\n\nz' } },
      A,
      'Kinder & Jugend',
      LINK,
      'zusagen',
    );
    expect(m.betreff).toBe('Frist Dienstag, 5. Januar & Kinder & Jugend');
    expect(m.html).toContain('<p>Zeile 1<br>Zeile 2 ' + CT_VORNAME + '</p>');
  });

  it('HTML-sicher: Text und Gruppenname werden maskiert, der Planer kann kein HTML einschleusen', () => {
    const m = mailFuer(
      { mail: { betreff: 'b', text: '<script>alert(1)</script> {gruppe}' } },
      A,
      '<b onload="x">',
      'https://ct.test/"><script>',
      'zusagen',
    );
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt; &lt;b onload=&quot;x&quot;&gt;',
    );
    expect(m.html).not.toContain('"><script>');
  });

  it('ein eingesetzter Wert wird nicht noch einmal ausgewertet', () => {
    const m = mailFuer(
      { mail: { betreff: '{gruppe}', text: 't {gruppe}' } },
      A,
      '{frist}',
      LINK,
      'zusagen',
    );
    expect(m.betreff).toBe('{frist}');
    expect(m.html).toContain('t {frist}');
  });

  it('ein unbekannter Platzhalter bleibt stehen (sichtbar statt verschluckt)', () => {
    const m = mailFuer(
      { mail: { betreff: '{zeitrum}', text: 'x {zeitrum}' } },
      A,
      'Musik',
      LINK,
      'zusagen',
    );
    expect(m.betreff).toBe('{zeitrum}');
    expect(m.html).toContain('x {zeitrum}');
  });
});

describe('unbekannteStellen', () => {
  it('meldet nur Unbekanntes, je einmal; {vorname} gibt es nur im Text', () => {
    expect(unbekannteStellen('{zeitraum} {abc} {abc} {xyz}', PLATZHALTER_TEXT)).toEqual([
      '{abc}',
      '{xyz}',
    ]);
    expect(unbekannteStellen('{vorname}', PLATZHALTER_BETREFF)).toEqual(['{vorname}']);
    expect(unbekannteStellen('{vorname}', PLATZHALTER_TEXT)).toEqual([]);
  });

  it('die Standardtexte enthalten nur bekannte Platzhalter', () => {
    expect(unbekannteStellen(STANDARD_BETREFF, PLATZHALTER_BETREFF)).toEqual([]);
    expect(unbekannteStellen(STANDARD_TEXT, PLATZHALTER_TEXT)).toEqual([]);
  });
});
