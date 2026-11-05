import { describe, expect, it } from 'vitest';
import {
  ctStatus,
  gaesteAus,
  gaesteWert,
  kurzform,
  nachTipp,
  personenAus,
  statusAus,
  treffenStandAus,
  vorbelegung,
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
    expect(vorbelegung(stand(), anfragen)).toEqual([
      { person: 1, status: 'da' },
      { person: 2, status: 'weg' },
    ]);
  });

  it('nicht mehr, sobald am Treffen jemand etwas eingetragen hat oder es abgeschlossen ist', () => {
    expect(vorbelegung(stand(true), anfragen)).toEqual([]);
    expect(vorbelegung(stand(false, true), anfragen)).toEqual([]);
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
