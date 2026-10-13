import { describe, expect, it } from 'vitest';
import {
  STANDARD_BEZAHLUNG,
  ibanGueltig,
  ibanNormal,
  ibanText,
  pruefeBezahlung,
  verwendungszweck,
  type Bezahlung,
} from './bezahlung';

/**
 * Bezahlung (A4). Die gültigen IBANs sind die bekannten Beispiel-IBANs der Banken bzw. des ECBS – nicht
 * mit der eigenen Funktion erzeugt.
 */
const GUELTIG = 'DE89370400440532013000';

describe('IBAN', () => {
  it('gültige IBANs aus mehreren Ländern, auch mit Leerzeichen und klein geschrieben', () => {
    expect(ibanGueltig(GUELTIG)).toBe(true);
    expect(ibanGueltig('de89 3704 0044 0532 0130 00')).toBe(true);
    expect(ibanGueltig('GB82WEST12345698765432')).toBe(true);
    expect(ibanGueltig('AT611904300234573201')).toBe(true);
  });

  it('Tippfehler: eine falsche Ziffer, zwei vertauschte Ziffern, zu kurz – alle abgelehnt', () => {
    expect(ibanGueltig('DE89370400440532013001')).toBe(false);
    expect(ibanGueltig('DE89370400440532031000')).toBe(false);
    expect(ibanGueltig('DE8937040044053201300')).toBe(false);
    expect(ibanGueltig('')).toBe(false);
    expect(ibanGueltig('Gemeindekonto')).toBe(false);
  });

  it('eine deutsche IBAN hat immer 22 Zeichen – auch wenn die Prüfziffer zufällig passt', () => {
    // 20 Zeichen mit passend gerechneter Prüfziffer (mod 97 = 1, außerhalb nachgerechnet) – nur die Länge fehlt.
    expect(ibanGueltig('DE291234567890123456')).toBe(false);
    // Dieselbe Rechnung ohne die Längenregel ginge durch: ein anderes Land mit 20 Zeichen.
    expect(ibanGueltig('AT611904300234573201')).toBe(true);
  });

  it('speichern ohne Leerzeichen, lesen in Vierergruppen', () => {
    expect(ibanNormal(' de89 3704 0044 0532 0130 00 ')).toBe(GUELTIG);
    expect(ibanText(GUELTIG)).toBe('DE89 3704 0044 0532 0130 00');
  });
});

describe('Verwendungszweck', () => {
  it('[Nachname] wird ersetzt – auch mehrfach, ohne Leerzeichen am Rand', () => {
    expect(verwendungszweck('Silvester [Nachname]', ' Müller ')).toBe('Silvester Müller');
    expect(verwendungszweck('[Nachname] / [Nachname]', 'Ott')).toBe('Ott / Ott');
    expect(verwendungszweck('Spende Gemeindeessen', 'Ott')).toBe('Spende Gemeindeessen');
  });
});

describe('pruefeBezahlung', () => {
  const b = (x: Partial<Bezahlung>): Bezahlung => ({
    ...STANDARD_BEZAHLUNG,
    kontoinhaber: 'Gemeinde e.V.',
    iban: GUELTIG,
    ...x,
  });

  it('vollständig und richtig → keine Meldung; ganz ohne Konto (kostenlos) auch', () => {
    expect(pruefeBezahlung(b({}))).toEqual([]);
    expect(pruefeBezahlung(STANDARD_BEZAHLUNG)).toEqual([]);
  });

  it('jede Regel einzeln', () => {
    expect(pruefeBezahlung(b({ iban: 'DE89370400440532013001' }))).toEqual([
      'Die IBAN stimmt nicht. Bitte Ziffer für Ziffer prüfen.',
    ]);
    expect(pruefeBezahlung(b({ kontoinhaber: ' ' }))).toEqual([
      'Bitte den Kontoinhaber eintragen.',
    ]);
    expect(pruefeBezahlung(b({ iban: '' }))).toEqual(['Bitte auch die IBAN eintragen.']);
    expect(pruefeBezahlung(b({ bic: 'COBADEFF' }))).toEqual([]);
    expect(pruefeBezahlung(b({ bic: 'COBADEFFXXX' }))).toEqual([]);
    expect(pruefeBezahlung(b({ bic: 'COBA' }))).toEqual([
      'Die BIC hat 8 oder 11 Zeichen (oder bleibt leer).',
    ]);
    expect(pruefeBezahlung(b({ fristTage: -1 }))).toEqual([
      'Die Zahlungsfrist liegt zwischen 0 und 365 Tagen.',
    ]);
    expect(pruefeBezahlung(b({ fristTage: 366 }))).toHaveLength(1);
    expect(pruefeBezahlung(b({ zweck: 'x'.repeat(141) }))).toEqual([
      'Der Verwendungszweck hat höchstens 140 Zeichen.',
    ]);
  });
});
