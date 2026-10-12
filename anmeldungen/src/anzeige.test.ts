import { describe, expect, it } from 'vitest';
import type { Veranstaltung } from '@shared/anmeldung/uebersicht';
import { anzahlText, datumText, kachel, monatTitel, schlussText, tageBis } from './anzeige';

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
