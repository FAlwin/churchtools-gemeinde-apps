import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eintragVorbelegung, type Eintrag } from '@shared/protokolle/termine';
import { eintragAdresse, eintragZusatz } from '@shared/protokolle/terminFelder';
import { artWechseln, WIEDERHOLUNG } from '@shared/protokolle/terminWiederholung';
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

  it('Ort nur, wenn einer da ist – als `address.name` (nicht das veraltete `meetingAt`), ohne Leerzeichen am Rand', () => {
    const r = terminRumpf({
      ...MIT_UHR,
      adresse: eintragAdresse({ ...eintrag(), ort: ' Gemeindehaus ' }) ?? undefined,
    });
    expect(r.address).toEqual({ name: 'Gemeindehaus' });
    expect(JSON.stringify(r)).not.toContain('meetingAt');
    expect(terminRumpf(MIT_UHR)).not.toHaveProperty('address');
    expect(eintragAdresse({ ...eintrag(), ort: '  ' })).toBeNull();
  });
});

/** Der Rumpf aus dem Fenster: `Eintrag` → `eintragZusatz` → `terminRumpf` – die Erzeuger, nicht handgeschriebene Rümpfe. */
const eintrag = (extra: Partial<Eintrag> = {}): Eintrag => ({
  ...eintragVorbelegung({ text: 'Heiligabend, 16 Uhr', datum: '2027-12-24' }, 4),
  ...extra,
});
const rumpf = (e: Eintrag, neueTags = false) =>
  terminRumpf({ ...MIT_UHR, ...eintragZusatz(e, neueTags) });

