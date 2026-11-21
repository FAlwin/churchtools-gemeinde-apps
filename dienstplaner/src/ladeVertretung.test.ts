import { describe, expect, it } from 'vitest';
import type { PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import type { GruppenStand } from '@shared/dienstplan/personenDaten';
import type { RohTermin } from '@shared/dienstplan/termine';
import { ApiError } from '@ui/ct/fehler';
import { lageAus } from './ladeVertretung';

const TAG = '2026-12-13';
const person = (id: number, name: string) => ({ id, name, bild: null, initialen: '' });
const BEN = person(47, 'Ben Test');
const FINN = person(48, 'Finn Test');
const CLARA = person(49, 'Clara Test');
const ALWIN = person(1, 'Alwin Friesen');

const antworten = (je: [number, 'ja' | 'vielleicht'][], sichtbar = true): PersonenAntworten => ({
  jePerson: new Map(je.map(([p, a]) => [p, { '246': { a, tag: TAG } }])),
  sichtbar: sichtbar ? new Set([4]) : new Set(),
});

const termin = (id: number, plaetze: RohTermin['eventServices'] = []): RohTermin => ({
  id,
  name: 'Gottesdienst',
  startDate: `${TAG}T08:00:00Z`,
  endDate: `${TAG}T09:30:00Z`,
  eventServices: plaetze,
});

const stand = (o: Partial<Extract<GruppenStand, { art: 'da' }>> = {}): GruppenStand => ({
  art: 'da',
  mitglieder: [person(46, 'Anna Test'), BEN, FINN, CLARA, ALWIN],
  abwesenheiten: [],
  leitung: [ALWIN.id],
  ...o,
});

const basis = (
  extra: Partial<Parameters<typeof lageAus>[0]> = {},
): Parameters<typeof lageAus>[0] => ({
  eventId: 246,
  tag: TAG,
  serviceId: 9,
  dienst: { gruppenIds: [9], dienstgruppeId: 4 },
  dienstName: () => 'Gesang',
  ichId: 46,
  daten: new Map([[9, stand()]]),
  antworten: antworten([
    [47, 'ja'],
    [49, 'vielleicht'],
  ]),
  tagesTermine: [termin(246)],
  teamName: 'Lobpreisteam',
  ...extra,
});

describe('lageAus – die Lage für das Fenster „Vertretung suchen“', () => {
  it('Team aus den Mitgliedern der Gruppen am Dienst, Antworten zu diesem Termin, Leitung ohne mich', () => {
    const lage = lageAus(basis());
    expect(lage).toMatchObject({
      art: 'da',
      teamName: 'Lobpreisteam',
      abwesenheitenUnbekannt: false,
    });
    if (lage.art !== 'da' || lage.vorschlaege.art !== 'liste') throw new Error('Liste erwartet');
    expect(lage.vorschlaege.ja.map((v) => v.name)).toEqual(['Ben Test']);
    expect(lage.vorschlaege.vielleicht.map((v) => v.name)).toEqual(['Clara Test']);
    // Anna (ich) fehlt, Alwin (Leitung, keine Antwort) und Finn stehen ohne Antwort da.
    expect(lage.vorschlaege.ohne.map((v) => v.name)).toEqual(['Alwin Friesen', 'Finn Test']);
    expect(lage.leitung.map((p) => p.name)).toEqual(['Alwin Friesen']);
  });

  it('wer an dem Tag – auch an einem ANDEREN Termin – schon eingeteilt ist, fehlt', () => {
    const lage = lageAus(
      basis({
        tagesTermine: [
          termin(246),
          termin(300, [{ serviceId: 6, personId: 47, name: 'Ben Test', isAccepted: false }]),
        ],
      }),
    );
    if (lage.art !== 'da' || lage.vorschlaege.art !== 'liste') throw new Error('Liste erwartet');
    expect(lage.vorschlaege.ja).toEqual([]); // Ben ist am Tag in Ton
  });

  it('abwesend am Termin (decktTermin) = Nein: fehlt; Abwesenheiten nicht sichtbar: Hinweis, nichts behauptet', () => {
    const abw = {
      id: 1,
      personId: 47,
      grund: 'Urlaub',
      startDate: TAG,
      endDate: TAG,
      startTime: null,
      endTime: null,
    };
    const mit = lageAus(basis({ daten: new Map([[9, stand({ abwesenheiten: [abw] })]]) }));
    if (mit.art !== 'da' || mit.vorschlaege.art !== 'liste') throw new Error('Liste erwartet');
    expect(mit.vorschlaege.ja).toEqual([]);
    expect(mit.abwesenheitenUnbekannt).toBe(false);
    const unbekannt = lageAus(
      basis({ daten: new Map([[9, stand({ abwesenheiten: 'nichtSichtbar' })]]) }),
    );
    expect(unbekannt).toMatchObject({ art: 'da', abwesenheitenUnbekannt: true });
    if (unbekannt.art !== 'da' || unbekannt.vorschlaege.art !== 'liste') throw new Error('Liste');
    expect(unbekannt.vorschlaege.ja.map((v) => v.name)).toEqual(['Ben Test']);
  });

  it('Antworten der Dienstgruppe nicht lesbar: nur das Team', () => {
    const lage = lageAus(basis({ antworten: antworten([[47, 'ja']], false) }));
    expect(lage).toMatchObject({ art: 'da', vorschlaege: { art: 'ohneAntworten' } });
  });

  it('Mitglieder nicht zu sehen (403) oder keine: „keineMitglieder“ – niemand zum Fragen, nichts erfunden', () => {
    expect(lageAus(basis({ daten: new Map([[9, stand({ mitglieder: 'verborgen' })]]) }))).toEqual({
      art: 'keineMitglieder',
    });
    expect(lageAus(basis({ daten: new Map([[9, stand({ mitglieder: [] })]]) }))).toEqual({
      art: 'keineMitglieder',
    });
  });

  it('mehrere Gruppen am Dienst: ihre Mitglieder zusammen, jede Person einmal', () => {
    const lage = lageAus(
      basis({
        dienst: { gruppenIds: [9, 10], dienstgruppeId: 4 },
        daten: new Map([
          [9, stand()],
          [10, stand({ mitglieder: [BEN, person(60, 'Greta Test')], leitung: [] })],
        ]),
      }),
    );
    if (lage.art !== 'da' || lage.vorschlaege.art !== 'liste') throw new Error('Liste erwartet');
    const alle = [...lage.vorschlaege.ja, ...lage.vorschlaege.vielleicht, ...lage.vorschlaege.ohne];
    expect(alle.map((v) => v.name).sort()).toEqual([
      'Alwin Friesen',
      'Ben Test',
      'Clara Test',
      'Finn Test',
      'Greta Test',
    ]);
  });

  it('der Termin fehlt in den Terminen des Tages: Fehler (502), nicht „niemand eingeteilt“', () => {
    expect(() => lageAus(basis({ tagesTermine: [termin(1)] }))).toThrow(ApiError);
  });
});
