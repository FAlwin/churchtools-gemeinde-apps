import { describe, expect, it } from 'vitest';
import { neueAufgabe, statusSetzen, type Aufgabe } from './aufgaben';
import { faelligkeit, fristAnzeige } from './frist';

// Donnerstag, 19.11.2026.
const HEUTE = '2026-11-19';
const a = (bis: string | null, erledigt = false): Aufgabe => {
  const x = {
    ...neueAufgabe({
      id: 'a',
      gruppe: 1,
      sitzung: null,
      text: 'a',
      von: 1,
      am: '2026-10-01T10:00:00Z',
    }),
    bis,
  };
  return erledigt ? statusSetzen(x, 'erledigt', 1, '2026-11-18T10:00:00Z') : x;
};

describe('fristAnzeige – Frist in Worten', () => {
  it('ohne Frist: nichts', () => {
    expect(fristAnzeige(a(null), HEUTE)).toBeNull();
  });
  it('überfällig: „seit 20.10.“, rot, Tooltip nennt das volle Datum', () => {
    expect(fristAnzeige(a('2026-10-20'), HEUTE)).toEqual({
      text: 'seit 20.10.',
      art: 'ueberfaellig',
      titel: 'überfällig seit Di, 20.10.2026',
    });
    // Gestern ist schon überfällig.
    expect(fristAnzeige(a('2026-11-18'), HEUTE)?.art).toBe('ueberfaellig');
  });
  it('heute und morgen: Wort, orange', () => {
    expect(fristAnzeige(a('2026-11-19'), HEUTE)).toMatchObject({ text: 'heute', art: 'bald' });
    expect(fristAnzeige(a('2026-11-20'), HEUTE)).toMatchObject({ text: 'morgen', art: 'bald' });
  });
  it('2 bis 6 Tage: der Wochentag ausgeschrieben; ab 7 Tagen das Datum', () => {
    expect(fristAnzeige(a('2026-11-21'), HEUTE)).toEqual({
      text: 'Samstag',
      art: 'normal',
      titel: 'Sa, 21.11.2026',
    });
    expect(fristAnzeige(a('2026-11-25'), HEUTE)?.text).toBe('Mittwoch');
    expect(fristAnzeige(a('2026-11-26'), HEUTE)).toMatchObject({ text: '26.11.', art: 'normal' });
    expect(fristAnzeige(a('2026-11-29'), HEUTE)?.text).toBe('29.11.');
  });
  it('erledigt: nur das Datum, neutral – auch wenn es überfällig wäre', () => {
    expect(fristAnzeige(a('2026-10-20', true), HEUTE)).toMatchObject({
      text: '20.10.',
      art: 'normal',
    });
    expect(fristAnzeige(a('2026-11-19', true), HEUTE)?.text).toBe('19.11.');
  });
  it('über den Jahreswechsel: Wochentag und Datum stimmen', () => {
    expect(fristAnzeige(a('2027-01-01'), '2026-12-30')?.text).toBe('Freitag');
    expect(fristAnzeige(a('2027-01-09'), '2026-12-30')?.text).toBe('09.01.');
  });
});

describe('faelligkeit – Fächer bei „Nach Fälligkeit“', () => {
  it.each<[string | null, boolean, string]>([
    ['2026-10-20', false, 'ueberfaellig'],
    ['2026-11-19', false, 'woche'],
    ['2026-11-25', false, 'woche'],
    ['2026-11-26', false, 'spaeter'],
    [null, false, 'ohne'],
    ['2026-10-20', true, 'erledigt'],
    [null, true, 'erledigt'],
  ])('bis %s, erledigt %s → %s', (bis, erl, fach) => {
    expect(faelligkeit(a(bis, erl), HEUTE)).toBe(fach);
  });
  it('Wochen-Grenze = Grenze des Wochentags im Kästchen (eine Zahl, nicht zwei)', () => {
    for (const tag of ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']) {
      const woche = faelligkeit(a(tag), HEUTE) === 'woche';
      const wort = fristAnzeige(a(tag), HEUTE)!.text;
      expect(woche).toBe(!/^\d/.test(wort));
    }
  });
});
