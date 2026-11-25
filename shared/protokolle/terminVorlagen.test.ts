import { describe, expect, it } from 'vitest';
import { eintragVorbelegung, type Eintrag } from './termine';
import {
  plusSekunden,
  sekundenZwischen,
  vorlageAnwenden,
  vorlageRumpf,
  vorlagenAus,
} from './terminVorlagen';
import { WIEDERHOLUNG } from './terminWiederholung';

/** Termin-Vorlagen (W15-1): lesen, anwenden, als Vorlage speichern – Formen wie gemessen (`messung-w15-0`). */
const roh = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  calendarId: 4,
  title: 'Gottesdienst',
  subtitle: 'Sonntag',
  description: 'Beschreibung',
  link: 'https://ecg-donrath.de',
  isInternal: true,
  allDay: false,
  startTime: '10:30',
  duration: 5400,
  repeatId: 7,
  repeatFrequency: 2,
  repeatDuration: 86_400 * 42,
  address: { name: 'Saal', street: 'Hauptstraße 1', zip: '53797', city: 'Lohmar' },
  tags: [{ id: 3, name: 'Jugend' }, 5],
  onBehalfOfPid: 19,
  ...extra,
});
const eintrag = (tag = '2026-12-06'): Eintrag & { kalender: number } => ({
  ...eintragVorbelegung({ text: 'Heiligabend, 16 Uhr', datum: tag }, 4),
  kalender: 4,
});
const eine = (extra: Record<string, unknown> = {}) => vorlagenAus([roh(extra)])[0];

describe('vorlagenAus', () => {
  it('liest alle Felder – Tags als Nummern (auch aus Objekten), Adresse, Im Auftrag von', () => {
    expect(eine()).toEqual({
      id: 7,
      kalender: 4,
      titel: 'Gottesdienst',
      untertitel: 'Sonntag',
      beschreibung: 'Beschreibung',
      link: 'https://ecg-donrath.de',
      intern: true,
      ganztaegig: false,
      startzeit: '10:30',
      dauer: 5400,
      art: 7,
      frequenz: 2,
      option: 0,
      wiederDauer: 86_400 * 42,
      adresse: { name: 'Saal', street: 'Hauptstraße 1', zip: '53797', city: 'Lohmar' },
      tags: [3, 5],
      imAuftrag: 19,
      buchungen: [],
      eventVorlage: null,
      anmeldungTyp: null,
      anmeldungTage: null,
      anmeldungBeenden: null,
      anmeldungVorlage: null,
    });
  });

  it('ohne Nummer, Kalender oder Titel ist es keine Vorlage; der Rest wird nach Titel sortiert', () => {
    const liste = vorlagenAus([
      roh({ id: 1, title: 'Zebra' }),
      roh({ id: undefined }),
      roh({ calendarId: 'x' }),
      roh({ title: ' ' }),
      null,
      roh({ id: 2, title: 'Alpha' }),
    ]);
    expect(liste.map((v) => v.titel)).toEqual(['Alpha', 'Zebra']);
    expect(vorlagenAus(null)).toEqual([]);
    expect(vorlagenAus({})).toEqual([]);
  });

  it('Zahlen als Text, startTime mit Sekunden, alter Adress-Name `meetingAt`', () => {
    const v = eine({
      calendarId: '4',
      startTime: '09:05:00',
      address: { meetingAt: 'Altbau' },
      repeatFrequency: 0,
    });
    expect(v).toMatchObject({ kalender: 4, startzeit: '09:05', frequenz: 1 });
    expect(v.adresse).toEqual({ name: 'Altbau' });
  });
});

