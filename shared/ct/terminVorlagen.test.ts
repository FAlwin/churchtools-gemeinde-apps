import { describe, expect, it } from 'vitest';
import { terminVorlagenAus, vorlagenFuerKalender } from './terminVorlagen';

/** Wie ChurchTools sie liefert (gemessen 13.11.2026) – mit Beiwerk, das uns nicht interessiert. */
const roh = (extra: Record<string, unknown> = {}) => ({
  id: 3,
  templateName: 'Abendmahl',
  calendarId: 2,
  eventName: 'Gottesdienst',
  services: [
    { serviceId: 6, count: 1 },
    { serviceId: 24, count: 1 },
  ],
  ...extra,
});

describe('terminVorlagenAus', () => {
  it('liest Name, Kalender und Dienste; die ID 0 ist gültig', () => {
    const r = terminVorlagenAus([roh({ id: 0, templateName: ' Standard ' })]);
    expect(r).toEqual([
      {
        id: 0,
        name: 'Standard',
        kalenderId: 2,
        dienste: [
          { serviceId: 6, count: 1 },
          { serviceId: 24, count: 1 },
        ],
      },
    ]);
  });

  it('eine kaputte Vorlage wirft nicht und nimmt die anderen nicht mit', () => {
    const r = terminVorlagenAus([
      null,
      'x',
      roh({ id: 'abc' }),
      roh({ id: null }),
      roh({ templateName: '  ' }),
      roh({ templateName: 7 }),
      roh({ calendarId: null }),
      roh({ services: 'nein' }),
      roh({ services: [{ serviceId: 'x', count: 1 }, { serviceId: 6, count: 0 }, null] }),
      roh({ id: 9, templateName: 'Gut' }),
    ]);
    expect(r.map((v) => v.id)).toEqual([9]);
  });

  it('kaputte Dienste fallen einzeln weg, Doppelte zählen mit der größeren Zahl', () => {
    const [v] = terminVorlagenAus([
      roh({
        services: [
          { serviceId: 6, count: 1 },
          { serviceId: 'kaputt', count: 2 },
          { serviceId: 7, count: 1.5 },
          { serviceId: 6, count: 3 },
          { serviceId: 8, count: -1 },
        ],
      }),
    ]);
    expect(v.dienste).toEqual([{ serviceId: 6, count: 3 }]);
  });

  it('keine Liste → leer', () => {
    expect(terminVorlagenAus(null)).toEqual([]);
    expect(terminVorlagenAus({ data: [] })).toEqual([]);
  });

  it('vorlagenFuerKalender: nur die des Kalenders', () => {
    const alle = terminVorlagenAus([roh({ id: 1, calendarId: 1 }), roh({ id: 2, calendarId: 2 })]);
    expect(vorlagenFuerKalender(alle, 2).map((v) => v.id)).toEqual([2]);
    expect(vorlagenFuerKalender(alle, 5)).toEqual([]);
  });
});
