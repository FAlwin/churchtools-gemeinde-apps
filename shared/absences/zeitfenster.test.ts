import { describe, expect, it } from 'vitest';
import { decktTermin, zeitfensterFuer, type TerminZeit } from './index';

/**
 * **Zeitfenster eines „Nein“ und die Grenze** (E5c-1a). Gemessen an der Test-Instanz am 18.11.2026
 * (`dienstplaner-planung/docs/messung-e5c.md`, Termin 09:00–10:30): ChurchTools zieht beim Einteilen −1000 ab, sobald
 * sich Abwesenheit und Termin **berühren** – auch 08:00–09:00 und 10:30–11:30. 08:00–08:59 und 10:31–11:30 nicht.
 * Die Fälle hier sind genau diese Messung, nicht ausgedacht.
 */
const termin: TerminZeit = {
  date: '2027-01-10',
  startDate: '2027-01-10T09:00:00Z',
  endDate: '2027-01-10T10:30:00Z',
};
const fenster = (startTime: string, endTime: string) => ({
  startDate: '2027-01-10',
  endDate: '2027-01-10',
  startTime,
  endTime,
});

describe('decktTermin – Grenze geschlossen wie ChurchTools', () => {
  it.each([
    ['A davor', '2027-01-10T07:00:00Z', '2027-01-10T08:00:00Z', false],
    ['G endet 1 Min. vorher', '2027-01-10T08:00:00Z', '2027-01-10T08:59:00Z', false],
    ['F endet genau zum Beginn', '2027-01-10T08:00:00Z', '2027-01-10T09:00:00Z', true],
    ['B mittendrin', '2027-01-10T09:30:00Z', '2027-01-10T10:00:00Z', true],
    ['C beginnt genau zum Ende', '2027-01-10T10:30:00Z', '2027-01-10T11:30:00Z', true],
    ['D 1 Min. danach', '2027-01-10T10:31:00Z', '2027-01-10T11:30:00Z', false],
    ['E danach', '2027-01-10T11:00:00Z', '2027-01-10T12:00:00Z', false],
  ])('Fall %s', (_fall, von, bis, erwartet) => {
    expect(decktTermin(fenster(von, bis), termin)).toBe(erwartet);
  });

  it('ganztägig deckt weiter jeden Termin des Tages', () => {
    expect(
      decktTermin(
        { startDate: '2027-01-10', endDate: '2027-01-10', startTime: null, endTime: null },
        termin,
      ),
    ).toBe(true);
  });
});

describe('zeitfensterFuer – eine Minute vor dem Ende', () => {
  it('trägt die Terminzeit minus eine Minute ein, im Format von ChurchTools', () => {
    expect(zeitfensterFuer(termin)).toEqual({
      startTime: '2027-01-10T09:00:00Z',
      endTime: '2027-01-10T10:29:00Z',
    });
  });

  it('das Fenster deckt den eigenen Termin, aber nicht den direkt folgenden', () => {
    const f = zeitfensterFuer(termin)!;
    const folgender: TerminZeit = {
      date: '2027-01-10',
      startDate: '2027-01-10T10:30:00Z',
      endDate: '2027-01-10T12:00:00Z',
    };
    const a = { startDate: '2027-01-10', endDate: '2027-01-10', ...f };
    expect(decktTermin(a, termin)).toBe(true);
    expect(decktTermin(a, folgender)).toBe(false);
  });

  it('rechnet mit Zeitpunkten – ein Offset im Ende ändert nichts', () => {
    expect(
      zeitfensterFuer({
        date: '2027-01-10',
        startDate: '2027-01-10T10:00:00+01:00',
        endDate: '2027-01-10T11:30:00+01:00',
      }),
    ).toEqual({ startTime: '2027-01-10T10:00:00+01:00', endTime: '2027-01-10T10:29:00Z' });
  });

  it('ohne Ende oder mit Ende vor dem Beginn: ganztägig (null)', () => {
    expect(zeitfensterFuer({ ...termin, endDate: '' })).toBeNull();
    expect(zeitfensterFuer({ ...termin, endDate: termin.startDate })).toBeNull();
    expect(zeitfensterFuer({ ...termin, endDate: '2027-01-10T08:00:00Z' })).toBeNull();
  });

  it('ein Termin von höchstens einer Minute behält sein volles Fenster', () => {
    expect(zeitfensterFuer({ ...termin, endDate: '2027-01-10T09:01:00Z' })).toEqual({
      startTime: '2027-01-10T09:00:00Z',
      endTime: '2027-01-10T09:01:00Z',
    });
  });
});
