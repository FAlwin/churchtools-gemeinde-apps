import { describe, expect, it } from 'vitest';
import { anmeldeLink, ortszeitAus, terminAusCt, utcAus } from './termin';

const B = 'Europe/Berlin';

describe('Ortszeit ↔ UTC (A3, #486)', () => {
  it('gemessen: 08:30Z am 14.11. ist 9:30 Uhr in ChurchTools', () => {
    expect(ortszeitAus('2026-11-14T08:30:00Z', B)).toBe('2026-11-14T09:30');
    expect(utcAus('2026-11-14T09:30', B)).toBe('2026-11-14T08:30:00Z');
  });
  it('Sommerzeit: zwei Stunden Abstand', () => {
    expect(utcAus('2026-07-05T10:00', B)).toBe('2026-07-05T08:00:00Z');
    expect(ortszeitAus('2026-07-05T08:00:00Z', B)).toBe('2026-07-05T10:00');
  });
  it('an den Tagen der Zeitumstellung stimmt der Abstand des Zeitpunkts selbst', () => {
    expect(utcAus('2026-03-29T12:00', B)).toBe('2026-03-29T10:00:00Z');
    expect(utcAus('2026-10-25T12:00', B)).toBe('2026-10-25T11:00:00Z');
    expect(utcAus('2026-03-29T01:00', B)).toBe('2026-03-29T00:00:00Z');
  });
  it('über Mitternacht in UTC: der Tag in Ortszeit zählt', () => {
    expect(ortszeitAus('2026-12-31T23:30:00Z', B)).toBe('2027-01-01T00:30');
  });
  it('falsche Schreibweise → Fehler', () => {
    expect(() => utcAus('14.11.2026 09:30', B)).toThrow('JJJJ-MM-TT');
  });
});

describe('terminAusCt', () => {
  it('Kopie mit Ort aus Name und Stadt, Ende nur wenn anders', () => {
    expect(
      terminAusCt(
        {
          id: 58,
          startDate: '2026-11-15T11:00:00Z',
          endDate: '2026-11-15T13:00:00Z',
          address: { name: 'Gemeindesaal', city: 'Lohmar' },
        },
        B,
      ),
    ).toEqual({
      beginn: '2026-11-15T12:00',
      ende: '2026-11-15T14:00',
      ort: 'Gemeindesaal, Lohmar',
      terminId: 58,
    });
    expect(
      terminAusCt(
        {
          id: 1,
          startDate: '2026-11-15T11:00:00Z',
          endDate: '2026-11-15T11:00:00Z',
          address: null,
        },
        B,
      ),
    ).toEqual({ beginn: '2026-11-15T12:00', ende: null, ort: '', terminId: 1 });
  });
  it('ganztägig (nur Datum): von 0:00 bis 23:59', () => {
    expect(
      terminAusCt({ id: 2, startDate: '2026-12-28', endDate: '2027-01-02', allDay: true }, B),
    ).toMatchObject({
      beginn: '2026-12-28T00:00',
      ende: '2027-01-02T23:59',
    });
  });
});

describe('anmeldeLink', () => {
  it('Formular-Seite der Gemeinde + Instanz + Gruppe', () => {
    expect(
      anmeldeLink('https://anmeldung.beispiel.de/', 'https://test-ecg-donrath.church.tools', 60),
    ).toBe('https://anmeldung.beispiel.de/#test-ecg-donrath.church.tools/60');
  });
});
