import { describe, expect, it } from 'vitest';
import { tagKurz, tagMonat } from '../ct/datum';
import type { CtAbsence } from '../ct/typen';
import { erinnerungsTage, STANDARD_PLAN, type Abfrage } from './abfragen';
import {
  abfrageBandText,
  abfrageFrage,
  abfrageKartenEtikett,
  abfrageKartenText,
  abfrageZeilenTitel,
  abwesendAm,
  eingeteilteTermine,
  meinStandInAbfrage,
  monateKurz,
  naechsteErinnerungText,
} from './abfrageStand';
import { offeneTermine } from './erinnern';

/**
 * **Mein Stand in der Abfrage** (R-3). Heute = Di 10.11.2026; die Abfrage fragt Feb–Mär 2027 (Frist Di 17.11.).
 * Sechs Termine, jeder mit genau einem Grund, nicht offen zu sein – außer 1 und 5 (offen):
 *  1 offen · 2 Ja-Antwort · 3 abgesagt · 4 in der Gruppe eingeteilt · 5 in einer ANDEREN Gruppe eingeteilt (bleibt offen) ·
 *  6 Abwesenheit deckt ihn.
 * Die Erwartung kommt aus `offeneTermine` selbst (dem Erzeuger), nicht aus handgeschriebenen Zahlen.
 */
const HEUTE = '2026-11-10';
const t = (id: number, tag: string, extra: { abgesagt?: boolean } = {}) => ({
  id,
  tag,
  beginn: `${tag}T08:00:00Z`,
  ende: `${tag}T09:30:00Z`,
  ...extra,
});
const TERMINE = [
  t(1, '2027-02-07'),
  t(2, '2027-02-14'),
  t(3, '2027-02-21', { abgesagt: true }),
  t(4, '2027-03-07'),
  t(5, '2027-03-14'),
  t(6, '2027-03-21'),
];
const ABFRAGE: Abfrage = {
  id: 'a1',
  von: '2027-02-01',
  bis: '2027-03-31',
  frist: '2026-11-17',
  oeffnen: '2026-11-09',
  termine: [1, 2, 3, 4, 5, 6],
  gestartet: { personId: 1, name: 'Alwin', zeit: '2026-11-09T07:00:00Z' },
  beendet: null,
};
const ABW: CtAbsence = {
  id: 1,
  startDate: '2027-03-21',
  endDate: '2027-03-21',
  startTime: null,
  endTime: null,
};
const MUSIK = 4;
const TECHNIK = 3;
const dienste: Record<number, number> = { 9: MUSIK, 6: TECHNIK };
const ZEILEN = [
  ...TERMINE.map((x) => ({ ...x, meine: [] as { ort: { serviceId: number } | null }[] })),
].map((z) =>
  z.id === 4
    ? { ...z, meine: [{ ort: { serviceId: 9 } }] }
    : z.id === 5
      ? { ...z, meine: [{ ort: { serviceId: 6 } }] }
      : z,
);

const stand = (o: Partial<Parameters<typeof meinStandInAbfrage>[0]> = {}) =>
  meinStandInAbfrage({
    abfrage: ABFRAGE,
    termine: TERMINE,
    antworten: { '2': { a: 'ja', tag: '2027-02-14' } },
    abwesenheiten: [ABW],
    eingeteilt: eingeteilteTermine(ZEILEN, MUSIK, (s) => dienste[s]),
    heute: HEUTE,
    ...o,
  });

describe('meinStandInAbfrage', () => {
  it('offen ist genau, was offeneTermine liefert (Termine 1 und 5), gesamt zählt alle Termine der Abfrage', () => {
    const s = stand();
    const erwartet = offeneTermine({
      termine: TERMINE,
      heute: HEUTE,
      beantwortet: (x) => x.id === 2 || x.id === 6,
      eingeteilt: (x) => x.id === 4,
      pausiert: () => false,
    }).offen;
    expect(s.offen.map((x) => x.id)).toEqual(erwartet.map((x) => x.id));
    expect(s.offen.map((x) => x.id)).toEqual([1, 5]);
    expect(s.gesamt).toBe(6);
  });

  // Gegenproben je Regel: jede einzeln zurückgenommen, mit Zählung.
  it('Gegenprobe Antwort: ohne die Ja-Antwort ist auch Termin 2 offen (3 statt 2)', () => {
    expect(stand({ antworten: {} }).offen.map((x) => x.id)).toEqual([1, 2, 5]);
  });
  it('Gegenprobe Abwesenheit: ohne sie ist auch Termin 6 offen (3 statt 2)', () => {
    expect(stand({ abwesenheiten: [] }).offen.map((x) => x.id)).toEqual([1, 5, 6]);
  });
  it('Gegenprobe Einteilung: ohne sie ist auch Termin 4 offen (3 statt 2)', () => {
    expect(stand({ eingeteilt: new Set<number>() }).offen.map((x) => x.id)).toEqual([1, 4, 5]);
  });
  it('Einteilung in einer ANDEREN Dienstgruppe zählt nicht: Termin 5 bleibt offen, Technik-Sicht lässt 4 offen', () => {
    expect(eingeteilteTermine(ZEILEN, MUSIK, (s) => dienste[s])).toEqual(new Set([4]));
    expect(eingeteilteTermine(ZEILEN, TECHNIK, (s) => dienste[s])).toEqual(new Set([5]));
    expect(stand().offen.map((x) => x.id)).toContain(5);
  });
  it('Gegenprobe abgesagt/vorbei (terminZaehlt): Termin 3 nie offen; ein vergangener Termin auch nicht', () => {
    expect(stand().offen.map((x) => x.id)).not.toContain(3);
    expect(stand({ heute: '2027-02-10' }).offen.map((x) => x.id)).toEqual([5]);
  });
  it('ein Platz ohne bekannten Dienst lässt sich keiner Gruppe zuordnen: nicht eingeteilt', () => {
    const z = [{ id: 1, meine: [{ ort: null }] }];
    expect(eingeteilteTermine(z, MUSIK, (s) => dienste[s]).size).toBe(0);
  });
  it('Pause zählt nie: wer pausiert, sieht trotzdem alles Offene', () => {
    // `pausiert` ist fest „nein“ – dieselbe Zahl wie ohne jede Pause-Angabe.
    expect(stand().offen).toHaveLength(2);
  });
  it('ein Termin, der nicht (mehr) geladen ist, zählt nicht als offen, aber als Teil von gesamt', () => {
    const s = stand({ termine: TERMINE.filter((x) => x.id !== 1) });
    expect(s.offen.map((x) => x.id)).toEqual([5]);
    expect(s.gesamt).toBe(6);
  });
  it('Termine außerhalb der Abfrage zählen nicht', () => {
    const s = stand({ termine: [...TERMINE, t(99, '2027-02-28')] });
    expect(s.offen.map((x) => x.id)).toEqual([1, 5]);
  });
  it('abwesendAm: dieselbe Regel wie decktTermin (ganztägig deckt den Termin, ein anderer Tag nicht)', () => {
    expect(abwesendAm([ABW], TERMINE[5])).toBe(true);
    expect(abwesendAm([ABW], TERMINE[0])).toBe(false);
  });
});

