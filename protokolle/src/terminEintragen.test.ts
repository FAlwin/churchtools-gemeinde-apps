import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eintragVorbelegung, type Eintrag } from '@shared/protokolle/termine';
import { artWechseln, WIEDERHOLUNG } from '@shared/protokolle/terminWiederholung';
import { _vergissGemeindeZeitzone, merkeGemeindeZeitzone } from '@shared/ct/zeit';
import { Unklar } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';
import { NICHT_NACHGELESEN, terminLegen } from './terminEintragen';

/** „Termin eintragen“ (W14), Schritt 1 – in ChurchTools – gegen die nachgestellte Instanz. */
let ct: Nachbau;
const ZONE = 'Europe/Berlin';
const MIT_UHR = {
  ...eintragVorbelegung({ text: 'Heiligabend, 16 Uhr', datum: '2027-12-24' }, 4),
  kalender: 4,
};
const GANZTAEGIG = {
  ...eintragVorbelegung({ text: 'Bibel-Action-Tag', datum: '2027-04-24' }, 4),
  kalender: 4,
};
const posts = () => ct.aufrufe.filter((a) => a.startsWith('POST') && a.includes('/appointments'));

beforeEach(() => {
  ct = nachbauStarten();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('terminLegen', () => {
  it('legt den Termin an und liest ihn nach – ohne Einladung, Zeit in UTC aus der Ortszeit', async () => {
    const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE });
    expect(r).toEqual({ art: 'angelegt', id: ct.termine[0].id });
    expect(ct.termine).toEqual([
      expect.objectContaining({
        kalender: 4,
        titel: 'Heiligabend',
        beginn: '2027-12-24T15:00:00Z',
        ende: '2027-12-24T16:00:00Z',
        anfragen: [],
      }),
    ]);
    expect(ct.mails).toEqual([]);
  });

  it('ganztägig: der Tag, nachgelesen als Tag', async () => {
    const r = await terminLegen({ eintrag: GANZTAEGIG, zeitzone: ZONE });
    expect(r.art).toBe('angelegt');
    expect(ct.termine[0]).toMatchObject({ beginn: '2027-04-24', ende: '2027-04-24' });
  });

  it('der Titel wird ohne Leerzeichen am Rand angelegt – und so auch nachgelesen', async () => {
    await terminLegen({ eintrag: { ...MIT_UHR, titel: '  Heiligabend ' }, zeitzone: ZONE });
    expect(ct.termine[0].titel).toBe('Heiligabend');
  });

  it('„Nur verknüpfen“: nichts wird angelegt, die Nummer des vorhandenen Termins kommt zurück', async () => {
    const r = await terminLegen({
      eintrag: MIT_UHR,
      zeitzone: ZONE,
      verknuepfen: {
        id: 161,
        titel: 'Heiligabend – Familiengottesdienst',
        beginn: '2027-12-24T09:00:00Z',
      },
    });
    expect(r).toEqual({ art: 'verknuepft', id: 161 });
    expect(posts()).toEqual([]);
    expect(ct.termine).toEqual([]);
  });

  describe('Bild', () => {
    const BILD = () => new File(['x'], 'plakat.png', { type: 'image/png' });
    const bildPosts = () =>
      ct.aufrufe.filter((a) => a.startsWith('POST /files/appointment_image/'));

    it('nach dem Anlegen hochgeladen (an die Nummer des Termins) und nachgelesen: nichts fehlt', async () => {
      const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, bild: BILD() });
      expect(r.bild).toEqual({ fehlt: false, unklar: false });
      expect(bildPosts()).toEqual([`POST /files/appointment_image/${r.id}`]);
      expect(ct.termine[0].bild?.name).toBe('plakat.png');
    });

    it('ohne Bild kein Upload und kein `bild` im Ergebnis', async () => {
      const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, bild: null });
      expect(r).not.toHaveProperty('bild');
      expect(bildPosts()).toEqual([]);
    });

    it('„Nur verknüpfen“: kein Upload', async () => {
      const r = await terminLegen({
        eintrag: MIT_UHR,
        zeitzone: ZONE,
        bild: BILD(),
        verknuepfen: { id: 161, titel: 'Heiligabend', beginn: '2027-12-24T15:00:00Z' },
      });
      expect(r).toEqual({ art: 'verknuepft', id: 161 });
      expect(bildPosts()).toEqual([]);
    });

    it('Upload scheitert (5xx), nichts gespeichert: `fehlt` – der Termin steht', async () => {
      ct.bildFehler = { status: 503, angelegt: false };
      const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, bild: BILD() });
      expect(r.bild).toEqual({ fehlt: true, unklar: false });
      expect(ct.termine).toHaveLength(1);
    });

    it('Upload sagt 200 und speichert nichts: `fehlt` (ein 200 ist kein Beleg)', async () => {
      ct.bildSchlucken = true;
      const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, bild: BILD() });
      expect(r.bild).toEqual({ fehlt: true, unklar: false });
      expect(bildPosts()).toHaveLength(1);
    });

    it('Upload meldet 5xx, hat aber gespeichert: das Nachlesen belegt es', async () => {
      ct.bildFehler = { status: 504, angelegt: true };
      const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, bild: BILD() });
      expect(r.bild).toEqual({ fehlt: false, unklar: false });
    });
  });

  it('kein Recht: Fehler mit Text, nichts angelegt', async () => {
    ct.terminFehler = { status: 403, angelegt: false, ctVerbot: true };
    await expect(terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE })).rejects.toThrow(
      /keine Termine anlegen/,
    );
    expect(ct.termine).toEqual([]);
  });

  it('unklare Antwort, aber angelegt: gefunden und nachgelesen – genau ein Termin', async () => {
    ct.terminFehler = { status: 504, angelegt: true };
    const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE });
    expect(r.id).toBe(ct.termine[0].id);
    expect(ct.termine).toHaveLength(1);
  });

  it('unklar und nicht da: „bitte nachsehen“ ohne Wort von Einladungen – es wird nichts als eingetragen gemeldet', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    const e: unknown = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE }).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(Unklar);
    expect(fehlerMeldung(e).nochmal).toBe(false);
    expect(fehlerMeldung(e).text).not.toMatch(/Einladung/);
  });

  it('angelegt, aber nicht nachzulesen: Unklar mit „nicht noch einmal eintragen“ – der Termin steht trotzdem', async () => {
    ct.terminLesenFehler = true;
    const e: unknown = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE }).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(Unklar);
    expect(fehlerMeldung(e)).toEqual({ text: NICHT_NACHGELESEN, nochmal: false });
    expect(ct.termine).toHaveLength(1);
  });

  it('ChurchTools hat den Termin anders übernommen als geschickt (Zeit): nicht als gelungen gemeldet', async () => {
    // Das Nachlesen zeigt eine andere Startzeit – ein 201 ist kein Beleg.
    ct.terminFehler = null;
    const echtesFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (...a: Parameters<typeof fetch>) => {
      const r = await echtesFetch(...a);
      const url = String(a[0] instanceof Request ? a[0].url : a[0]);
      if (/\/appointments\/\d+$/.test(url) && (a[1]?.method ?? 'GET') === 'GET') {
        const j = (await r.json()) as { data: { appointment: { startDate: string } } };
        j.data.appointment.startDate = '2027-12-24T08:00:00Z';
        return new Response(JSON.stringify(j), { status: 200 });
      }
      return r;
    });
    await expect(terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE })).rejects.toBeInstanceOf(Unklar);
  });
});

