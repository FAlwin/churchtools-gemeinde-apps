import { describe, expect, it } from 'vitest';
import {
  ctStatus,
  gaesteAus,
  gaesteWert,
  kurzform,
  nachTipp,
  ohneAus,
  ohneAusgeblendete,
  nurSchnappschussAnders,
  ohneWert,
  personenAus,
  schnappschussAus,
  schnappschussWert,
  statusAus,
  treffenStandAus,
  vorbelegung,
  zumLesen,
  type TreffenStand,
} from './anwesenheit';

/** Eine Zeile aus `GET /groups/{g}/meetings/{m}/members`, wie gemessen (05.11.2026). */
const zeile = (personId: number, status: string, vor?: string, nach?: string) => ({
  personId,
  isCheckedIn: status === 'present',
  status,
  member: {
    personId,
    person: {
      title: `${vor ?? ''} ${nach ?? ''}`.trim(),
      domainAttributes: { firstName: vor, lastName: nach },
    },
  },
});

describe('Status ChurchTools ⇄ Anwesenheit (S5-3)', () => {
  it('present/absent/unsure, Unbekanntes ist offen – und zurück', () => {
    expect(['present', 'absent', 'unsure', 'not-in-group', undefined].map(statusAus)).toEqual([
      'da',
      'weg',
      'offen',
      'offen',
      'offen',
    ]);
    for (const s of ['da', 'weg', 'offen'] as const) expect(statusAus(ctStatus(s))).toBe(s);
  });
});

describe('personenAus', () => {
  it('Namen aus Vor- und Nachname, sonst Titel, sonst „Person n“; nach Namen sortiert; ohne ID fällt weg', () => {
    const p = personenAus([
      zeile(7, 'present', 'Johann', 'Becker'),
      zeile(1, 'unsure', 'Alwin', 'Friesen'),
      { personId: 9, status: 'absent', member: { person: { title: 'Gast-Konto' } } },
      { personId: 4, status: 'unsure' },
      { status: 'present' },
    ]);
    expect(p).toEqual([
      { person: 1, name: 'Alwin Friesen', status: 'offen' },
      { person: 9, name: 'Gast-Konto', status: 'weg' },
      { person: 7, name: 'Johann Becker', status: 'da' },
      { person: 4, name: 'Person 4', status: 'offen' },
    ]);
    expect(personenAus(null)).toEqual([]);
  });

  it('treffenStandAus liest abgeschlossen und begonnen', () => {
    expect(treffenStandAus({ isCompleted: true, hasEditingStarted: false }, [])).toEqual({
      abgeschlossen: true,
      begonnen: false,
      personen: [],
    });
    expect(treffenStandAus(null, [])).toMatchObject({ abgeschlossen: false, begonnen: false });
  });
});

describe('vorbelegung – von selbst aus den Zusagen', () => {
  const stand = (begonnen = false, abgeschlossen = false): TreffenStand => ({
    begonnen,
    abgeschlossen,
    personen: personenAus([
      zeile(1, 'unsure', 'A', 'A'),
      zeile(2, 'unsure', 'B', 'B'),
      zeile(3, 'unsure', 'C', 'C'),
      zeile(4, 'unsure', 'D', 'D'),
      zeile(5, 'absent', 'E', 'E'),
    ]),
  });
  const anfragen = [
    { person: 1, antwort: 'zugesagt' as const },
    { person: 2, antwort: 'abgesagt' as const },
    { person: 3, antwort: 'vielleicht' as const },
    { person: 5, antwort: 'zugesagt' as const },
  ];

  it('Zusage → anwesend, Absage → abwesend; vielleicht/keine Antwort bleiben offen; schon Eingetragenes bleibt', () => {
    expect(vorbelegung(stand(), anfragen, [])).toEqual([
      { person: 1, status: 'da' },
      { person: 2, status: 'weg' },
    ]);
  });

  it('nicht mehr, sobald am Treffen jemand etwas eingetragen hat oder es abgeschlossen ist', () => {
    expect(vorbelegung(stand(true), anfragen, [])).toEqual([]);
    expect(vorbelegung(stand(false, true), anfragen, [])).toEqual([]);
  });
});