describe('vorlageAnwenden', () => {
  it('füllt alles aus der Vorlage – das Datum des Beginns und der Kalender bleiben', () => {
    const e = vorlageAnwenden(eintrag(), eine());
    expect(e).toMatchObject({
      kalender: 4,
      tag: '2026-12-06',
      titel: 'Gottesdienst',
      untertitel: 'Sonntag',
      beschreibung: 'Beschreibung',
      link: 'https://ecg-donrath.de',
      intern: true,
      ganztaegig: false,
      von: '10:30',
      art: 7,
      frequenz: 2,
      ort: 'Saal',
      ortStrasse: 'Hauptstraße 1',
      ortPlz: '53797',
      ortStadt: 'Lohmar',
      ortZusatz: '',
      tags: [3, 5],
      imAuftrag: 19,
      buchungen: [],
      weitere: [],
      ausnahmen: [],
    });
  });

  it('Ende = Beginn + Dauer (Sekunden), auch über Mitternacht', () => {
    expect(vorlageAnwenden(eintrag(), eine())).toMatchObject({
      endTag: '2026-12-06',
      bis: '12:00',
    });
    const nacht = vorlageAnwenden(eintrag(), eine({ startTime: '23:00', duration: 7200 }));
    expect(nacht).toMatchObject({ von: '23:00', endTag: '2026-12-07', bis: '01:00' });
  });

  it('Bis = Beginn + repeatDuration; ohne repeatDuration die Vorgabe der Art', () => {
    expect(vorlageAnwenden(eintrag(), eine()).wiederBis).toBe('2027-01-17');
    expect(vorlageAnwenden(eintrag(), eine({ repeatDuration: 0 })).wiederBis).toBe('2026-12-13');
  });

  it('ganztägig: 0 Sekunden = derselbe Tag, sonst ganze Tage; die Uhrzeiten bleiben unberührt', () => {
    const ein = vorlageAnwenden(eintrag(), eine({ allDay: true, duration: 0, repeatId: 0 }));
    expect(ein).toMatchObject({ ganztaegig: true, endTag: '2026-12-06', wiederBis: '' });
    const drei = vorlageAnwenden(
      eintrag(),
      eine({ allDay: true, duration: 2 * 86_400, repeatId: 0 }),
    );
    expect(drei.endTag).toBe('2026-12-08');
  });

  it('eine Vorlage ohne Wiederholung räumt die Wiederholung weg; Manuell hat kein Bis', () => {
    const vorher = { ...eintrag(), art: 7, wiederBis: '2027-01-01', weitere: ['2026-12-20'] };
    expect(vorlageAnwenden(vorher, eine({ repeatId: 0 }))).toMatchObject({
      art: 0,
      wiederBis: '',
      weitere: [],
    });
    expect(vorlageAnwenden(eintrag(), eine({ repeatId: 999 }))).toMatchObject({
      art: WIEDERHOLUNG.manuell,
      wiederBis: '',
    });
  });

  it('monatlich nach Wochentag: repeatOptionId der Vorlage, sonst das Ordinal des Datums', () => {
    const mit = vorlageAnwenden(eintrag(), eine({ repeatId: 32, repeatOptionId: 6 }));
    expect(mit.option).toBe(6);
    const ohne = vorlageAnwenden(eintrag('2026-12-20'), eine({ repeatId: 32 }));
    expect(ohne.option).toBe(3);
  });

  it('„Ersteller informieren“ ist keine Sache der Vorlage', () => {
    expect(vorlageAnwenden({ ...eintrag(), informieren: false }, eine()).informieren).toBe(false);
  });
});