describe('terminLegen mit den Feldern des Reiters „Kalender“ (W15-1)', () => {
  it('der volle Eintrag geht als ein Rumpf an ChurchTools – Zeit in UTC, mehrtägig, Wiederholung, Ort, Tags', async () => {
    const e = {
      ...artWechseln(MIT_UHR, WIEDERHOLUNG.woechentlich),
      untertitel: 'Familie',
      beschreibung: 'Mit Krippenspiel',
      link: 'https://ecg-donrath.de',
      intern: true,
      ort: 'Saal',
      ortStadt: 'Lohmar',
      tags: [3, 'Neu'],
      weitere: ['2028-01-02'],
      ausnahmen: ['2028-01-07'],
      informieren: false,
    };
    await terminLegen({ eintrag: e, zeitzone: ZONE, neueTagsErlaubt: true });
    expect(ct.terminRumpf).toEqual({
      calendarId: 4,
      title: 'Heiligabend',
      startDate: '2027-12-24T15:00:00Z',
      endDate: '2027-12-24T16:00:00Z',
      isInternal: true,
      subtitle: 'Familie',
      description: 'Mit Krippenspiel',
      link: 'https://ecg-donrath.de',
      address: { name: 'Saal', city: 'Lohmar' },
      repeatId: 7,
      repeatFrequency: 1,
      repeatUntil: e.wiederBis,
      additionals: [{ date: '2028-01-02', isRepeated: false }],
      exceptions: [{ date: '2028-01-07' }],
      tags: [3, 'Neu'],
      informOwner: false,
    });
  });

  it('ohne „Tags verwalten“ fällt ein neuer Tag weg – sonst lehnte ChurchTools das ganze Anlegen ab', async () => {
    await terminLegen({ eintrag: { ...MIT_UHR, tags: [3, 'Neu'] }, zeitzone: ZONE });
    expect(ct.terminRumpf?.tags).toEqual([3]);
  });

  it('mehrtägig und ganztägig: Beginn- und Endtag, `allDay`', async () => {
    await terminLegen({
      eintrag: { ...GANZTAEGIG, endTag: '2027-04-26' },
      zeitzone: ZONE,
    });
    expect(ct.terminRumpf).toMatchObject({
      startDate: '2027-04-24',
      endDate: '2027-04-26',
      allDay: true,
    });
  });

  it('mehrtägig mit Uhrzeit: Ende am Endtag', async () => {
    await terminLegen({
      eintrag: { ...MIT_UHR, von: '18:00', endTag: '2027-12-26', bis: '10:00' },
      zeitzone: ZONE,
    });
    expect(ct.terminRumpf).toMatchObject({
      startDate: '2027-12-24T17:00:00Z',
      endDate: '2027-12-26T09:00:00Z',
    });
  });
});