describe('Texte', () => {
  it('Frage: ein Monat „im Februar“, zwei „im Februar und März“, drei mit Komma, über den Jahreswechsel', () => {
    expect(abfrageFrage({ von: '2027-02-01', bis: '2027-02-28' })).toBe(
      'Wann kannst du im Februar?',
    );
    expect(abfrageFrage(ABFRAGE)).toBe('Wann kannst du im Februar und März?');
    expect(abfrageFrage({ von: '2027-02-01', bis: '2027-04-30' })).toBe(
      'Wann kannst du im Februar, März und April?',
    );
    expect(abfrageFrage({ von: '2026-12-20', bis: '2027-01-10' })).toBe(
      'Wann kannst du im Dezember und Januar?',
    );
  });
  it('Karten-, Band- und Zeilentext', () => {
    expect(
      abfrageKartenText({ gruppe: 'Musik', abfrage: ABFRAGE, stand: { gesamt: 9, offen: 7 } }),
    ).toBe('Musik fragt für 9 Termine (01.02.–31.03.). Noch 7 offen.');
    expect(
      abfrageKartenText({ gruppe: 'Musik', abfrage: ABFRAGE, stand: { gesamt: 1, offen: 1 } }),
    ).toBe('Musik fragt für 1 Termin (01.02.–31.03.). Noch 1 offen.');
    expect(
      abfrageBandText({ gruppe: 'Musik', abfrage: ABFRAGE, stand: { offen: 7, gesamt: 9 } }),
    ).toBe('Abfrage Musik · 01.02.–31.03. · noch 7 von 9 offen');
    expect(abfrageBandText({ gruppe: 'Musik', abfrage: ABFRAGE, stand: null })).toBe(
      'Abfrage Musik · 01.02.–31.03.',
    );
    expect(abfrageZeilenTitel({ gruppe: 'Musik', abfrage: ABFRAGE })).toBe(
      'Abfrage Musik · Feb–Mär',
    );
    expect(monateKurz({ von: '2027-02-01', bis: '2027-02-20' })).toBe('Feb');
  });
  it('Etikett: blau bis zur Frist (auch am Tag selbst), rot „Frist vorbei“ danach, grau vor dem Öffnen, keins beendet', () => {
    expect(abfrageKartenEtikett(ABFRAGE, HEUTE)).toEqual({
      ton: 'blau',
      text: `bis ${tagKurz('2026-11-17')}`,
    });
    expect(abfrageKartenEtikett(ABFRAGE, '2026-11-17')?.ton).toBe('blau');
    expect(abfrageKartenEtikett(ABFRAGE, '2026-11-18')).toEqual({
      ton: 'rot',
      text: 'Frist vorbei',
    });
    expect(abfrageKartenEtikett(ABFRAGE, '2026-11-08')?.ton).toBe('neutral');
    expect(abfrageKartenEtikett({ ...ABFRAGE, beendet: HEUTE }, HEUTE)).toBeNull();
    expect(abfrageKartenEtikett(ABFRAGE, '2027-02-01')).toBeNull();
  });
  it('nächste Erinnerung = der erste Tag aus erinnerungsTage; keiner mehr → null', () => {
    const inhalt = { plan: null, abfragen: [ABFRAGE] };
    const erster = erinnerungsTage(STANDARD_PLAN, ABFRAGE, HEUTE)[0];
    expect(naechsteErinnerungText(inhalt, ABFRAGE, HEUTE)).toBe(
      `nächste Erinnerung ${tagKurz(erster)}`,
    );
    expect(erster).toBe('2026-11-15');
    expect(tagMonat(erster)).toBe('15.11.');
    expect(naechsteErinnerungText(inhalt, { ...ABFRAGE, beendet: HEUTE }, HEUTE)).toBeNull();
  });
});
