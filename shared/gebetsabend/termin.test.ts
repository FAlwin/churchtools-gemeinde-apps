import { describe, expect, it } from 'vitest';
import { naechsterTermin, terminPfad, type TerminRoh } from './termin';

/** Aufbau wie `/calendars/appointments` (gemessen G0-4; nur die gelesenen Felder). */
const t = (id: number, title: string, startDate: string, endDate?: string): TerminRoh => ({
  base: { id, title },
  calculated: { startDate, ...(endDate ? { endDate } : {}) },
});

const JETZT = new Date('2026-11-12T18:00:00Z');

describe('naechsterTermin', () => {
  it('der früheste kommende Termin mit dem Suchwort im Titel, egal in welcher Reihenfolge geliefert', () => {
    const n = naechsterTermin(
      [
        t(3, 'Gebetsabend', '2026-11-26T18:30:00Z', '2026-11-26T20:00:00Z'),
        t(1, 'Gemeindeversammlung', '2026-11-12T18:30:00Z', '2026-11-12T20:00:00Z'),
        t(2, 'Gebetsabend', '2026-11-19T18:30:00Z', '2026-11-19T20:00:00Z'),
      ],
      'Gebet',
      JETZT,
    );
    expect(n).toEqual({
      id: 2,
      titel: 'Gebetsabend',
      beginn: '2026-11-19T18:30:00Z',
      ende: '2026-11-19T20:00:00Z',
    });
  });

  it('ein Abend, der gerade läuft, bleibt der nächste, bis er zu Ende ist', () => {
    const laufend = t(5, 'Gebetsabend', '2026-11-12T17:30:00Z', '2026-11-12T19:00:00Z');
    expect(naechsterTermin([laufend], 'gebet', JETZT)?.id).toBe(5);
    expect(naechsterTermin([laufend], 'gebet', new Date('2026-11-12T19:00:01Z'))).toBeNull();
  });

  it('ohne Ende zählt der Beginn; leeres Suchwort nimmt jeden Termin', () => {
    expect(naechsterTermin([t(7, 'Lobpreis', '2026-11-13T18:00:00Z')], '', JETZT)?.id).toBe(7);
    expect(naechsterTermin([t(7, 'Lobpreis', '2026-11-11T18:00:00Z')], '', JETZT)).toBeNull();
  });

  it('Einträge ohne ID oder Beginn werden übergangen, nicht als Termin gezeigt', () => {
    expect(
      naechsterTermin(
        [{ base: { title: 'Gebetsabend' }, calculated: { startDate: '2026-11-19T18:30:00Z' } }, {}],
        'Gebet',
        JETZT,
      ),
    ).toBeNull();
  });

  it('auch die Form mit `appointment.base` (einzeln geladen) wird gelesen', () => {
    expect(
      naechsterTermin(
        [
          {
            appointment: { base: { id: 9, title: 'Gebetsabend' } },
            calculated: { startDate: '2026-11-19T18:30:00Z' },
          },
        ],
        'Gebet',
        JETZT,
      )?.id,
    ).toBe(9);
  });

  it('Abfrage wie in Protokollen und Anmeldungen', () => {
    expect(terminPfad(4, '2026-11-12', '2027-01-11')).toBe(
      '/calendars/appointments?calendar_ids[]=4&from=2026-11-12&to=2027-01-11',
    );
  });
});
