import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Unklar } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';
import {
  kalenderTermineAmTag,
  terminAnlegen,
  terminRumpf,
  UNKLAR,
  UNKLAR_OHNE_EINLADUNG,
  type TerminAnlegenFrage,
} from './terminAnlegen';

/** Der gemeinsame Kern „Termin anlegen“ (Sitzung festlegen UND Reiter „Termine“, W14) gegen die nachgestellte Instanz. */
let ct: Nachbau;
const ZONE = 'Europe/Berlin';
const MIT_UHR: TerminAnlegenFrage = {
  kalender: 4,
  titel: 'Heiligabend',
  beginn: '2027-12-24T15:00:00Z',
  ende: '2027-12-24T16:00:00Z',
  zeitzone: ZONE,
};
const GANZTAEGIG: TerminAnlegenFrage = {
  kalender: 4,
  titel: 'Bibel-Action-Tag',
  beginn: '2027-04-24',
  ende: '2027-04-24',
  zeitzone: ZONE,
  ganztaegig: true,
};

beforeEach(() => {
  ct = nachbauStarten();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('terminRumpf', () => {
  it('ohne Einladung: kein `meetingrequests` – ChurchTools verschickt nichts', () => {
    expect(terminRumpf(MIT_UHR)).toEqual({
      calendarId: 4,
      title: 'Heiligabend',
      startDate: '2027-12-24T15:00:00Z',
      endDate: '2027-12-24T16:00:00Z',
      isInternal: false,
    });
  });

  it('mit Einladung (Sitzung): je Person eine Anfrage – auch eine leere Liste bleibt, wie sie war', () => {
    expect(terminRumpf({ ...MIT_UHR, eingeladen: [1, 19] }).meetingrequests).toEqual([
      { inviteeId: 1 },
      { inviteeId: 19 },
    ]);
    expect(terminRumpf({ ...MIT_UHR, eingeladen: [] }).meetingrequests).toEqual([]);
  });

  it('ganztägig: Beginn und Ende sind nur der Tag, dazu `allDay` (wie ChurchTools ganztägige Termine liefert)', () => {
    const r = terminRumpf(GANZTAEGIG);
    expect([r.startDate, r.endDate]).toEqual(['2027-04-24', '2027-04-24']);
    expect(r.allDay).toBe(true);
    expect(terminRumpf(MIT_UHR)).not.toHaveProperty('allDay');
  });

  it('Ort nur, wenn einer da ist – als `address.meetingAt`, ohne Leerzeichen am Rand', () => {
    expect(terminRumpf({ ...MIT_UHR, ort: ' Gemeindehaus ' }).address).toEqual({
      meetingAt: 'Gemeindehaus',
    });
    expect(terminRumpf({ ...MIT_UHR, ort: '  ' })).not.toHaveProperty('address');
    expect(terminRumpf(MIT_UHR)).not.toHaveProperty('address');
  });
});

describe('terminAnlegen', () => {
  it('legt an: ohne Einladung, ganztägig mit dem Tag – genau ein Termin', async () => {
    const id = await terminAnlegen(GANZTAEGIG);
    expect(ct.termine).toEqual([
      expect.objectContaining({
        kalender: 4,
        id,
        titel: 'Bibel-Action-Tag',
        beginn: '2027-04-24',
        ende: '2027-04-24',
        anfragen: [],
      }),
    ]);
  });

  it('ChurchTools lehnt ab (kein Recht): Fehler mit Text, nichts angelegt, kein Nachsehen', async () => {
    ct.terminFehler = { status: 403, angelegt: false, ctVerbot: true };
    await expect(terminAnlegen(MIT_UHR)).rejects.toThrow(/keine Termine anlegen/);
    expect(ct.termine).toEqual([]);
    expect(ct.terminAnfrage).toBeNull();
  });

  it('ChurchTools lehnt ab (422): Fehler, kein Nachsehen – ein zweiter Versuch ist erlaubt', async () => {
    ct.terminFehler = { status: 422, angelegt: false };
    const e: unknown = await terminAnlegen(MIT_UHR).catch((x: unknown) => x);
    expect(e).not.toBeInstanceOf(Unklar);
    expect(ct.terminAnfrage).toBeNull();
  });

  it.each([
    ['mit Uhrzeit', MIT_UHR],
    ['ganztägig', GANZTAEGIG],
  ])(
    'unklare Antwort (504), aber angelegt – %s: wird gefunden, kein zweiter Termin',
    async (_, q) => {
      ct.terminFehler = { status: 504, angelegt: true };
      const id = await terminAnlegen(q);
      expect(ct.termine).toHaveLength(1);
      expect(id).toBe(ct.termine[0].id);
    },
  );

  it('ein 403 ohne ChurchTools-Rumpf (Proxy) ist unklar, nicht abgelehnt', async () => {
    ct.terminFehler = { status: 403, angelegt: true };
    expect(await terminAnlegen(MIT_UHR)).toBe(ct.termine[0].id);
  });

  it('ganztägig wird am Tag gefunden – auch wenn ChurchTools den Beginn mit einer Uhrzeit liefert', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    ct.termine.push({
      kalender: 4,
      id: 900,
      titel: 'Bibel-Action-Tag',
      beginn: '2027-04-24T05:00:00Z',
      anfragen: [],
    });
    expect(await terminAnlegen(GANZTAEGIG)).toBe(900);
  });

  it('ein anderer Termin gleichen Titels an anderer Zeit zählt beim Finden nicht', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    ct.termine.push({
      kalender: 4,
      id: 900,
      titel: 'Heiligabend',
      beginn: '2027-12-24T09:00:00Z',
      anfragen: [],
    });
    await expect(terminAnlegen(MIT_UHR)).rejects.toBeInstanceOf(Unklar);
  });

  it('unklar und nicht da: „bitte nachsehen“ mit der Meldung ohne Einladung, nie „noch einmal versuchen“', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    const e: unknown = await terminAnlegen({ ...MIT_UHR, unklar: UNKLAR_OHNE_EINLADUNG }).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(Unklar);
    expect(fehlerMeldung(e)).toEqual({ text: UNKLAR_OHNE_EINLADUNG, nochmal: false });
  });

  it('ohne eigene Meldung gilt die der Sitzung (Einladung doppelt)', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    expect(fehlerMeldung(await terminAnlegen(MIT_UHR).catch((x: unknown) => x)).text).toBe(UNKLAR);
  });

  it('unklar, und das Nachsehen scheitert auch: weiter unklar – nicht „abgelehnt“, nicht „nichts angelegt“', async () => {
    ct.terminFehler = { status: 504, angelegt: true };
    ct.fehlerBei = { methode: 'GET', status: 500 };
    expect(await terminAnlegen(MIT_UHR).catch((x: unknown) => x)).toBeInstanceOf(Unklar);
  });
});