/** Events (W15-3): Ein `201` ist kein Beleg – die Events werden nachgelesen. */
describe('terminLegen mit Events', () => {
  const REIHE = {
    ...MIT_UHR,
    art: WIEDERHOLUNG.woechentlich,
    wiederBis: '2027-12-31',
  };
  const mitEvents = (events: Record<string, number>) => ({ ...REIHE, events });

  it('alle da: der Rumpf trägt je gewählter Zeile ein Event mit dem exakten UTC-Beginn (Winterzeit), das Nachlesen findet sie', async () => {
    const r = await terminLegen({
      eintrag: mitEvents({ '2027-12-24': 3, '2027-12-31': 0 }),
      zeitzone: ZONE,
    });
    expect(ct.terminRumpf?.events).toEqual([
      { startDate: '2027-12-24T15:00:00Z', eventTemplateId: 3 },
      { startDate: '2027-12-31T15:00:00Z', eventTemplateId: 0 },
    ]);
    expect(r.events).toEqual({ fehlend: [], unklar: false });
    expect(ct.events.map((x) => x.appointmentId)).toEqual([r.id, r.id]);
    expect(ct.eventsAnfrage).toBe('?from=2027-12-23&to=2028-01-01');
  });

  it('Sommerzeit: der Beginn jeder Zeile hat den Abstand ihres eigenen Tages', async () => {
    await terminLegen({
      eintrag: {
        ...REIHE,
        tag: '2027-03-23',
        wiederBis: '2027-04-06',
        events: { '2027-03-23': 1, '2027-03-30': 1 },
      },
      zeitzone: ZONE,
    });
    expect((ct.terminRumpf?.events as { startDate: string }[]).map((x) => x.startDate)).toEqual([
      '2027-03-23T15:00:00Z',
      '2027-03-30T14:00:00Z',
    ]);
  });

  it('ohne gewählte Zeile: kein `events` im Rumpf, kein Nachlesen, kein `events` im Ergebnis', async () => {
    const r = await terminLegen({ eintrag: mitEvents({}), zeitzone: ZONE });
    expect(ct.terminRumpf).not.toHaveProperty('events');
    expect(ct.eventsAnfrage).toBeNull();
    expect(r.events).toBeUndefined();
  });

  it('ChurchTools sagt 201 und legt ein Event nicht an: genau dieser Tag fehlt – der Termin steht', async () => {
    ct.eventsSchlucken.add('2027-12-31T15:00:00Z');
    const r = await terminLegen({
      eintrag: mitEvents({ '2027-12-24': 3, '2027-12-31': 3 }),
      zeitzone: ZONE,
    });
    expect(r.events).toEqual({ fehlend: ['2027-12-31'], unklar: false });
    expect(ct.termine).toHaveLength(1);
  });

  it('ein Event desselben Beginns an einem ANDEREN Termin zählt nicht', async () => {
    ct.events.push({
      id: 9001,
      appointmentId: 9999,
      startDate: '2027-12-24T15:00:00Z',
      eventTemplateId: 1,
    });
    ct.eventsSchlucken.add('2027-12-24T15:00:00Z');
    const r = await terminLegen({ eintrag: mitEvents({ '2027-12-24': 1 }), zeitzone: ZONE });
    expect(r.events).toEqual({ fehlend: ['2027-12-24'], unklar: false });
  });

  it('Nachlesen scheitert: „unklar“, nicht „fehlt“ – der Termin steht trotzdem, nichts wird geworfen', async () => {
    ct.eventsLesenFehler = true;
    const r = await terminLegen({ eintrag: mitEvents({ '2027-12-24': 3 }), zeitzone: ZONE });
    expect(r.events).toEqual({ fehlend: [], unklar: true });
    expect(r.art).toBe('angelegt');
    expect(ct.termine).toHaveLength(1);
  });

  it('Buchungen und Events zusammen: beides wird nachgelesen', async () => {
    const r = await terminLegen({
      eintrag: {
        ...mitEvents({ '2027-12-24': 3 }),
        buchungen: [{ ressource: 1, vorlauf: 0, nachlauf: 0, status: 1, menge: 1 }],
      },
      zeitzone: ZONE,
    });
    expect(r.buchungen).toEqual({ fehlend: [], unklar: false });
    expect(r.events).toEqual({ fehlend: [], unklar: false });
  });

  it('„Nur verknüpfen“: nichts wird angelegt, es gibt keine Events', async () => {
    const r = await terminLegen({
      eintrag: mitEvents({ '2027-12-24': 3 }),
      zeitzone: ZONE,
      verknuepfen: { id: 161, titel: 'Heiligabend', beginn: '2027-12-24T15:00:00Z' },
    });
    expect(r).toEqual({ art: 'verknuepft', id: 161 });
    expect(posts()).toEqual([]);
    expect(ct.events).toEqual([]);
  });

  it('ChurchTools lehnt das Anlegen ab (422): nichts wird nachgelesen, die Meldung geht weiter', async () => {
    ct.terminFehler = { status: 422, angelegt: false };
    await expect(
      terminLegen({ eintrag: mitEvents({ '2027-12-24': 3 }), zeitzone: ZONE }),
    ).rejects.toMatchObject({ status: 422 });
    expect(ct.eventsAnfrage).toBeNull();
  });
});

