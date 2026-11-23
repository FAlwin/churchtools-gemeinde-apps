import { describe, expect, it } from 'vitest';
import { plusTage } from '../ct/datum';
import { eintragVorbelegung } from './termine';
import {
  artWechseln,
  bisVorgabe,
  frequenzEinheit,
  istAutomatisch,
  optionsAuswahl,
  ordinalAusDatum,
  tagDazu,
  tagWeg,
  WIEDERHOLUNG,
  WIEDERHOLUNGS_ARTEN,
} from './terminWiederholung';

/** Die Wiederholungs-Regeln des ChurchTools-Dialogs (W15-1) – gemessen am 23.11.2026, Beginn 26.11.2026. */
const BEGINN = '2026-11-26';
const start = (tag = BEGINN) => eintragVorbelegung({ text: 'Treffen, 19 Uhr', datum: tag }, 4);

describe('„Bis“-Vorgabe', () => {
  it.each([
    ['täglich', WIEDERHOLUNG.taeglich, '2026-11-27'],
    ['wöchentlich', WIEDERHOLUNG.woechentlich, '2026-12-03'],
    ['monatlich nach Datum', WIEDERHOLUNG.monatlichDatum, '2026-12-27'],
    ['monatlich nach Wochentag', WIEDERHOLUNG.monatlichWochentag, '2026-12-28'],
    ['jährlich', WIEDERHOLUNG.jaehrlich, '2027-11-26'],
  ])('%s: aus „Keine Wiederholung“ wird Bis = Beginn + repeatId Tage (gemessen)', (_, art, bis) => {
    expect(artWechseln(start(), art).wiederBis).toBe(bis);
    // Dieselbe Rechnung wie `bisVorgabe` – kein zweites Rechenwerk im Fenster.
    expect(artWechseln(start(), art).wiederBis).toBe(bisVorgabe(BEGINN, art));
    expect(bisVorgabe(BEGINN, art)).toBe(plusTage(BEGINN, art));
  });

  it('Gegenprobe der Messung: Beginn 23.11. + monatlich nach Wochentag (32) = 25.12.', () => {
    expect(artWechseln(start('2026-11-23'), WIEDERHOLUNG.monatlichWochentag).wiederBis).toBe(
      '2026-12-25',
    );
  });

  it('der Wechsel zwischen zwei Arten lässt „Bis“ stehen – auch ein selbst gewähltes', () => {
    const a = { ...artWechseln(start(), WIEDERHOLUNG.taeglich), wiederBis: '2027-03-01' };
    expect(artWechseln(a, WIEDERHOLUNG.woechentlich).wiederBis).toBe('2027-03-01');
    expect(artWechseln(a, WIEDERHOLUNG.jaehrlich).wiederBis).toBe('2027-03-01');
  });

  it('nur automatische Arten haben „Bis“ und „Alle x“', () => {
    expect(WIEDERHOLUNGS_ARTEN.filter((a) => istAutomatisch(a.id)).map((a) => a.id)).toEqual([
      1, 7, 31, 32, 365,
    ]);
    expect(istAutomatisch(WIEDERHOLUNG.keine)).toBe(false);
    expect(istAutomatisch(WIEDERHOLUNG.manuell)).toBe(false);
    expect(frequenzEinheit(WIEDERHOLUNG.taeglich)).toBe('Tage');
    expect(frequenzEinheit(WIEDERHOLUNG.woechentlich)).toBe('Woche(n)');
    expect(frequenzEinheit(WIEDERHOLUNG.monatlichDatum)).toBe('Monat(e)');
    expect(frequenzEinheit(WIEDERHOLUNG.monatlichWochentag)).toBe('Monat(e)');
    expect(frequenzEinheit(WIEDERHOLUNG.jaehrlich)).toBe('Jahr(e)');
  });
});

describe('Manuell und Keine Wiederholung', () => {
  it('Manuell hat kein „Bis“ – aber Weitere Termine und Ausnahmen bleiben', () => {
    const a = {
      ...artWechseln(start(), WIEDERHOLUNG.woechentlich),
      weitere: ['2026-12-01'],
      ausnahmen: ['2026-12-10'],
    };
    const m = artWechseln(a, WIEDERHOLUNG.manuell);
    expect(m.wiederBis).toBe('');
    expect(m.weitere).toEqual(['2026-12-01']);
    expect(m.ausnahmen).toEqual(['2026-12-10']);
  });

  it('von Manuell auf eine automatische Art: „Bis“ ist leer, also gilt die Vorgabe', () => {
    const m = artWechseln(start(), WIEDERHOLUNG.manuell);
    expect(artWechseln(m, WIEDERHOLUNG.taeglich).wiederBis).toBe('2026-11-27');
  });

  it('Keine Wiederholung räumt Bis, Weitere Termine und Ausnahmen weg', () => {
    const a = {
      ...artWechseln(start(), WIEDERHOLUNG.woechentlich),
      weitere: ['2026-12-01'],
      ausnahmen: ['2026-12-10'],
    };
    expect(artWechseln(a, WIEDERHOLUNG.keine)).toMatchObject({
      art: 0,
      wiederBis: '',
      weitere: [],
      ausnahmen: [],
    });
  });
});

describe('Monatlich nach Wochentag', () => {
  it.each([
    ['2026-11-01', 1],
    ['2026-11-07', 1],
    ['2026-11-08', 2],
    ['2026-11-26', 4],
    ['2026-11-28', 4],
    ['2026-11-29', 5],
    ['2026-11-30', 5],
  ])('%s ist der %s. seines Wochentags im Monat', (tag, ordinal) => {
    expect(ordinalAusDatum(tag)).toBe(ordinal);
    expect(artWechseln(start(tag), WIEDERHOLUNG.monatlichWochentag).option).toBe(ordinal);
  });

  it('wer das Datum ändert, solange eine andere Art gewählt ist, bekommt beim Wechsel das Ordinal des NEUEN Datums', () => {
    const e = {
      ...start('2026-11-26'),
      art: WIEDERHOLUNG.woechentlich,
      tag: '2026-11-30',
      option: 4,
    };
    expect(artWechseln(e, WIEDERHOLUNG.monatlichWochentag).option).toBe(5);
    // Gegenprobe: Ein anderer Wechsel lässt die Option, wie sie ist.
    expect(artWechseln(e, WIEDERHOLUNG.taeglich).option).toBe(4);
  });

  it('die zweite Auswahl: Erster … Fünfter (wenn vorhanden), Letzter – mit dem Wochentag des Beginns', () => {
    const o = optionsAuswahl(BEGINN);
    expect(o.map((x) => x.wert)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(o.map((x) => x.label)).toEqual([
      'Erster Donnerstag im Monat',
      'Zweiter Donnerstag im Monat',
      'Dritter Donnerstag im Monat',
      'Vierter Donnerstag im Monat',
      'Fünfter Donnerstag im Monat (wenn vorhanden)',
      'Letzter Donnerstag im Monat',
    ]);
    expect(optionsAuswahl('2026-11-29')[0].label).toBe('Erster Sonntag im Monat');
  });
});

describe('Tagesmarken', () => {
  it('tagDazu: ohne Doppelte, nach Datum – tagWeg nimmt einen heraus', () => {
    expect(tagDazu(['2026-12-10'], '2026-12-01')).toEqual(['2026-12-01', '2026-12-10']);
    expect(tagDazu(['2026-12-01'], '2026-12-01')).toEqual(['2026-12-01']);
    expect(tagWeg(['2026-12-01', '2026-12-10'], '2026-12-01')).toEqual(['2026-12-10']);
  });
});
