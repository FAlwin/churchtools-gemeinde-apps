import { describe, expect, it } from 'vitest';
import { eintragVorbelegung, type Eintrag } from './termine';
import {
  eventHinweis,
  eventsFuer,
  eventVorlagenAus,
  hinweiseZusammen,
  vorlageFuerAlle,
  vorlageFuerZeile,
} from './terminEvents';
import { vorlageAnwenden, vorlagenAus } from './terminVorlagen';
import { WIEDERHOLUNG } from './terminWiederholung';

/** Events zum Termin (W15-3): Eventvorlagen lesen, Zeilen setzen, Rumpf-Zeilen, Hinweise. */
const ZONE = 'Europe/Berlin';
const wochen = (extra: Partial<Eintrag> = {}): Eintrag => ({
  ...eintragVorbelegung({ text: 'Abend, 18 Uhr', datum: '2027-02-02' }, 4),
  art: WIEDERHOLUNG.woechentlich,
  wiederBis: '2027-02-16',
  ...extra,
});

describe('eventVorlagenAus', () => {
  it('liest Nummer und Namen in der Reihenfolge von ChurchTools – die Nummer 0 ist gültig', () => {
    expect(
      eventVorlagenAus([
        { id: 0, templateName: 'Standard', calendarId: 2 },
        { id: '5', templateName: 'Jugend' },
      ]),
    ).toEqual([
      { id: 0, name: 'Standard' },
      { id: 5, name: 'Jugend' },
    ]);
  });

  it('ohne ganzzahlige Nummer ≥ 0 keine Vorlage; ohne Namen ein Ersatzname; Unsinn = leer', () => {
    expect(
      eventVorlagenAus([
        { templateName: 'x' },
        { id: -1 },
        { id: 1.5 },
        { id: '' },
        null,
        { id: 3 },
      ]),
    ).toEqual([{ id: 3, name: 'Vorlage 3' }]);
    expect(eventVorlagenAus(null)).toEqual([]);
    expect(eventVorlagenAus({})).toEqual([]);
  });
});

describe('Zeilen setzen', () => {
  it('eine Zeile setzen und wieder leeren – die Nummer 0 bleibt eine Wahl (nicht „leer“)', () => {
    const mit0 = vorlageFuerZeile({}, '2027-02-09', 0);
    expect(mit0).toEqual({ '2027-02-09': 0 });
    expect('2027-02-09' in mit0).toBe(true);
    expect(vorlageFuerZeile(mit0, '2027-02-09', null)).toEqual({});
    expect(vorlageFuerZeile({ '2027-02-09': 1 }, '2027-02-16', 2)).toEqual({
      '2027-02-09': 1,
      '2027-02-16': 2,
    });
  });

  it('„für alle“ setzt die Vorlage in jeder Zeile der Reihe', () => {
    expect(vorlageFuerAlle(wochen(), 0)).toEqual({
      '2027-02-02': 0,
      '2027-02-09': 0,
      '2027-02-16': 0,
    });
  });
});

describe('eventsFuer', () => {
  it('nur Zeilen mit gewählter Vorlage, mit dem exakten UTC-Beginn des Tages', () => {
    const e = wochen({ events: { '2027-02-09': 3 } });
    expect(eventsFuer(e, ZONE)).toEqual([
      { tag: '2027-02-09', startDate: '2027-02-09T17:00:00Z', eventTemplateId: 3 },
    ]);
  });

  it('Vorlage 0 („Standard“) geht mit – sie ist nicht „keine“', () => {
    const e = wochen({ events: { '2027-02-02': 0 } });
    expect(eventsFuer(e, ZONE)).toEqual([
      { tag: '2027-02-02', startDate: '2027-02-02T17:00:00Z', eventTemplateId: 0 },
    ]);
  });

  it('Tage, die es in der Reihe nicht (mehr) gibt, gehen nicht mit: Ausnahme, Bis gekürzt, Wiederholung weg', () => {
    const events = { '2027-02-09': 1, '2027-02-16': 1 };
    expect(
      eventsFuer(wochen({ events, ausnahmen: ['2027-02-09'] }), ZONE).map((x) => x.tag),
    ).toEqual(['2027-02-16']);
    expect(eventsFuer(wochen({ events, wiederBis: '2027-02-10' }), ZONE).map((x) => x.tag)).toEqual(
      ['2027-02-09'],
    );
    expect(eventsFuer(wochen({ events, art: WIEDERHOLUNG.keine }), ZONE)).toEqual([]);
  });

  it('ganztägig: 00:00 Ortszeit des Tages als UTC', () => {
    const e = {
      ...eintragVorbelegung({ text: 'Tag', datum: '2027-02-10' }, 4),
      events: { '2027-02-10': 2 },
    };
    expect(e.ganztaegig).toBe(true);
    expect(eventsFuer(e, ZONE)).toEqual([
      { tag: '2027-02-10', startDate: '2027-02-09T23:00:00Z', eventTemplateId: 2 },
    ]);
  });
});