describe('kalenderTermineAmTag', () => {
  it('liefert Nummer, Titel und Beginn der Termine genau dieses Tages im Kalender', async () => {
    ct.termine.push(
      {
        kalender: 4,
        id: 1,
        titel: 'Familiengottesdienst',
        beginn: '2027-12-24T09:00:00Z',
        anfragen: [],
      },
      { kalender: 4, id: 2, titel: 'Ganztags', beginn: '2027-12-24', anfragen: [] },
      { kalender: 4, id: 3, titel: 'Anderer Tag', beginn: '2027-12-25T09:00:00Z', anfragen: [] },
      {
        kalender: 9,
        id: 4,
        titel: 'Anderer Kalender',
        beginn: '2027-12-24T09:00:00Z',
        anfragen: [],
      },
    );
    expect(await kalenderTermineAmTag(4, '2027-12-24')).toEqual([
      { id: 1, titel: 'Familiengottesdienst', beginn: '2027-12-24T09:00:00Z' },
      { id: 2, titel: 'Ganztags', beginn: '2027-12-24' },
    ]);
  });

  it('ein Fehler wird geworfen – vorübergehend ist nicht „nichts da“', async () => {
    ct.fehlerBei = { methode: 'GET', status: 500 };
    await expect(kalenderTermineAmTag(4, '2027-12-24')).rejects.toThrow();
  });
});
