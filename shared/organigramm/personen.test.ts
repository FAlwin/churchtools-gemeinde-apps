import { describe, expect, it } from 'vitest';
import { baumAus, elternAus, type OrgGruppe } from './gruppen';
import { rollenAus, rollenRang, type Mitglied } from './mitglieder';
import {
  gruppenLeitung,
  gruppenPersonen,
  kastenRollen,
  rollenZahl,
  teilbaumPersonen,
} from './personen';

const g = (id: number, name: string): OrgGruppe => ({
  id,
  name,
  typId: 2,
  statusId: 1,
  farbe: null,
});
// Technik (7) → Stream (12), Ton (15); Ton → Ton-Kurs (72)
const BAUM = baumAus(
  [g(7, 'Technik'), g(12, 'Stream'), g(15, 'Ton'), g(72, 'Ton-Kurs')],
  elternAus([
    { groupId: 7, children: [12, 15] },
    { groupId: 15, children: [72] },
  ]),
);
// Rollen wie gemessen (Test-Instanz 22.10.2026): Mitarbeiter 0, Leiter 1, Co-Leiter 2 – Leitung zuerst
const ROLLEN = rollenAus([
  { id: 15, name: 'Mitarbeiter', isLeader: false, sortKey: 0 },
  { id: 16, name: 'Leiter', isLeader: true, sortKey: 1 },
  { id: 17, name: 'Co-Leiter', isLeader: true, sortKey: 2 },
  { id: 32, name: 'participant', nameTranslated: 'Teilnehmer', isLeader: false, sortKey: 0 },
]);
const RANG = rollenRang(ROLLEN);
const NAMEN: Record<number, string> = { 1: 'Alwin', 2: 'Bea', 3: 'Carl', 4: 'Dora', 5: 'Emil' };
const name = (id: number) => NAMEN[id];
const m = (personId: number, rolleId: number): Mitglied => ({ personId, rolleId });
const MITGLIEDER = new Map<number, Mitglied[]>([
  [7, [m(3, 15), m(1, 16)]],
  [12, [m(1, 16), m(2, 15)]],
  [15, [m(5, 17), m(2, 15)]],
  [72, [m(4, 32)]],
]);

describe('teilbaumPersonen – jede Person einmal', () => {
  it('Obergruppe listet alle aus dem ganzen Teilbaum, jede einmal (auch aus Unter-Untergruppen)', () => {
    const l = teilbaumPersonen(BAUM[0], MITGLIEDER, name, RANG);
    expect(l.map((x) => x.personId)).toEqual([1, 3, 2, 4, 5]);
  });

  it('Rolle IN dieser Gruppe zählt; wer nur in einer Untergruppe leitet, steht hier ohne Rolle', () => {
    const l = teilbaumPersonen(BAUM[0], MITGLIEDER, name, RANG);
    expect(l[0]).toEqual({ personId: 1, rolleId: 16 });
    expect(l.find((x) => x.personId === 5)).toEqual({ personId: 5, rolleId: null });
  });

  it('Rolle in der Gruppe selbst gewinnt vor „nur über Untergruppe“ (Alwin: Leiter in Technik UND Stream)', () => {
    const l = teilbaumPersonen(BAUM[0], MITGLIEDER, name, RANG);
    expect(l.filter((x) => x.personId === 1)).toHaveLength(1);
  });

  it('Leitung zuerst nach sortKey (Co-Leiter vor Mitarbeiter), ohne Rolle zuletzt', () => {
    const ton = BAUM[0].kinder.find((k) => k.gruppe.id === 15)!;
    const l = teilbaumPersonen(ton, MITGLIEDER, name, RANG);
    expect(l.map((x) => [x.personId, x.rolleId])).toEqual([
      [5, 17],
      [2, 15],
      [4, null],
    ]);
  });

  it('Gruppe ohne Mitglieder und ohne Untergruppen → leer', () => {
    const stream = BAUM[0].kinder.find((k) => k.gruppe.id === 12)!;
    expect(teilbaumPersonen(stream, new Map(), name, RANG)).toEqual([]);
  });
});

describe('gruppenPersonen – eine Gruppe, gleiche Reihenfolge', () => {
  it('Leiter vor Co-Leiter vor Mitarbeiter, dann Name', () => {
    const l = gruppenPersonen([m(3, 15), m(2, 15), m(5, 17), m(4, 16)], name, RANG);
    expect(l.map((x) => x.personId)).toEqual([4, 5, 2, 3]);
  });
});