describe('vorlageRumpf („Als Vorlage speichern“)', () => {
  it('Pflichtfelder: title, calendarId, startTime, duration', () => {
    expect(vorlageRumpf(eintrag())).toEqual({
      calendarId: 4,
      title: 'Heiligabend',
      isInternal: false,
      allDay: false,
      startTime: '16:00',
      duration: 3600,
      repeatId: 0,
    });
  });

  it('mit Wiederholung: repeatFrequency, repeatDuration (Beginn bis „Bis“), repeatOptionId nur bei Wochentag', () => {
    const w: Eintrag & { kalender: number } = {
      ...eintrag(),
      art: 7,
      frequenz: 2,
      wiederBis: '2027-01-17',
    };
    const r = vorlageRumpf(w);
    expect(r).toMatchObject({ repeatId: 7, repeatFrequency: 2, repeatDuration: 86_400 * 42 });
    expect(r).not.toHaveProperty('repeatOptionId');
    expect(vorlageRumpf({ ...w, art: 32, option: 3 })).toMatchObject({ repeatOptionId: 3 });
  });

  it('Manuell und Keine: keine Dauer der Serie', () => {
    const m = vorlageRumpf({ ...eintrag(), art: 999 });
    expect(m).toMatchObject({ repeatId: 999 });
    expect(m).not.toHaveProperty('repeatDuration');
    expect(m).not.toHaveProperty('repeatFrequency');
  });

  it('ganztägig: Dauer in ganzen Tagen (ein Tag = 0), Startzeit 00:00', () => {
    const g = { ...eintrag(), ganztaegig: true };
    expect(vorlageRumpf(g)).toMatchObject({ allDay: true, startTime: '00:00', duration: 0 });
    expect(vorlageRumpf({ ...g, endTag: '2026-12-08' }).duration).toBe(2 * 86_400);
  });

  it('nur gefüllte Felder, Tags nur mit Nummer, Ort als Adresse, Im Auftrag von', () => {
    const r = vorlageRumpf({
      ...eintrag(),
      untertitel: ' Sonntag ',
      beschreibung: 'B',
      link: 'https://x.de',
      intern: true,
      ort: ' Saal ',
      ortPlz: '53797',
      tags: [3, 'Neu'],
      imAuftrag: 19,
      buchungen: [],
    });
    expect(r).toMatchObject({
      subtitle: 'Sonntag',
      description: 'B',
      link: 'https://x.de',
      isInternal: true,
      address: { name: 'Saal', zip: '53797' },
      tags: [3],
      onBehalfOfPid: 19,
    });
  });

  it('Rundreise: was gespeichert wird, füllt beim Anwenden dasselbe wieder ein', () => {
    const quelle: Eintrag & { kalender: number } = {
      ...eintrag('2026-12-06'),
      titel: 'Gottesdienst',
      untertitel: 'Sonntag',
      von: '10:30',
      endTag: '2026-12-06',
      bis: '12:00',
      art: 32,
      frequenz: 2,
      option: 3,
      wiederBis: '2027-01-17',
      ort: 'Saal',
      ortStrasse: 'Hauptstraße 1',
      ortZusatz: 'Hinterhaus',
      tags: [3],
      intern: true,
    };
    const gespeichert = { ...vorlageRumpf(quelle), id: 42 };
    const [v] = vorlagenAus([gespeichert]);
    const zurueck = vorlageAnwenden(eintrag('2026-12-06'), v);
    expect(zurueck).toMatchObject({
      titel: quelle.titel,
      untertitel: quelle.untertitel,
      von: quelle.von,
      endTag: quelle.endTag,
      bis: quelle.bis,
      art: quelle.art,
      frequenz: quelle.frequenz,
      option: quelle.option,
      wiederBis: quelle.wiederBis,
      ort: quelle.ort,
      ortStrasse: quelle.ortStrasse,
      ortZusatz: quelle.ortZusatz,
      tags: quelle.tags,
      intern: true,
    });
  });
});

describe('Rechnen mit Tag und Uhrzeit', () => {
  it('plusSekunden und sekundenZwischen sind Gegenstücke', () => {
    expect(plusSekunden('2026-12-31', '23:30', 3600)).toEqual({ tag: '2027-01-01', zeit: '00:30' });
    expect(sekundenZwischen('2026-12-31', '23:30', '2027-01-01', '00:30')).toBe(3600);
  });
});

