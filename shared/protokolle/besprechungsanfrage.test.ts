import { describe, expect, it } from 'vitest';
import {
  anfrageHinweis,
  angefragte,
  kandidatenAus,
  kandidatenFiltern,
  type Kandidat,
} from './besprechungsanfrage';

/** Die Form, die die Test-Instanz am 25.11.2026 lieferte: Alwin einmal ohne, einmal mit Gruppe, dazu Spike. */
const GEMESSEN = [
  {
    type: 'person',
    person: { title: 'Alwin Friesen', domainType: 'person', domainIdentifier: '1' },
  },
  {
    type: 'groupMember',
    groupName: 'TEST Protokolle S2',
    person: { title: 'Spike Musiker', domainType: 'person', domainIdentifier: '19' },
  },
  {
    type: 'groupMember',
    groupName: 'TEST Protokolle S2',
    person: { title: 'Alwin Friesen', domainType: 'person', domainIdentifier: '1' },
  },
];

describe('kandidatenAus', () => {
  it('entdoppelt nach Personen-ID – der Eintrag mit Gruppenname gewinnt, egal in welcher Reihenfolge', () => {
    const erwartet: Kandidat[] = [
      { id: 1, name: 'Alwin Friesen', gruppe: 'TEST Protokolle S2' },
      { id: 19, name: 'Spike Musiker', gruppe: 'TEST Protokolle S2' },
    ];
    expect(kandidatenAus(GEMESSEN)).toEqual(erwartet);
    expect(kandidatenAus([...GEMESSEN].reverse())).toEqual(erwartet);
  });

  it('ohne Gruppe bleibt es ohne Gruppe', () => {
    expect(kandidatenAus([GEMESSEN[0]])).toEqual([{ id: 1, name: 'Alwin Friesen' }]);
  });

  it('nimmt nur Personen (`domainType: person`) – eine Gruppe oder ein Fremdeintrag nicht', () => {
    expect(
      kandidatenAus([
        { person: { title: 'Leitungsteam', domainType: 'group', domainIdentifier: '11' } },
        { person: { title: 'Ohne Nummer', domainType: 'person', domainIdentifier: 'x' } },
        null,
        {},
        GEMESSEN[0],
      ]),
    ).toEqual([{ id: 1, name: 'Alwin Friesen' }]);
  });

  it('keine Liste: leer', () => {
    expect(kandidatenAus(null)).toEqual([]);
    expect(kandidatenAus({})).toEqual([]);
  });

  it('sortiert nach Namen', () => {
    const r = kandidatenAus([
      { person: { title: 'Zora', domainType: 'person', domainIdentifier: '5' } },
      { person: { title: 'Änne', domainType: 'person', domainIdentifier: '6' } },
    ]);
    expect(r.map((k) => k.name)).toEqual(['Änne', 'Zora']);
  });
});

describe('kandidatenFiltern', () => {
  const liste = kandidatenAus(GEMESSEN);
  it('ohne Suche alle', () => expect(kandidatenFiltern(liste, '  ')).toHaveLength(2));
  it('nach Name, Groß-/Kleinschreibung egal', () =>
    expect(kandidatenFiltern(liste, 'spike').map((k) => k.id)).toEqual([19]));
  it('nach Gruppe', () => expect(kandidatenFiltern(liste, 'protokolle s2')).toHaveLength(2));
  it('alle Wörter müssen vorkommen', () => {
    expect(kandidatenFiltern(liste, 'spike friesen')).toEqual([]);
    expect(kandidatenFiltern(liste, 'nirgends')).toEqual([]);
  });
});

describe('angefragte', () => {
  const liste = kandidatenAus(GEMESSEN);
  it('ich bin immer dabei, die Gewählten kommen dazu', () => {
    expect(angefragte(liste, new Set(), 1)).toEqual([1]);
    expect(angefragte(liste, new Set([19]), 1)).toEqual([1, 19]);
  });
  it('wer nicht unter den Kandidaten steht, geht nie mit – auch nicht „ich“', () => {
    expect(angefragte(liste, new Set([99]), 1)).toEqual([1]);
    expect(angefragte(liste, new Set([19]), 7)).toEqual([19]);
  });
});

describe('anfrageHinweis', () => {
  const name = (id: number) => `Person ${id}`;
  it('alle da: kein Hinweis', () =>
    expect(anfrageHinweis({ fehlend: [], unklar: false }, name)).toBeNull());
  it('fehlt jemand: nennt sie', () =>
    expect(anfrageHinweis({ fehlend: [19, 20], unklar: false }, name)).toMatch(
      /Nicht angefragt hat ChurchTools: Person 19, Person 20/,
    ));
  it('Lesen gescheitert: „nicht nachlesen“, nicht „fehlt“', () => {
    const t = anfrageHinweis({ fehlend: [], unklar: true }, name);
    expect(t).toMatch(/nicht nachlesen/);
    expect(t).not.toMatch(/Nicht angefragt hat/);
  });
});