describe('gruppenLeitung', () => {
  it('nur Leitungs-Rollen, in der Reihenfolge von ChurchTools', () => {
    expect(
      gruppenLeitung([m(2, 15), m(5, 17), m(1, 16)], ROLLEN, name, RANG).map((x) => x.personId),
    ).toEqual([1, 5]);
  });
  it('ohne Leitung → leer; unbekannte Rolle oder keine Rolle zählt nicht', () => {
    expect(
      gruppenLeitung([m(2, 15), m(3, 99), { personId: 4, rolleId: null }], ROLLEN, name, RANG),
    ).toEqual([]);
  });
});

describe('kastenRollen – die Personen einer Gruppe nach Rollen (O7b-6)', () => {
  // Rollen eines Dienstes wie gemessen (Test-Instanz 29.10.2026, `GET /group/roles`, Typ 2): Mitarbeiter ist die
  // Standardrolle mit sortKey 0, Coach ist versteckt.
  const DIENST = rollenAus([
    {
      id: 15,
      name: 'Mitarbeiter',
      nameTranslated: 'Mitarbeiter',
      isLeader: false,
      sortKey: 0,
      groupTypeId: 2,
      isDefault: true,
    },
    {
      id: 16,
      name: 'Leiter',
      nameTranslated: 'Leiter',
      isLeader: true,
      sortKey: 1,
      groupTypeId: 2,
    },
    {
      id: 17,
      name: 'Co-Leiter',
      nameTranslated: 'Co-Leiter',
      isLeader: true,
      sortKey: 2,
      groupTypeId: 2,
    },
    {
      id: 18,
      name: 'Coach',
      nameTranslated: 'Coach',
      isLeader: false,
      sortKey: 3,
      groupTypeId: 2,
      isHidden: true,
    },
    {
      id: 19,
      name: 'Organisator',
      nameTranslated: 'Organisator',
      isLeader: false,
      sortKey: 4,
      groupTypeId: 2,
    },
    {
      id: 32,
      name: 'participant',
      nameTranslated: 'Teilnehmer',
      isLeader: false,
      sortKey: 10,
      groupTypeId: 5,
      isDefault: true,
    },
    {
      id: 35,
      name: 'leader',
      nameTranslated: 'Leiter',
      isLeader: true,
      sortKey: 20,
      groupTypeId: 5,
    },
  ]);
  const N: Record<number, string> = {
    1: 'Alwin',
    2: 'Bea',
    3: 'Carl',
    4: 'Dora',
    5: 'Emil',
    6: 'Finn',
    7: 'Gina',
  };
  const nm = (id: number) => N[id];
  const TEAM = [m(7, 15), m(3, 19), m(1, 17), m(5, 15), m(2, 16), m(6, 18), m(4, 15)];

  it('Leitung zuerst, dann wie ChurchTools sortiert, die Standardrolle zuletzt – niemand fehlt, auch versteckte Rollen nicht', () => {
    const r = kastenRollen(TEAM, DIENST, nm, 'alle');
    expect(r.map((g) => g.rolle)).toEqual([
      'Leiter',
      'Co-Leiter',
      'Coach',
      'Organisator',
      'Mitarbeiter',
    ]);
    expect(r.flatMap((g) => g.namen).sort()).toEqual(Object.values(N).sort());
    expect(r.at(-1)).toEqual({
      rolle: 'Mitarbeiter',
      namen: ['Dora', 'Emil', 'Gina'],
      nurZahl: false,
    });
  });

  it('„Rollen“: die Standardrolle nur als Zahl, alle anderen mit Namen', () => {
    const r = kastenRollen(TEAM, DIENST, nm, 'rollen');
    expect(r.filter((g) => g.nurZahl).map(rollenZahl)).toEqual(['3 Mitarbeiter']);
    expect(r.find((g) => g.rolle === 'Leiter')).toEqual({
      rolle: 'Leiter',
      namen: ['Bea'],
      nurZahl: false,
    });
  });

  it('„Aus“: nichts', () => {
    expect(kastenRollen(TEAM, DIENST, nm, 'aus')).toEqual([]);
  });

  it('Rollennamen so, wie ChurchTools sie zeigt (übersetzt), auch beim Typ mit englischen Namen', () => {
    const r = kastenRollen([m(1, 32), m(2, 35)], DIENST, nm, 'rollen');
    expect(r.map((g) => [g.rolle, g.nurZahl])).toEqual([
      ['Leiter', false],
      ['Teilnehmer', true],
    ]);
  });

  it('eine Rolle, die ChurchTools nicht liefert, steht ganz hinten – die Person fehlt nicht', () => {
    const r = kastenRollen([m(1, 999), m(2, 15), m(3, 16)], DIENST, nm, 'alle');
    expect(r.map((g) => [g.rolle, g.namen])).toEqual([
      ['Leiter', ['Carl']],
      ['Mitarbeiter', ['Bea']],
      ['Mitglied', ['Alwin']],
    ]);
  });
});
