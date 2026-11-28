import { describe, expect, it } from 'vitest';
import { eintragFehler } from './termine';
import { eventsFuer } from './terminEvents';
import { neueThemenreihe, neueZeile, zeileMitEvent, type ReiheEvent } from './themenreihe';
import {
  angelegte,
  EVENT_BEGINN,
  EVENT_ENDE,
  eventAnlegenFehler,
  kalenderMitEvents,
  reiheEintrag,
  tagMeldung,
  zeilenOhneEvent,
  zusammenfassung,
  type EventAnlegenEingabe,
  type TagErgebnis,
} from './reiheEventAnlegen';

const EINGABE: EventAnlegenEingabe = {
  kalender: 4,
  titel: 'Jugendabend',
  von: EVENT_BEGINN,
  bis: EVENT_ENDE,
  vorlage: 7,
};
const EVENT: ReiheEvent = {
  id: 900,
  name: 'Jugendabend',
  startDate: '2027-01-27T18:30:00Z',
  tag: '2027-01-27',
  kalenderId: 4,
};

describe('kalenderMitEvents', () => {
  it('nur Kalender, in denen beides geht – in der Reihenfolge der Termin-Kalender', () => {
    expect(kalenderMitEvents([4, 2, 9], [9, 4, 5])).toEqual([4, 9]);
    expect(kalenderMitEvents([4], [])).toEqual([]);
    expect(kalenderMitEvents([], [4])).toEqual([]);
  });
});

describe('zeilenOhneEvent', () => {
  it('nur Abende mit gültigem Datum und ohne Event – gebaut mit den Erzeugern der Reihe', () => {
    const r = neueThemenreihe({
      id: 'r',
      gruppe: 1,
      name: 'Jona',
      von: 1,
      am: 'x',
      zeilen: [
        { ...neueZeile('a', '2027-01-13'), eventId: 10, eventTitel: 'Jugendabend' },
        neueZeile('b', '2027-01-20'),
        neueZeile('c', ''),
        neueZeile('d', '2027-02-03'),
      ],
    });
    expect(zeilenOhneEvent(r.zeilen).map((z) => z.id)).toEqual(['b', 'd']);
    // Eine Zeile mit Event aus der Hand der Reihe fällt heraus.
    const mit = r.zeilen.map((z) => (z.id === 'b' ? zeileMitEvent(z, EVENT) : z));
    expect(zeilenOhneEvent(mit).map((z) => z.id)).toEqual(['d']);
  });
});

describe('reiheEintrag', () => {
  it('ein Termin ohne Einladung, Ressourcen, Anmeldung und Wiederholung – mit der einen Vorlage für diesen Tag', () => {
    const e = reiheEintrag(EINGABE, '2027-01-27');
    expect(e).toMatchObject({
      kalender: 4,
      titel: 'Jugendabend',
      tag: '2027-01-27',
      endTag: '2027-01-27',
      ganztaegig: false,
      von: '19:30',
      bis: '21:30',
      events: { '2027-01-27': 7 },
      buchungen: [],
      anmeldung: null,
    });
    expect(eintragFehler(e)).toBeNull();
  });

  it('die Vorlage mit der Nummer 0 („Standard“) geht mit – sie ist keine „leere“ Wahl', () => {
    const e = reiheEintrag({ ...EINGABE, vorlage: 0 }, '2027-01-27');
    expect(e.events).toEqual({ '2027-01-27': 0 });
    // Aus dem Erzeuger der Events: genau ein Event, mit der Nummer 0 und dem UTC-Beginn des Abends.
    expect(eventsFuer(e, 'Europe/Berlin')).toEqual([
      { tag: '2027-01-27', startDate: '2027-01-27T18:30:00Z', eventTemplateId: 0 },
    ]);
  });

  it('eine Uhrzeit im Titel wird nicht als Zeit gelesen – der Titel bleibt, die Zeit kommt aus den Feldern', () => {
    const e = reiheEintrag({ ...EINGABE, titel: ' Jugendabend 19:00 ' }, '2027-01-27');
    expect(e.titel).toBe('Jugendabend 19:00');
    expect(e.von).toBe('19:30');
    expect(e.ganztaegig).toBe(false);
  });

  it('ohne Vorlage kein Event im Eintrag', () => {
    expect(reiheEintrag({ ...EINGABE, vorlage: null }, '2027-01-27').events).toEqual({});
  });
});

