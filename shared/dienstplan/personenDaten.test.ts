import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import { abwesenheitenAus, gruppenDerDienste, gruppenMitAbwesenheitsRecht } from './personenDaten';

describe('abwesenheitenAus', () => {
  const eintrag = (id: number, extra: object = {}) => ({
    id,
    person: { domainIdentifier: '12', title: 'Daniel Fink' },
    absenceReason: { nameTranslated: ' Urlaub ' },
    startDate: '2026-12-01',
    endDate: '2026-12-07',
    startTime: null,
    endTime: null,
    ...extra,
  });

  it('liest die Felder, die die Ansicht braucht; Grund getrimmt', () => {
    expect(abwesenheitenAus([eintrag(1)])).toEqual([
      {
        id: 1,
        personId: 12,
        grund: 'Urlaub',
        startDate: '2026-12-01',
        endDate: '2026-12-07',
        startTime: null,
        endTime: null,
      },
    ]);
  });

  it('Uhrzeiten bleiben erhalten; ein Datum mit Uhrzeit wird auf den Tag gekürzt', () => {
    const [a] = abwesenheitenAus([
      eintrag(2, {
        startDate: '2026-12-01T00:00:00Z',
        startTime: '2026-12-01T09:00:00Z',
        endTime: '2026-12-01T11:00:00Z',
      }),
    ]);
    expect(a).toMatchObject({
      startDate: '2026-12-01',
      startTime: '2026-12-01T09:00:00Z',
      endTime: '2026-12-01T11:00:00Z',
    });
  });

  it('eine ID zählt einmal; Einträge ohne Person, ID oder Tage fallen weg; keine Liste → leer', () => {
    expect(abwesenheitenAus([eintrag(1), eintrag(1, { absenceReason: null })])).toHaveLength(1);
    expect(
      abwesenheitenAus([
        eintrag(3, { person: null }),
        { ...eintrag(4), id: null },
        eintrag(5, { startDate: null }),
        'kaputt',
        null,
      ]),
    ).toEqual([]);
    expect(abwesenheitenAus(null)).toEqual([]);
  });

  it('ohne Grund bleibt `grund` null', () => {
    expect(abwesenheitenAus([eintrag(6, { absenceReason: null })])[0].grund).toBeNull();
  });
});

describe('gruppenMitAbwesenheitsRecht', () => {
  it('nur Gruppen mit churchservice["+view absence"] === true', () => {
    const roh = {
      '18': { churchservice: { '+view absence': true } },
      '19': { churchservice: { '+view absence': false } },
      '20': { churchservice: {} },
      '21': { churchdb: { '+view absence': true } }, // falscher Block
      '22': { churchservice: { '+view absence': 'ja' } }, // nicht ausdrücklich true
      x: { churchservice: { '+view absence': true } }, // keine ID
    };
    expect([...gruppenMitAbwesenheitsRecht(roh)]).toEqual([18]);
  });

  it('keine brauchbare Antwort → kein Recht', () => {
    expect(gruppenMitAbwesenheitsRecht(null).size).toBe(0);
    expect(gruppenMitAbwesenheitsRecht([]).size).toBe(0);
    expect(gruppenMitAbwesenheitsRecht({ '3': null }).size).toBe(0);
  });
});

describe('gruppenDerDienste', () => {
  it('jede CT-Gruppe einmal, auch wenn mehrere Dienste an ihr hängen', () => {
    const dienste = diensteAus([
      { id: 1, name: 'Kamera Saal', groupIds: [18], sortKey: 1 },
      { id: 2, name: 'Kamera Studio', groupIds: [18], sortKey: 2 },
      { id: 3, name: 'Café', groupIds: [47, 49], sortKey: 3 },
      { id: 4, name: 'Predigt', groupIds: [], sortKey: 4 },
    ]);
    expect(gruppenDerDienste([...dienste.values()])).toEqual([18, 47, 49]);
  });
});