describe('terminRumpf aus dem Fenster (W15-1)', () => {
  it('ein schlichter Eintrag: nur Grundfelder, `isInternal: false` und `informOwner: true` (CT hakt vor)', () => {
    expect(rumpf(eintrag())).toEqual({
      calendarId: 4,
      title: 'Heiligabend',
      startDate: '2027-12-24T15:00:00Z',
      endDate: '2027-12-24T16:00:00Z',
      isInternal: false,
      informOwner: true,
    });
  });

  it('Untertitel, Beschreibung, Link, intern – ohne Leerzeichen am Rand; Leeres fehlt', () => {
    const r = rumpf(
      eintrag({
        untertitel: ' Familie ',
        beschreibung: 'Mit Krippenspiel\n',
        link: ' https://x.de ',
        intern: true,
      }),
    );
    expect(r).toMatchObject({
      subtitle: 'Familie',
      description: 'Mit Krippenspiel',
      link: 'https://x.de',
      isInternal: true,
    });
    const leer = rumpf(eintrag({ untertitel: ' ', beschreibung: '', link: '' }));
    for (const k of ['subtitle', 'description', 'link']) expect(leer).not.toHaveProperty(k);
  });

  it('„Ersteller informieren“ aus: `informOwner: false`', () => {
    expect(rumpf(eintrag({ informieren: false })).informOwner).toBe(false);
  });

  it('Ort: alle Felder der Adresse, Zusatz als `addition`', () => {
    const r = rumpf(
      eintrag({
        ort: 'Saal',
        ortStrasse: 'Hauptstr. 1',
        ortPlz: '53797',
        ortStadt: 'Lohmar',
        ortZusatz: 'EG',
      }),
    );
    expect(r.address).toEqual({
      name: 'Saal',
      street: 'Hauptstr. 1',
      zip: '53797',
      city: 'Lohmar',
      addition: 'EG',
    });
    expect(rumpf(eintrag({ ortPlz: '53797' })).address).toEqual({ zip: '53797' });
  });

  it('Im Auftrag von: `onBehalfOfPid`', () => {
    expect(rumpf(eintrag({ imAuftrag: 19 })).onBehalfOfPid).toBe(19);
    expect(rumpf(eintrag())).not.toHaveProperty('onBehalfOfPid');
  });

  it('mehrtägig: Beginn und Ende in UTC bzw. als Tage', () => {
    const mehr = terminRumpf({
      ...GANZTAEGIG,
      ende: '2027-04-26',
      ...eintragZusatz(eintrag(), false),
    });
    expect([mehr.startDate, mehr.endDate, mehr.allDay]).toEqual(['2027-04-24', '2027-04-26', true]);
  });

  describe('Wiederholung', () => {
    const wo = (art: number, extra: Partial<Eintrag> = {}) =>
      rumpf({ ...artWechseln(eintrag(), art), ...extra });

    it('keine: kein einziges Wiederholungsfeld, auch keine Weiteren Termine und Ausnahmen', () => {
      const r = rumpf(eintrag({ weitere: ['2027-12-30'], ausnahmen: ['2027-12-31'] }));
      for (const k of [
        'repeatId',
        'repeatFrequency',
        'repeatOption',
        'repeatUntil',
        'additionals',
        'exceptions',
      ])
        expect(r).not.toHaveProperty(k);
    });

    it.each([
      [WIEDERHOLUNG.taeglich],
      [WIEDERHOLUNG.woechentlich],
      [WIEDERHOLUNG.monatlichDatum],
      [WIEDERHOLUNG.jaehrlich],
    ])('automatisch (repeatId %s): Art, „Alle x“ und „Bis“ – kein repeatOption', (art) => {
      const r = wo(art, { frequenz: 2 });
      expect(r).toMatchObject({
        repeatId: art,
        repeatFrequency: 2,
        repeatUntil: artWechseln(eintrag(), art).wiederBis,
      });
      expect(r).not.toHaveProperty('repeatOption');
    });

    it('monatlich nach Wochentag: `repeatOption` aus dem Datum – 24.12.2027 ist der 4. Freitag', () => {
      expect(wo(WIEDERHOLUNG.monatlichWochentag)).toMatchObject({ repeatId: 32, repeatOption: 4 });
    });

    it('monatlich nach Wochentag: der 5. nur, wenn das Datum der 5. ist (31.12.2027, Freitag); 6 = letzter', () => {
      const fuenfter = rumpf(
        artWechseln(
          eintragVorbelegung({ text: 'Silvester, 20 Uhr', datum: '2027-12-31' }, 4),
          WIEDERHOLUNG.monatlichWochentag,
        ),
      );
      expect(fuenfter.repeatOption).toBe(5);
      expect(wo(WIEDERHOLUNG.monatlichWochentag, { option: 6 }).repeatOption).toBe(6);
    });

    it('manuell: repeatId 999, kein „Bis“, kein „Alle x“ – nur Weitere Termine und Ausnahmen', () => {
      const r = wo(WIEDERHOLUNG.manuell, { weitere: ['2027-12-30'], ausnahmen: ['2027-12-31'] });
      expect(r).toMatchObject({
        repeatId: 999,
        additionals: [{ date: '2027-12-30', isRepeated: false }],
        exceptions: [{ date: '2027-12-31' }],
      });
      for (const k of ['repeatUntil', 'repeatFrequency', 'repeatOption'])
        expect(r).not.toHaveProperty(k);
    });

    it('Weitere Termine und Ausnahmen bei einer automatischen Art', () => {
      const r = wo(WIEDERHOLUNG.woechentlich, {
        weitere: ['2028-02-01', '2028-02-08'],
        ausnahmen: ['2028-01-07'],
      });
      expect(r.additionals).toEqual([
        { date: '2028-02-01', isRepeated: false },
        { date: '2028-02-08', isRepeated: false },
      ]);
      expect(r.exceptions).toEqual([{ date: '2028-01-07' }]);
    });
  });

  describe('Tags', () => {
    it('Nummern gehen immer mit', () => {
      expect(rumpf(eintrag({ tags: [3, 5] })).tags).toEqual([3, 5]);
    });

    it('neue Tags (Texte) nur mit „Tags verwalten“ – sonst bleiben nur die Nummern', () => {
      const e = eintrag({ tags: [3, 'Neu', '  '] });
      expect(rumpf(e, true).tags).toEqual([3, 'Neu']);
      expect(rumpf(e, false).tags).toEqual([3]);
      expect(rumpf(eintrag({ tags: ['Neu'] }), false)).not.toHaveProperty('tags');
    });
  });

  describe('Ressourcen (W15-2)', () => {
    const saal = { ressource: 1, vorlauf: 30, nachlauf: 15, status: 1 as const, menge: 1 };
    const stuehle = { ressource: 5, vorlauf: 0, nachlauf: 0, status: 2 as const, menge: 40 };

    it('ohne Buchungen kein `bookings`', () => {
      expect(rumpf(eintrag())).not.toHaveProperty('bookings');
    });

    it('je Buchung Ressource, Vorlauf, Nachlauf, Status; `quantity` nur bei mehr als einem Stück', () => {
      expect(rumpf(eintrag({ buchungen: [saal, stuehle] })).bookings).toEqual([
        { resourceId: 1, leadTimeMinutes: 30, afterwardMinutes: 15, statusId: 1 },
        { resourceId: 5, leadTimeMinutes: 0, afterwardMinutes: 0, statusId: 2, quantity: 40 },
      ]);
    });

    it('die Vorgabe oben (Vorlauf/Nachlauf) geht nicht selbst mit – nur die Buchungen', () => {
      const r = rumpf(eintrag({ vorlauf: 99, nachlauf: 88 }));
      expect(JSON.stringify(r)).not.toMatch(/99|88/);
    });
  });

  describe('Events (W15-3)', () => {
    const rumpfMit = (events: { startDate: string; eventTemplateId: number }[] | undefined) =>
      terminRumpf({ ...MIT_UHR, ...eintragZusatz(eintrag(), false), events });

    it('ohne Events (oder eine leere Liste) kein `events`', () => {
      expect(rumpfMit(undefined)).not.toHaveProperty('events');
      expect(rumpfMit([])).not.toHaveProperty('events');
      expect(rumpf(eintrag())).not.toHaveProperty('events');
    });

    it('je Zeile `startDate` und `eventTemplateId` – die Nummer 0 („Standard“) geht mit, sie ist nicht „leer“', () => {
      expect(
        rumpfMit([
          { startDate: '2027-12-24T15:00:00Z', eventTemplateId: 0 },
          { startDate: '2027-12-31T15:00:00Z', eventTemplateId: 7 },
        ]).events,
      ).toEqual([
        { startDate: '2027-12-24T15:00:00Z', eventTemplateId: 0 },
        { startDate: '2027-12-31T15:00:00Z', eventTemplateId: 7 },
      ]);
    });

    it('der Rest der Zeile (Tag) geht nicht zu ChurchTools', () => {
      const r = rumpfMit([
        { startDate: '2027-12-24T15:00:00Z', eventTemplateId: 1, tag: '2027-12-24' } as never,
      ]);
      expect(JSON.stringify(r.events)).not.toMatch(/tag/);
    });
  });

  it('keine `meetingrequests`, solange kein `eingeladen` mitgegeben wird (Besprechungsanfragen kommen aus dem Reiter, W15-4)', () => {
    expect(rumpf(eintrag())).not.toHaveProperty('meetingrequests');
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