describe('vorbelegung – aus dem Protokoll genommene Personen', () => {
  const stand: TreffenStand = {
    begonnen: false,
    abgeschlossen: false,
    personen: personenAus([
      zeile(1, 'unsure', 'A', 'A'),
      zeile(2, 'unsure', 'B', 'B'),
      zeile(3, 'unsure', 'C', 'C'),
    ]),
  };
  const anfragen = [
    { person: 1, antwort: 'zugesagt' as const },
    { person: 2, antwort: 'abgesagt' as const },
    { person: 3, antwort: 'zugesagt' as const },
  ];

  it('wer ausgeblendet ist, bekommt nichts von selbst eingetragen – die anderen schon', () => {
    expect(vorbelegung(stand, anfragen, [])).toEqual([
      { person: 1, status: 'da' },
      { person: 2, status: 'weg' },
      { person: 3, status: 'da' },
    ]);
    expect(vorbelegung(stand, anfragen, ohneAus(ohneWert([2, 3])))).toEqual([
      { person: 1, status: 'da' },
    ]);
  });
});

describe('ohne – Personen aus diesem Protokoll nehmen', () => {
  it('ohneAus: Kaputtes, Leeres, Doppeltes und Keine-ID fällt weg; die Reihenfolge bleibt', () => {
    expect(ohneAus('[19,4,19,"7",0,-2,1.5,null]')).toEqual([19, 4]);
    expect(ohneAus('')).toEqual([]);
    expect(ohneAus(undefined)).toEqual([]);
    expect(ohneAus(42)).toEqual([]);
    expect(ohneAus('kein json')).toEqual([]);
    expect(ohneAus('{"a":1}')).toEqual([]);
  });

  it('ohneWert ⇄ ohneAus: gleicher Weg hin und zurück; leer, wenn niemand ausgeblendet ist', () => {
    expect(ohneAus(ohneWert([19, 4, 19]))).toEqual([19, 4]);
    expect(ohneWert([])).toBe('');
    expect(ohneWert([0, -1])).toBe('');
  });

  const stand: TreffenStand = {
    abgeschlossen: false,
    begonnen: true,
    personen: personenAus([
      zeile(1, 'present', 'Alwin', 'Friesen'),
      zeile(19, 'unsure', 'Technik', 'ECG'),
      zeile(7, 'absent', 'Johann', 'Becker'),
    ]),
  };

  it('ohneAusgeblendete nimmt sie aus der Liste und lässt den Rest des Stands unberührt', () => {
    const neu = ohneAusgeblendete(stand, [19, 99]);
    expect(neu.personen.map((p) => p.person)).toEqual([1, 7]);
    expect(neu).toMatchObject({ abgeschlossen: false, begonnen: true });
    // Der Stand selbst bleibt vollständig (er gehört ChurchTools, nicht dem Protokoll).
    expect(stand.personen).toHaveLength(3);
    expect(ohneAusgeblendete(stand, [])).toBe(stand);
  });

  it('die Kurzform zählt ohne die Ausgeblendeten', () => {
    const k = kurzform(ohneAusgeblendete(stand, [19]).personen, []);
    expect(k).toMatchObject({
      anwesend: ['Alwin Friesen'],
      abwesend: ['Johann Becker'],
      offen: [],
    });
    expect(kurzform(stand.personen, []).offen).toEqual(['Technik ECG']);
  });
});

describe('nachTipp', () => {
  it('setzt – und nochmal tippen heißt wieder offen', () => {
    expect(nachTipp('offen', 'da')).toBe('da');
    expect(nachTipp('da', 'da')).toBe('offen');
    expect(nachTipp('da', 'weg')).toBe('weg');
    expect(nachTipp('weg', 'weg')).toBe('offen');
  });
});

describe('kurzform', () => {
  it('anwesend, abwesend, offen in der Reihenfolge der Liste, dazu die Gäste', () => {
    const p = personenAus([
      zeile(1, 'present', 'Alwin', 'Friesen'),
      zeile(2, 'absent', 'Peter', 'Wiens'),
      zeile(3, 'unsure', 'Daniel', 'Schmidt'),
    ]);
    expect(kurzform(p, ['Heinrich Janzen'])).toEqual({
      anwesend: ['Alwin Friesen'],
      abwesend: ['Peter Wiens'],
      offen: ['Daniel Schmidt'],
      gaeste: ['Heinrich Janzen'],
    });
  });
});