/** Buchungen in Termin-Vorlagen (W15-2): Altformat `{resource_id, minpre, minpost, status_id}` mit Zahlen als Text. */
describe('Vorlagen mit Buchungen', () => {
  const alt = [
    { resource_id: '3', minpre: '150', minpost: '60', status_id: 1 },
    { resource_id: '5', minpre: '0', minpost: '15', status_id: 2 },
  ];
  const darf = { buchbar: new Set([3, 5]), verwaltbar: new Set([5]) };

  it('liest das Altformat (Zahlen als Text) – und die neuen Namen der Schnittstelle', () => {
    expect(eine({ bookings: alt }).buchungen).toEqual([
      { ressource: 3, vorlauf: 150, nachlauf: 60, status: 1, menge: 1 },
      { ressource: 5, vorlauf: 0, nachlauf: 15, status: 2, menge: 1 },
    ]);
    expect(
      eine({
        bookings: [{ resourceId: 7, leadTimeMinutes: 10, afterwardMinutes: 5, statusId: 3 }],
      }).buchungen,
    ).toEqual([{ ressource: 7, vorlauf: 10, nachlauf: 5, status: 3, menge: 1 }]);
  });

  it('ohne `bookings`, mit Unsinn oder ohne Ressource: keine Buchungen', () => {
    expect(eine().buchungen).toEqual([]);
    expect(eine({ bookings: 'x' }).buchungen).toEqual([]);
    expect(eine({ bookings: [{ minpre: '5' }, null, { resource_id: '0' }] }).buchungen).toEqual([]);
  });

  it('anwenden: die Tabelle füllt sich – nur buchbare Ressourcen, Status ohne Verwalten-Recht = 1', () => {
    const e = vorlageAnwenden(eintrag(), eine({ bookings: alt }), darf);
    expect(e.buchungen).toEqual([
      { ressource: 3, vorlauf: 150, nachlauf: 60, status: 1, menge: 1 },
      { ressource: 5, vorlauf: 0, nachlauf: 15, status: 2, menge: 1 },
    ]);
    const ohneVerwalten = vorlageAnwenden(eintrag(), eine({ bookings: alt }), {
      buchbar: new Set([3, 5]),
      verwaltbar: new Set(),
    });
    expect(ohneVerwalten.buchungen.map((b) => b.status)).toEqual([1, 1]);
    const nurEine = vorlageAnwenden(eintrag(), eine({ bookings: alt }), {
      buchbar: new Set([3]),
      verwaltbar: new Set(),
    });
    expect(nurEine.buchungen.map((b) => b.ressource)).toEqual([3]);
  });

  it('ohne Angabe der Rechte übernimmt die Vorlage keine Buchungen; die Vorgabe oben bleibt', () => {
    const e = vorlageAnwenden({ ...eintrag(), vorlauf: 40, nachlauf: 50 }, eine({ bookings: alt }));
    expect(e.buchungen).toEqual([]);
    expect([e.vorlauf, e.nachlauf]).toEqual([40, 50]);
  });

  it('eine Vorlage ohne Buchungen leert die Tabelle', () => {
    const vorher = {
      ...eintrag(),
      buchungen: [{ ressource: 3, vorlauf: 1, nachlauf: 1, status: 1 as const, menge: 1 }],
    };
    expect(vorlageAnwenden(vorher, eine(), darf).buchungen).toEqual([]);
  });

  it('speichern: im Altformat (Zahlen als Text), ohne Buchungen kein `bookings`', () => {
    const e = {
      ...eintrag(),
      buchungen: [{ ressource: 3, vorlauf: 150, nachlauf: 60, status: 1 as const, menge: 1 }],
    };
    expect(vorlageRumpf(e).bookings).toEqual([
      { resource_id: '3', minpre: '150', minpost: '60', status_id: 1 },
    ]);
    expect(vorlageRumpf(eintrag())).not.toHaveProperty('bookings');
  });

  it('Rundreise: was gespeichert wird, füllt beim Anwenden dieselbe Tabelle wieder ein (Menge ausgenommen)', () => {
    const quelle = {
      ...eintrag(),
      buchungen: [
        { ressource: 3, vorlauf: 150, nachlauf: 60, status: 1 as const, menge: 1 },
        { ressource: 5, vorlauf: 0, nachlauf: 15, status: 2 as const, menge: 1 },
      ],
    };
    const [v] = vorlagenAus([{ ...vorlageRumpf(quelle), id: 42 }]);
    expect(vorlageAnwenden(eintrag(), v, darf).buchungen).toEqual(quelle.buchungen);
  });
});