/** Ressourcen (W15-2): Ein `201` ist kein Beleg – die Buchungen werden nachgelesen. */
describe('terminLegen mit Buchungen', () => {
  const buchung = (ressource: number, extra = {}) => ({
    ressource,
    vorlauf: 30,
    nachlauf: 15,
    status: 1 as const,
    menge: 1,
    ...extra,
  });
  const mitBuchungen = (...b: ReturnType<typeof buchung>[]) => ({ ...MIT_UHR, buchungen: b });

  it('alle gebucht: der Rumpf trägt die Buchungen, das Nachlesen findet sie – nichts fehlt', async () => {
    const r = await terminLegen({ eintrag: mitBuchungen(buchung(1), buchung(5)), zeitzone: ZONE });
    expect(r.buchungen).toEqual({ fehlend: [], unklar: false });
    expect(ct.terminRumpf?.bookings).toHaveLength(2);
    expect(ct.buchungen.map((b) => b.resourceId)).toEqual([1, 5]);
    expect(ct.buchungen.every((b) => b.appointmentId === r.id)).toBe(true);
  });

  it('ohne Buchungen wird gar nicht erst in /bookings gelesen', async () => {
    const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE });
    expect(r.buchungen).toBeUndefined();
    expect(ct.aufrufe.some((a) => a.includes('/bookings'))).toBe(false);
  });

  it('ChurchTools sagt 201, bucht aber eine Ressource nicht: genau diese fehlt – der Termin bleibt', async () => {
    ct.buchungenSchlucken.add(5);
    const r = await terminLegen({ eintrag: mitBuchungen(buchung(1), buchung(5)), zeitzone: ZONE });
    expect(r.art).toBe('angelegt');
    expect(r.buchungen).toEqual({ fehlend: [5], unklar: false });
    expect(ct.termine).toHaveLength(1);
  });

  it('eine Buchung eines ANDEREN Termins zählt nicht', async () => {
    ct.buchungen.push({ resourceId: 1, appointmentId: 9999, statusId: 1, quantity: undefined });
    ct.buchungenSchlucken.add(1);
    const r = await terminLegen({ eintrag: mitBuchungen(buchung(1)), zeitzone: ZONE });
    expect(r.buchungen).toEqual({ fehlend: [1], unklar: false });
  });

  it('Nachlesen scheitert (500): unklar, NICHT „fehlt“ – und der Termin bleibt', async () => {
    ct.buchungenLesenFehler = true;
    const r = await terminLegen({ eintrag: mitBuchungen(buchung(1)), zeitzone: ZONE });
    expect(r.art).toBe('angelegt');
    expect(r.buchungen).toEqual({ fehlend: [], unklar: true });
    expect(ct.termine).toHaveLength(1);
  });

  it('liest mit einem Tag Luft zu beiden Seiten (Vorlauf/Nachlauf über Mitternacht)', async () => {
    await terminLegen({ eintrag: mitBuchungen(buchung(1)), zeitzone: ZONE });
    const gelesen = ct.buchungenAnfrage ?? '';
    expect(gelesen).toContain('resource_ids[]=1');
    expect(gelesen).toContain('from=2027-12-23');
    expect(gelesen).toContain('to=2027-12-25');
  });

  it('„Nur verknüpfen“ bucht nichts und liest nichts', async () => {
    const r = await terminLegen({
      eintrag: mitBuchungen(buchung(1)),
      zeitzone: ZONE,
      verknuepfen: { id: 161, titel: 'Heiligabend', beginn: '2027-12-24T09:00:00Z' },
    });
    expect(r).toEqual({ art: 'verknuepft', id: 161 });
    expect(ct.buchungen).toEqual([]);
    expect(ct.aufrufe.some((a) => a.includes('/bookings'))).toBe(false);
  });

  it('ChurchTools lehnt das Anlegen ab (4xx wegen einer Buchung): Fehler geht weiter, nichts angelegt, nichts gebucht', async () => {
    ct.terminFehler = { status: 403, angelegt: false, ctVerbot: true };
    await expect(
      terminLegen({ eintrag: mitBuchungen(buchung(1)), zeitzone: ZONE }),
    ).rejects.toThrow();
    expect(ct.termine).toEqual([]);
    expect(ct.buchungen).toEqual([]);
  });
});

