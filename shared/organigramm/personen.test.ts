import { describe, expect, it } from 'vitest';
import { baumAus, elternAus, type OrgGruppe } from './gruppen';
import { istLeitung, teilbaumPersonen, type Mitglied } from './personen';

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
const NAMEN: Record<number, string> = { 1: 'Alwin', 2: 'Bea', 3: 'Carl', 4: 'Dora', 5: 'Emil' };
const name = (id: number) => NAMEN[id];
const MITGLIEDER = new Map<number, Mitglied[]>([
  [
    7,
    [
      { personId: 3, rolle: 'Mitarbeiter' },
      { personId: 1, rolle: 'Leiter' },
    ],
  ],
  [
    12,
    [
      { personId: 1, rolle: 'Leiter' },
      { personId: 2, rolle: 'Mitarbeiter' },
    ],
  ],
  [
    15,
    [
      { personId: 5, rolle: 'Co-Leiter' },
      { personId: 2, rolle: 'Mitarbeiter' },
    ],
  ],
  [72, [{ personId: 4, rolle: 'Teilnehmer' }]],
]);

describe('teilbaumPersonen – jede Person einmal', () => {
  it('Obergruppe listet alle aus dem ganzen Teilbaum, jede einmal (auch aus Unter-Untergruppen)', () => {
    const l = teilbaumPersonen(BAUM[0], MITGLIEDER, name);
    expect(l.map((m) => m.personId)).toEqual([1, 2, 3, 4, 5]);
  });

  it('Leitung der Gruppe selbst zuerst; Leitung nur in einer Untergruppe zählt hier nicht', () => {
    const l = teilbaumPersonen(BAUM[0], MITGLIEDER, name);
    expect(l[0]).toEqual({ personId: 1, rolle: 'Leiter' });
    // Emil leitet nur „Ton“ → in „Technik“ ohne Rolle, alphabetisch eingereiht
    expect(l.find((m) => m.personId === 5)).toEqual({ personId: 5, rolle: null });
  });

  it('Rolle in der Gruppe selbst gewinnt vor „nur über Untergruppe“ (Alwin: Leiter in Technik UND Stream)', () => {
    const l = teilbaumPersonen(BAUM[0], MITGLIEDER, name);
    expect(l.filter((m) => m.personId === 1)).toHaveLength(1);
  });

  it('Leiter vor Co-Leiter, dann alphabetisch', () => {
    const ton = BAUM[0].kinder.find((k) => k.gruppe.id === 15)!;
    const l = teilbaumPersonen(ton, MITGLIEDER, name);
    expect(l.map((m) => [m.personId, m.rolle])).toEqual([
      [5, 'Co-Leiter'],
      [2, 'Mitarbeiter'],
      [4, null],
    ]);
  });

  it('Gruppe ohne Mitglieder und ohne Untergruppen → leer', () => {
    const stream = BAUM[0].kinder.find((k) => k.gruppe.id === 12)!;
    expect(teilbaumPersonen(stream, new Map(), name)).toEqual([]);
  });
});

describe('istLeitung', () => {
  it('Leiter, Co-Leiter und das englische „leader“ – sonst nichts', () => {
    expect(istLeitung('Leiter')).toBe(true);
    expect(istLeitung('Co-Leiter')).toBe(true);
    // Veranstaltung/Verteiler heißen in ChurchTools englisch (live gemessen 19.10.2026)
    expect(istLeitung('leader')).toBe(true);
    expect(istLeitung('participant')).toBe(false);
    expect(istLeitung('Organisator')).toBe(false);
    expect(istLeitung(null)).toBe(false);
  });
});
