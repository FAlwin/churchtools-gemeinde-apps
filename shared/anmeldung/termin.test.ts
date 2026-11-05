import { describe, expect, it } from 'vitest';
import { neueEinstellungen } from './vorlagen';
import {
  anmeldeLink,
  mitGewaehltemTermin,
  ortszeitAus,
  terminAusCt,
  terminImKalender,
  terminWann,
  terminZeile,
  utcAus,
  type CtTerminEinzeln,
} from './termin';

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

describe('terminZeile (Formular und Aushang)', () => {
  it('ein Tag mit Ort, mehrtägig mit „–“, ohne Termin „Termin folgt“', () => {
    const t = { beginn: '2026-11-21T12:00', ende: null, ort: 'Gemeindehaus', terminId: null };
    expect(terminZeile({ termin: t })).toBe('Sa, 21.11.2026 · Gemeindehaus');
    expect(terminZeile({ termin: { ...t, ende: '2026-11-23T14:00', ort: '' } })).toBe(
      'Sa, 21.11.2026 – Mo, 23.11.2026',
    );
    expect(terminZeile({ termin: { ...t, ende: '2026-11-21T18:00' } })).toBe(
      'Sa, 21.11.2026 · Gemeindehaus',
    );
    expect(terminZeile({ termin: null })).toBe('Termin folgt');
  });
});

describe('terminWann (Karte „Termin“, Hinweis „verschoben“)', () => {
  it('ein Tag mit Ende, ohne Ende, mehrtägig', () => {
    expect(terminWann({ beginn: '2026-08-31T10:00', ende: '2026-08-31T12:00' })).toBe(
      'Mo, 31.08.2026, 10:00 Uhr bis 12:00 Uhr',
    );
    expect(terminWann({ beginn: '2026-08-31T10:00', ende: null })).toBe(
      'Mo, 31.08.2026, 10:00 Uhr',
    );
    expect(terminWann({ beginn: '2026-12-28T15:00', ende: '2027-01-02T11:00' })).toBe(
      'Mo, 28.12.2026, 15:00 Uhr bis Sa, 02.01.2027, 11:00 Uhr',
    );
  });
});

describe('terminImKalender (K1, gemessen 05.11.2026)', () => {
  /** Einzeltermin 263, wie gemessen: Nummer bleibt beim Verschieben, Kalender steht am Termin. */
  const einzeln = (start: string, ende: string, ort = 'Saal A', kalender = 1): CtTerminEinzeln => ({
    appointment: {
      id: 263,
      startDate: start,
      endDate: ende,
      address: { name: ort, city: null },
      repeatId: 0,
      calendar: { id: kalender },
    },
  });
  // Gespeichert wird, was `terminAusCt` beim Wählen daraus macht – nicht ein handgeschriebenes Literal.
  const gewaehlt = terminAusCt(
    einzeln('2026-11-20T09:00:00Z', '2026-11-20T11:00:00Z').appointment,
    B,
    1,
  );

  it('unverändert → gleich', () => {
    expect(
      terminImKalender(gewaehlt, einzeln('2026-11-20T09:00:00Z', '2026-11-20T11:00:00Z'), B),
    ).toEqual({ art: 'gleich' });
  });

  it('verschoben (21.11., 15–17 Uhr) → übernehmen, sichtbar; der neue Stand wie beim Wählen', () => {
    const gelesen = einzeln('2026-11-21T14:00:00Z', '2026-11-21T16:00:00Z');
    expect(terminImKalender(gewaehlt, gelesen, B)).toEqual({
      art: 'geaendert',
      sichtbar: true,
      neu: terminAusCt(gelesen.appointment, B, 1),
    });
  });

  it('nur der Ort geändert → auch sichtbar', () => {
    const k = terminImKalender(
      gewaehlt,
      einzeln('2026-11-20T09:00:00Z', '2026-11-20T11:00:00Z', 'Saal B'),
      B,
    );
    expect(k).toMatchObject({ art: 'geaendert', sichtbar: true, neu: { ort: 'Saal B' } });
  });

  it('nur in einen anderen Kalender gelegt → still nachziehen (kein Hinweis)', () => {
    const k = terminImKalender(
      gewaehlt,
      einzeln('2026-11-20T09:00:00Z', '2026-11-20T11:00:00Z', 'Saal A', 3),
      B,
    );
    expect(k).toMatchObject({ art: 'geaendert', sichtbar: false, neu: { kalenderId: 3 } });
  });

  it('gelöscht (404) → weg; das Datum bleibt beim Aufrufer stehen', () => {
    expect(terminImKalender(gewaehlt, null, B)).toEqual({ art: 'weg' });
  });

  describe('Serie', () => {
    const serie = (tage: Record<string, [string, string]>): CtTerminEinzeln => ({
      appointment: {
        id: 266,
        startDate: '2026-11-23T17:00:00Z',
        endDate: '2026-11-23T18:00:00Z',
        address: { name: 'Saal C', city: null },
        repeatId: 7,
        calendar: { id: 1 },
      },
      calculatedDates: Object.fromEntries(
        Object.entries(tage).map(([k, [a, e]]) => [k, { startDate: a, endDate: e }]),
      ),
    });
    // Gewählt: die Wiederholung am 30.11. – so liefert sie die Kalenderliste (`calculated`).
    const am30 = terminAusCt(
      {
        id: 266,
        startDate: '2026-11-30T17:00:00Z',
        endDate: '2026-11-30T18:00:00Z',
        address: { name: 'Saal C', city: null },
      },
      B,
      1,
    );

    it('die Wiederholung steht noch so da → gleich', () => {
      const s = serie({
        '2026-11-23': ['2026-11-23T17:00:00Z', '2026-11-23T18:00:00Z'],
        '2026-11-30': ['2026-11-30T17:00:00Z', '2026-11-30T18:00:00Z'],
      });
      expect(terminImKalender(am30, s, B)).toEqual({ art: 'gleich' });
    });

    it('nur diese Wiederholung verschoben oder abgesagt (Ausnahme, fehlt) → weg', () => {
      const s = serie({ '2026-11-23': ['2026-11-23T17:00:00Z', '2026-11-23T18:00:00Z'] });
      expect(terminImKalender(am30, s, B)).toEqual({ art: 'weg' });
    });

    it('die ganze Serie eine Stunde später → übernehmen', () => {
      const s = serie({ '2026-11-30': ['2026-11-30T18:00:00Z', '2026-11-30T19:00:00Z'] });
      expect(terminImKalender(am30, s, B)).toMatchObject({
        art: 'geaendert',
        sichtbar: true,
        neu: { beginn: '2026-11-30T19:00', terminId: 266 },
      });
    });
  });
});

describe('mitGewaehltemTermin (K1)', () => {
  it('setzt den Termin und verwirft „im Kalender verschoben“ der alten Wahl – sonst bleibt alles', () => {
    const e = {
      ...neueEinstellungen('einfach'),
      loeschfristMonate: 5,
      terminVerschoben: { vorher: { beginn: '2026-11-01T10:00', ende: null, ort: '' }, am: 'x' },
    };
    const t = { beginn: '2026-12-01T10:00', ende: null, ort: 'Saal', terminId: 9, kalenderId: 1 };
    const neu = mitGewaehltemTermin(e, t);
    expect(neu.termin).toEqual(t);
    expect(neu.terminVerschoben).toBeUndefined();
    expect(neu.loeschfristMonate).toBe(5);
    expect(mitGewaehltemTermin(e, null).termin).toBeNull();
  });
});
