import { describe, expect, it } from 'vitest';
import type { Veranstaltung } from '@shared/anmeldung/uebersicht';
import {
  alterText,
  anpassungText,
  anzahlText,
  centAus,
  datumText,
  euroEingabe,
  grundpreisText,
  kachel,
  monatTitel,
  schlussText,
  tageBis,
} from './anzeige';

describe('Anzeige (A2, #480)', () => {
  it('Datum, Kachel und Monat', () => {
    expect(datumText('2026-11-14')).toBe('Sa, 14.11.2026');
    expect(kachel('2026-11-04')).toEqual({ tag: '4', monat: 'NOV' });
    expect(kachel('2026-03-01')).toEqual({ tag: '1', monat: 'MÄR' });
    expect(monatTitel('2026-12-31')).toBe('Dezember 2026');
    expect(monatTitel(null)).toBe('Ohne Datum');
  });

  it('Tage zählen über die Zeitumstellung hinweg ganz', () => {
    expect(tageBis('2026-10-12', '2026-11-07')).toBe(26);
    expect(tageBis('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('Anmeldeschluss: Tag in Ortszeit, nur solange offen', () => {
    const v = { anmeldung: 'offen', anmeldungBis: '2026-11-07T22:59:00Z' } as Veranstaltung;
    expect(schlussText(v, '2026-10-12', 'Europe/Berlin')).toBe(
      'Anmeldeschluss 7.11. (noch 26 Tage)',
    );
    // 23:30 UTC ist in Berlin schon der nächste Tag
    expect(
      schlussText({ ...v, anmeldungBis: '2026-10-12T23:30:00Z' }, '2026-10-12', 'Europe/Berlin'),
    ).toBe('Anmeldeschluss 13.10. (morgen)');
    expect(schlussText({ ...v, anmeldung: 'voll' }, '2026-10-12', 'Europe/Berlin')).toBeNull();
    expect(schlussText({ ...v, anmeldungBis: null }, '2026-10-12', 'Europe/Berlin')).toBeNull();
  });

  it('Anzahl in Einzahl und Mehrzahl', () => {
    expect(anzahlText(1, 'Veranstaltung', 'Veranstaltungen')).toBe('1 Veranstaltung');
    expect(anzahlText(3, 'Veranstaltung', 'Veranstaltungen')).toBe('3 Veranstaltungen');
  });
});

describe('Euro-Eingaben (A4)', () => {
  it('übliche Schreibweisen → Cent', () => {
    expect(centAus('12')).toBe(1200);
    expect(centAus('12,5')).toBe(1250);
    expect(centAus('12,50')).toBe(1250);
    expect(centAus('12.50')).toBe(1250);
    expect(centAus(' 65,52 € ')).toBe(6552);
    expect(centAus('1.234,50')).toBe(123450);
    expect(centAus('0,05')).toBe(5);
    expect(centAus('')).toBe(0);
  });
  it('kein Betrag → null, statt still zu runden oder zu raten', () => {
    expect(centAus('12,345')).toBeNull();
    expect(centAus('abc')).toBeNull();
    expect(centAus('-5')).toBeNull();
    expect(centAus('1,2,3')).toBeNull();
  });
  it('hin und zurück: euroEingabe ist das Gegenstück', () => {
    for (const cent of [0, 5, 50, 1200, 1250, 6552, 123450])
      expect(centAus(euroEingabe(cent))).toBe(cent);
    expect(euroEingabe(1200)).toBe('12');
    expect(euroEingabe(1205)).toBe('12,05');
  });
});

describe('Preis-Texte der Karte (A4)', () => {
  it('Grundpreis: kostenlos, fest, nach Auswahl mit Spanne und Kontingent', () => {
    const g = {
      art: 'fest' as const,
      betragCent: 0,
      gilt: 'person' as const,
      auswahlName: '',
      optionen: [],
    };
    expect(grundpreisText(g)).toBe('kostenlos');
    expect(grundpreisText({ ...g, betragCent: 3000, gilt: 'anmeldung' })).toBe(
      '30,00 € pro Anmeldung',
    );
    expect(
      grundpreisText({
        ...g,
        art: 'auswahl',
        auswahlName: 'Zimmer',
        optionen: [
          { name: 'A', preisCent: 8900, kontingent: 0, belegt: 0, personenJe: 0 },
          { name: 'B', preisCent: 6552, kontingent: 4, belegt: 0, personenJe: 0 },
        ],
      }),
    ).toBe('nach Auswahl „Zimmer“ · 2 Optionen, 65,52 €–89,00 € pro Person · mit Kontingent');
  });
  it('Alter und Rabatt', () => {
    expect(
      alterText([
        { von: 0, bis: 2, art: 'frei', wert: 0 },
        { von: 3, bis: 11, art: 'prozent', wert: 50 },
        { von: 18, bis: null, art: 'fest', wert: 9900 },
      ]),
    ).toBe('unter 3 Jahren frei · 3–11 Jahre 50 % · ab 18 Jahren 99,00 €');
    expect(
      anpassungText({
        art: 'rabatt',
        bezeichnung: 'Frühbucher',
        bedingung: 'fruehbucher',
        bis: '2026-10-31',
        abKind: 2,
        einheit: 'euro',
        wert: 500,
        gilt: 'person',
      }),
    ).toBe('−5,00 € pro Person, bei Anmeldung bis 31.10.2026');
    expect(
      anpassungText({
        art: 'zuschlag',
        bezeichnung: 'Einzelzimmer',
        bedingung: 'immer',
        bis: '',
        abKind: 2,
        einheit: 'prozent',
        wert: 20,
        gilt: 'anmeldung',
      }),
    ).toBe('+20 % pro Anmeldung');
  });
});