/** Anmeldung in der Vorlage (W15-5): `grouptypeId`, `daysForwardNo`, `daysArchiveGroupNo`, `templateGroupId`. */
describe('Vorlage und Anmeldung', () => {
  const ERLAUBT = {
    buchbar: new Set<number>(),
    verwaltbar: new Set<number>(),
    gruppentypen: new Set([1, 5]),
  };
  const MIT = { grouptypeId: 5, daysForwardNo: 30, daysArchiveGroupNo: 7, templateGroupId: 352 };

  it('liest die vier Felder – Zahlen und Zahlentexte; 0 und Unsinn zählen als „keine“', () => {
    expect(eine(MIT)).toMatchObject({
      anmeldungTyp: 5,
      anmeldungTage: 30,
      anmeldungBeenden: 7,
      anmeldungVorlage: 352,
    });
    expect(eine({ grouptypeId: '5', daysForwardNo: '14' })).toMatchObject({
      anmeldungTyp: 5,
      anmeldungTage: 14,
    });
    expect(
      eine({ grouptypeId: 0, daysForwardNo: null, daysArchiveGroupNo: 'x', templateGroupId: 1.5 }),
    ).toMatchObject({
      anmeldungTyp: null,
      anmeldungTage: null,
      anmeldungBeenden: null,
      anmeldungVorlage: null,
    });
  });

  it('Anwenden mit erlaubtem Gruppentyp schaltet die Anmeldung an', () => {
    expect(vorlageAnwenden(eintrag(), eine(MIT), ERLAUBT).anmeldung).toEqual({
      typ: 5,
      tage: 30,
      vorlage: 352,
      beenden: 7,
    });
  });

  it('ohne genannte Tage gilt die Vorgabe 14; leere Auswahlen bleiben leer', () => {
    expect(vorlageAnwenden(eintrag(), eine({ grouptypeId: 1 }), ERLAUBT).anmeldung).toEqual({
      typ: 1,
      tage: 14,
      vorlage: null,
      beenden: null,
    });
  });

  it('ein nicht erlaubter Gruppentyp, kein Typ oder keine Rechte-Angabe: Schalter bleibt aus', () => {
    expect(
      vorlageAnwenden(eintrag(), eine({ ...MIT, grouptypeId: 9 }), ERLAUBT).anmeldung,
    ).toBeNull();
    expect(vorlageAnwenden(eintrag(), eine(), ERLAUBT).anmeldung).toBeNull();
    expect(vorlageAnwenden(eintrag(), eine(MIT)).anmeldung).toBeNull();
  });

  it('eine Vorlage ohne Anmeldung schaltet eine angeschaltete wieder aus (die Vorlage bestimmt alles)', () => {
    const an = { ...eintrag(), anmeldung: { typ: 1, tage: 7, vorlage: null, beenden: null } };
    expect(vorlageAnwenden(an, eine(), ERLAUBT).anmeldung).toBeNull();
  });

  it('Speichern schreibt die Felder nur mit Schalter an; leere Auswahlen fehlen', () => {
    const aus = vorlageRumpf(eintrag());
    for (const k of ['grouptypeId', 'daysForwardNo', 'daysArchiveGroupNo', 'templateGroupId'])
      expect(aus).not.toHaveProperty(k);
    const an = vorlageRumpf({
      ...eintrag(),
      anmeldung: { typ: 5, tage: 14, vorlage: null, beenden: null },
    });
    expect(an).toMatchObject({ grouptypeId: 5, daysForwardNo: 14 });
    expect(an).not.toHaveProperty('daysArchiveGroupNo');
    expect(an).not.toHaveProperty('templateGroupId');
  });

  it('Rundreise: speichern (Erzeuger) → lesen → anwenden ergibt dieselbe Anmeldung', () => {
    const anmeldung = { typ: 5, tage: 90, vorlage: 352, beenden: 14 };
    const rumpf = vorlageRumpf({ ...eintrag(), anmeldung });
    const v = vorlagenAus([{ id: 9, ...rumpf }])[0];
    expect(vorlageAnwenden(eintrag(), v, ERLAUBT).anmeldung).toEqual(anmeldung);
  });
});
