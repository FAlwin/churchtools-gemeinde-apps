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