describe('eventAnlegenFehler', () => {
  const tag = '2027-01-27';
  it('prüft mit der Prüfung des Termin-Fensters: Kalender, Titel, Zeit', () => {
    expect(eventAnlegenFehler({ ...EINGABE, kalender: null }, tag)).toBe(
      'Bitte einen Kalender wählen.',
    );
    expect(eventAnlegenFehler({ ...EINGABE, titel: '  ' }, tag)).toBe('Bitte einen Titel angeben.');
    expect(eventAnlegenFehler({ ...EINGABE, bis: '19:00' }, tag)).toBe(
      'Das Ende muss nach dem Beginn liegen.',
    );
    expect(eventAnlegenFehler({ ...EINGABE, von: '' }, tag)).toBe('Bitte Beginn und Ende angeben.');
  });
  it('die Vorlage ist Pflicht – die Nummer 0 zählt als gewählt', () => {
    expect(eventAnlegenFehler({ ...EINGABE, vorlage: null }, tag)).toBe(
      'Bitte eine Eventvorlage wählen.',
    );
    expect(eventAnlegenFehler({ ...EINGABE, vorlage: 0 }, tag)).toBeNull();
    expect(eventAnlegenFehler(EINGABE, tag)).toBeNull();
  });
});

describe('Meldungen und Zusammenfassung', () => {
  const alle: TagErgebnis[] = [
    { id: 'a', tag: '2027-01-27', art: 'angelegt', event: EVENT },
    { id: 'b', tag: '2027-02-10', art: 'schonDa', titel: 'Jugendabend', kalender: 'Jugend' },
    { id: 'c', tag: '2027-02-17', art: 'ohneEvent' },
    { id: 'd', tag: '2027-02-24', art: 'unklar', text: 'ChurchTools hat nicht geantwortet.' },
    { id: 'e', tag: '2027-03-03', art: 'fehler', text: 'Kein Recht.' },
  ];

  it('jeder Fall hat seinen Satz – ein angelegtes Event braucht keinen', () => {
    expect(tagMeldung(alle[0])).toBeNull();
    expect(tagMeldung(alle[1])).toBe(
      'Am 10.02.2027 steht im Kalender „Jugend“ schon „Jugendabend“. Dort wird nichts angelegt; ordne ihn über „Event wählen“ zu.',
    );
    expect(tagMeldung(alle[2])).toBe(
      'Termin am 17.02.2027 angelegt, das Event ließ sich nicht finden – bitte in ChurchTools nachsehen und über „Event wählen“ zuordnen.',
    );
    expect(tagMeldung(alle[3])).toBe('Am 24.02.2027: ChurchTools hat nicht geantwortet.');
    expect(tagMeldung(alle[4])).toBe('Am 03.03.2027 wurde nichts angelegt: Kein Recht.');
  });

  it('die Kopfzeile zählt die angelegten Events und sagt „Jetzt die Reihe speichern“ nur, wenn es welche gibt', () => {
    expect(zusammenfassung(alle)).toMatchObject({
      kopf: '1 Event angelegt. Jetzt die Reihe speichern.',
      speichern: true,
    });
    expect(zusammenfassung(alle).meldungen).toHaveLength(4);
    expect(zusammenfassung([alle[0], { ...alle[0], id: 'z' }]).kopf).toBe(
      '2 Events angelegt. Jetzt die Reihe speichern.',
    );
    expect(zusammenfassung(alle.slice(1))).toMatchObject({
      kopf: 'Es wurde kein Event angelegt.',
      speichern: false,
    });
  });

  it('angelegte liefert nur die Zeilen mit einem Event in der Hand', () => {
    expect(angelegte(alle)).toEqual([{ id: 'a', event: EVENT }]);
  });
});