describe('terminLegen mit Besprechungsanfragen (W15-4)', () => {
  it('Rumpf: `meetingrequests` aus `eingeladen` – genau diese Personen; Mails nur an die anderen (ich bekomme keine)', async () => {
    const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, eingeladen: [1, 19, 20] });
    expect(ct.terminRumpf?.meetingrequests).toEqual([
      { inviteeId: 1 },
      { inviteeId: 19 },
      { inviteeId: 20 },
    ]);
    expect(ct.mails).toEqual([
      { person: 19, art: 'neu' },
      { person: 20, art: 'neu' },
    ]);
    expect(r.anfragen).toEqual({ fehlend: [], unklar: false });
  });

  it('ohne `eingeladen` (oder leer): kein `meetingrequests`, keine Mail', async () => {
    await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE });
    expect(ct.terminRumpf).not.toHaveProperty('meetingrequests');
    await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, eingeladen: [] });
    expect(ct.terminRumpf).not.toHaveProperty('meetingrequests');
    expect(ct.mails).toEqual([]);
  });

  it('„Nur verknüpfen“: nichts wird angelegt, keine Mail – auch wenn Personen übergeben werden', async () => {
    const r = await terminLegen({
      eintrag: MIT_UHR,
      zeitzone: ZONE,
      eingeladen: [1, 19],
      verknuepfen: { id: 161, titel: 'Heiligabend', beginn: '2027-12-24T09:00:00Z' },
    });
    expect(r).toEqual({ art: 'verknuepft', id: 161 });
    expect(posts()).toEqual([]);
    expect(ct.mails).toEqual([]);
  });

  it('ChurchTools hat eine Person nicht eingeladen (201, aber keine Anfrage): sie steht in `anfragen.fehlend`, der Termin bleibt', async () => {
    ct.anfrageVerschluckt.add(19);
    const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, eingeladen: [1, 19, 20] });
    expect(r.anfragen).toEqual({ fehlend: [19], unklar: false });
    expect(ct.termine).toHaveLength(1);
  });

  it('Anfragen nicht lesbar: `unklar`, nicht „fehlt“ – der Termin bleibt', async () => {
    ct.anfragenLesenFehler = true;
    const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, eingeladen: [1, 19] });
    expect(r.anfragen).toEqual({ fehlend: [], unklar: true });
    expect(ct.termine).toHaveLength(1);
  });

  it('unklare Antwort, aber angelegt: gefunden – ein POST, die Mails genau einmal', async () => {
    ct.terminFehler = { status: 504, angelegt: true };
    const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE, eingeladen: [1, 19] });
    expect(r.art).toBe('angelegt');
    expect(posts()).toHaveLength(1);
    expect(ct.mails).toEqual([{ person: 19, art: 'neu' }]);
  });

  it('unklar und nicht da: Unklar mit Wort von den Einladungen („doppelt“) – kein zweiter POST von allein', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    const e: unknown = await terminLegen({
      eintrag: MIT_UHR,
      zeitzone: ZONE,
      eingeladen: [1, 19],
    }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Unklar);
    expect(fehlerMeldung(e).text).toMatch(/Einladung doppelt/);
    expect(posts()).toHaveLength(1);
  });
});