describe('Gäste (nur im Protokoll)', () => {
  it('lesen: JSON-Liste, getrimmt, ohne Leeres und Doppeltes; Kaputtes ist leer', () => {
    expect(gaesteAus('["  Hans ", "", "Hans", "Erika", 3]')).toEqual(['Hans', 'Erika']);
    expect(gaesteAus('')).toEqual([]);
    expect(gaesteAus('kaputt')).toEqual([]);
    expect(gaesteAus('{"a":1}')).toEqual([]);
    expect(gaesteAus(undefined)).toEqual([]);
  });

  it('schreiben: dieselbe Bereinigung, leer ohne Gäste – und zurückgelesen dasselbe', () => {
    expect(gaesteWert([])).toBe('');
    expect(gaesteWert([' Hans', 'Hans', ''])).toBe('["Hans"]');
    expect(gaesteAus(gaesteWert(['Erika', 'Hans']))).toEqual(['Erika', 'Hans']);
  });
});

describe('Schnappschuss im Protokoll (W16)', () => {
  const live: TreffenStand = {
    abgeschlossen: true,
    begonnen: true,
    personen: [
      { person: 1, name: 'Alwin Friesen', status: 'da' },
      { person: 19, name: 'Spike Musiker', status: 'offen' },
    ],
  };

  it('schreiben und lesen: Person, Name, Status – nichts sonst', () => {
    const wert = schnappschussWert(live);
    expect(JSON.parse(wert)).toEqual({ personen: live.personen });
    expect(schnappschussAus(wert)).toEqual({
      abgeschlossen: false,
      begonnen: true,
      personen: live.personen,
    });
  });

  it('ohne Personen leer; Leeres, Kaputtes und Fremdes ergibt keinen Schnappschuss', () => {
    expect(schnappschussWert({ personen: [] })).toBe('');
    for (const x of ['', 'kaputt{', '[]', '{"personen":3}', 42, null, undefined])
      expect(schnappschussAus(x)).toBeNull();
  });

  it('Einträge ohne Person oder Name fallen weg, unbekannter Status gilt als offen', () => {
    const roh = JSON.stringify({
      personen: [
        { person: 1, name: ' Alwin ', status: 'da' },
        { person: 'x', name: 'Kaputt', status: 'da' },
        { person: 2, name: '', status: 'da' },
        { person: 3, name: 'Peter', status: 'irgendwas' },
      ],
    });
    expect(schnappschussAus(roh)?.personen).toEqual([
      { person: 1, name: 'Alwin', status: 'da' },
      { person: 3, name: 'Peter', status: 'offen' },
    ]);
  });

  it('zumLesen: live, wo lesbar; nicht lesbar → Schnappschuss; ohne Schnappschuss → unbekannt; kein Treffen bleibt null', () => {
    const wert = schnappschussWert(live);
    expect(zumLesen(live, wert)).toBe(live);
    expect(zumLesen('unbekannt', wert)).toEqual(schnappschussAus(wert));
    expect(zumLesen('unbekannt', '')).toBe('unbekannt');
    expect(zumLesen(null, wert)).toBeNull();
  });
});

describe('nurSchnappschussAnders (W16)', () => {
  const anw = (schnappschuss?: string) => ({
    id: 'v',
    type: 'verweis',
    props: { art: 'anwesenheit', ...(schnappschuss === undefined ? {} : { schnappschuss }) },
  });
  const text = (t: string) => ({ id: 'p', type: 'paragraph', content: t });

  it('nur der Schnappschuss neu oder anders: ja – auch tief in Unterpunkten', () => {
    expect(nurSchnappschussAnders([text('a'), anw('')], [text('a'), anw('{"x":1}')])).toBe(true);
    expect(nurSchnappschussAnders([anw()], [anw('{"x":1}')])).toBe(true);
    const tief = (s: string) => [{ ...text('a'), children: [anw(s)] }];
    expect(nurSchnappschussAnders(tief('1'), tief('2'))).toBe(true);
  });

  it('gar nichts anders oder auch etwas anderes: nein', () => {
    expect(nurSchnappschussAnders([anw('1')], [anw('1')])).toBe(false);
    expect(nurSchnappschussAnders([text('a'), anw('1')], [text('b'), anw('2')])).toBe(false);
    expect(nurSchnappschussAnders([anw('1')], [anw('1'), text('neu')])).toBe(false);
  });
});
