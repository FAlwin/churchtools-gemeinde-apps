import { describe, expect, it } from 'vitest';
import { baumAus, elternAus, type OrgGruppe } from './gruppen';
import { rollenAus, rollenRang, type Mitglied } from './mitglieder';
import { gruppenPersonen, teilbaumPersonen } from './personen';

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