describe('Termin-Vorlage mit Events', () => {
  const roh = (extra: Record<string, unknown> = {}) => ({
    id: 7,
    calendarId: 4,
    title: 'Gottesdienst',
    startTime: '10:00',
    duration: 3600,
    repeatId: 7,
    repeatDuration: 86_400 * 14,
    ...extra,
  });
  const eine = (extra: Record<string, unknown> = {}) => vorlagenAus([roh(extra)])[0];

  it('so wie ChurchTools sie schreibt: `eventTemplate` als Text (gemessen 26.11.2026), 0 bleibt 0', () => {
    // Wörtlich aus einer im ChurchTools-Dialog gespeicherten Vorlage (Test-Instanz, Vorlage 4).
    expect(eine({ events: [{ eventTemplate: '0' }] }).eventVorlage).toBe(0);
    expect(eine({ events: [{ eventTemplate: '12' }] }).eventVorlage).toBe(12);
    expect(eine({ events: [{ eventTemplate: 5 }] }).eventVorlage).toBe(5);
  });

  it('auch der vor der Messung vermutete Name `eventTemplateId` (Zahl oder Text), 0 bleibt 0', () => {
    expect(eine({ events: [{ eventTemplateId: 4 }] }).eventVorlage).toBe(4);
    expect(eine({ events: [{ eventTemplateId: '6' }] }).eventVorlage).toBe(6);
    expect(eine({ events: [{ eventTemplateId: 0 }] }).eventVorlage).toBe(0);
  });

  it('unbekanntes Format wird ignoriert – kein Fehler', () => {
    for (const events of [
      undefined,
      null,
      [],
      {},
      'x',
      [{ foo: 1 }],
      [{ eventTemplateId: 'abc' }],
      [{ eventTemplate: '' }],
      [{ eventTemplate: '-1' }],
      [3],
    ])
      expect(eine({ events }).eventVorlage).toBeNull();
  });

  it('Anwenden setzt die Vorlage in alle Zeilen der neuen Reihe (auch 0); ohne Events bleiben die Zeilen leer', () => {
    const start = { ...wochen(), events: { '2027-02-02': 9 } };
    expect(vorlageAnwenden(start, eine({ events: [{ eventTemplate: '0' }] })).events).toEqual({
      '2027-02-02': 0,
      '2027-02-09': 0,
      '2027-02-16': 0,
    });
    expect(vorlageAnwenden(start, eine()).events).toEqual({});
  });
});

describe('eventHinweis / hinweiseZusammen', () => {
  it('alles da: kein Hinweis', () => {
    expect(eventHinweis({ fehlend: [], unklar: false })).toBeNull();
  });

  it('fehlt eines oder mehrere: nennt die Termine und sagt „in ChurchTools anlegen“', () => {
    expect(eventHinweis({ fehlend: ['2027-02-09'], unklar: false })).toMatch(
      /am 09\.02\.2027 wurde kein Event angelegt – bitte in ChurchTools anlegen/,
    );
    expect(eventHinweis({ fehlend: ['2027-02-09', '2027-02-16'], unklar: false })).toMatch(
      /09\.02\.2027, 16\.02\.2027 – bitte in ChurchTools anlegen/,
    );
  });

  it('unklar ist nicht „fehlt“: eigene Meldung ohne Termine', () => {
    const h = eventHinweis({ fehlend: ['2027-02-09'], unklar: true });
    expect(h).toMatch(/nicht nachlesen/);
    expect(h).not.toMatch(/wurde kein Event/);
  });

  it('mehrere Hinweise werden eine Meldung – ohne die leeren', () => {
    expect(hinweiseZusammen([null, null])).toBeNull();
    expect(hinweiseZusammen(['A.', null, 'B.'])).toBe('A. B.');
  });
});