/** Anmeldung (W15-5): ChurchTools legt mit dem Termin SOFORT Gruppen an – Rumpf, Nachlesen, nichts wird gelöscht. */
describe('terminLegen mit Anmeldung (W15-5)', () => {
  const gruppen = () => ct.aufrufe.filter((a) => a.startsWith('GET /groups'));
  /** Wie der TEST-Termin 496: wöchentlich ab 26.11.2026 19:00 Ortszeit bis 24.12., Typ 5, 14 Tage, 7 Tage bis Beenden. */
  const SERIE = {
    ...eintragVorbelegung({ text: 'TEST, 19 Uhr', datum: '2026-11-26' }, 4),
    kalender: 4,
    art: WIEDERHOLUNG.woechentlich,
    frequenz: 1,
    wiederBis: '2026-12-24',
  };
  const MIT = (
    anmeldung: Eintrag['anmeldung'] = { typ: 5, tage: 14, vorlage: null, beenden: 7 },
  ) => ({
    ...SERIE,
    anmeldung,
  });

  beforeEach(() => {
    // Nur die Uhr festlegen – echte Timer bleiben, sonst hängt der Nachbau.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T12:00:00Z'));
    // Die Gruppennamen stehen in der Ortszeit der Gemeinde.
    merkeGemeindeZeitzone({ timezone: ZONE });
  });
  afterEach(() => {
    vi.useRealTimers();
    _vergissGemeindeZeitzone();
  });

  it('der Rumpf trägt `signup` wie gemessen; ChurchTools legt je Einzeltermin bis „heute + 14“ eine Gruppe an – das Nachlesen findet sie', async () => {
    const r = await terminLegen({ eintrag: MIT(), zeitzone: ZONE });
    expect(ct.terminRumpf?.signup).toEqual({
      signupGroupTypeId: 5,
      signupDaysForwardNo: 14,
      signupDaysArchiveGroupNo: 7,
    });
    expect(ct.gruppen.map((g) => g.name)).toEqual([
      'TEST – 26.11.2026, 19:00',
      'TEST – 03.12.2026, 19:00',
    ]);
    expect(r.anmeldung).toEqual({ signupFehlt: false, fehlend: [], unklar: false });
  });

  it('Kopiervorlage und leere Auswahlen: nur die gewählten Felder gehen mit', async () => {
    await terminLegen({
      eintrag: MIT({ typ: 5, tage: 7, vorlage: 352, beenden: null }),
      zeitzone: ZONE,
    });
    expect(ct.terminRumpf?.signup).toEqual({
      signupGroupTypeId: 5,
      signupDaysForwardNo: 7,
      signupTemplateGroupId: 352,
    });
  });

  it('Schalter aus: kein `signup`, kein Lesen der Gruppen, nichts im Ergebnis', async () => {
    const r = await terminLegen({ eintrag: MIT(null), zeitzone: ZONE });
    expect(ct.terminRumpf).not.toHaveProperty('signup');
    expect(gruppen()).toEqual([]);
    expect(r).not.toHaveProperty('anmeldung');
    expect(ct.gruppen).toEqual([]);
  });

  it('ohne gewählten Gruppentyp geht nichts mit und nichts wird nachgelesen', async () => {
    const r = await terminLegen({
      eintrag: MIT({ typ: null, tage: 14, vorlage: null, beenden: null }),
      zeitzone: ZONE,
    });
    expect(ct.terminRumpf).not.toHaveProperty('signup');
    expect(r).not.toHaveProperty('anmeldung');
  });

  it('liegt kein Einzeltermin im Fenster: `signup` geht mit, aber es gibt keine Gruppe zu suchen – kein Lesen', async () => {
    const r = await terminLegen({
      eintrag: { ...MIT(), tag: '2027-03-04', wiederBis: '2027-03-25' },
      zeitzone: ZONE,
    });
    expect(ct.terminRumpf?.signup).toBeTruthy();
    expect(ct.gruppen).toEqual([]);
    expect(gruppen()).toEqual([]);
    expect(r.anmeldung).toEqual({ signupFehlt: false, fehlend: [], unklar: false });
  });

  it('ChurchTools sagt 201 und legt eine Gruppe nicht an: genau diese fehlt – der Termin bleibt, nichts wird gelöscht', async () => {
    ct.gruppenSchlucken = true;
    const r = await terminLegen({ eintrag: MIT(), zeitzone: ZONE });
    expect(r.anmeldung).toEqual({
      signupFehlt: false,
      fehlend: ['TEST – 26.11.2026, 19:00', 'TEST – 03.12.2026, 19:00'],
      unklar: false,
    });
    expect(ct.termine).toHaveLength(1);
    expect(ct.aufrufe.some((a) => a.startsWith('DELETE'))).toBe(false);
  });

  it('nur eine der beiden fehlt: nur sie steht im Ergebnis', async () => {
    ct.gruppen.push({ id: 900, name: 'TEST – 26.11.2026, 19:00', groupTypeId: 5 });
    ct.gruppenSchlucken = true;
    const r = await terminLegen({ eintrag: MIT(), zeitzone: ZONE });
    expect(r.anmeldung?.fehlend).toEqual(['TEST – 03.12.2026, 19:00']);
  });

  it('eine gleichnamige Gruppe eines ANDEREN Typs zählt nicht', async () => {
    ct.gruppen.push({ id: 900, name: 'TEST – 26.11.2026, 19:00', groupTypeId: 1 });
    ct.gruppenSchlucken = true;
    const r = await terminLegen({ eintrag: MIT(), zeitzone: ZONE });
    expect(r.anmeldung?.fehlend).toHaveLength(2);
  });

  it('ChurchTools speichert `signup` nicht: „fehlt“ – ohne die Gruppen zu lesen', async () => {
    ct.signupSchlucken = true;
    const r = await terminLegen({ eintrag: MIT(), zeitzone: ZONE });
    expect(r.anmeldung).toEqual({ signupFehlt: true, fehlend: [], unklar: false });
    expect(gruppen()).toEqual([]);
    expect(ct.termine).toHaveLength(1);
  });

  it('Gruppen nicht lesbar (500): `unklar`, NICHT „fehlt“ – der Termin bleibt', async () => {
    ct.gruppenLesenFehler = true;
    const r = await terminLegen({ eintrag: MIT(), zeitzone: ZONE });
    expect(r.anmeldung).toEqual({ signupFehlt: false, fehlend: [], unklar: true });
    expect(ct.termine).toHaveLength(1);
  });

  it('„Nur verknüpfen“: nichts wird angelegt, keine Gruppe, nichts gelesen', async () => {
    const r = await terminLegen({
      eintrag: MIT(),
      zeitzone: ZONE,
      verknuepfen: { id: 161, titel: 'TEST', beginn: '2026-11-26T18:00:00Z' },
    });
    expect(r).toEqual({ art: 'verknuepft', id: 161 });
    expect(posts()).toEqual([]);
    expect(ct.gruppen).toEqual([]);
    expect(gruppen()).toEqual([]);
  });

  it('unklare Antwort, aber angelegt: ein POST, die Gruppen genau einmal – das Nachlesen findet sie', async () => {
    ct.terminFehler = { status: 504, angelegt: true };
    const r = await terminLegen({ eintrag: MIT(), zeitzone: ZONE });
    expect(posts()).toHaveLength(1);
    expect(ct.gruppen).toHaveLength(2);
    expect(r.anmeldung).toEqual({ signupFehlt: false, fehlend: [], unklar: false });
  });

  it('der Termin löschen nimmt die Gruppen mit (gemessen 25.11.2026) – der Nachbau verhält sich so', async () => {
    const r = await terminLegen({ eintrag: MIT(), zeitzone: ZONE });
    expect(ct.gruppen).toHaveLength(2);
    await fetch(`https://ct.test/api/calendars/4/appointments/${r.id}`, { method: 'DELETE' });
    expect(ct.gruppen).toEqual([]);
  });
});
