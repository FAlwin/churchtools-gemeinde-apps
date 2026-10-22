import { describe, expect, it } from 'vitest';
import { baumAus, elternAus, type OrgGruppe } from './gruppen';
import { rollenAus, type Mitglied } from './mitglieder';
import { bereicheSortiert, praesentationAus } from './praesentation';

const g = (id: number, name: string): OrgGruppe => ({
  id,
  name,
  typId: 2,
  statusId: 1,
  farbe: null,
});
// Gottesdienst (1) → Technik (7) → Ton (15) → Ton-Kurs (72); Gottesdienst → Musik (9)
// Café (30) ohne Untergruppen; Bibel (40) → Hauskreis (41)
const BAUM = baumAus(
  [
    g(1, 'Gottesdienst'),
    g(7, 'Technik'),
    g(15, 'Ton'),
    g(72, 'Ton-Kurs'),
    g(9, 'Musik'),
    g(30, 'Café'),
    g(40, 'Bibel'),
    g(41, 'Hauskreis'),
  ],
  elternAus([
    { groupId: 1, children: [7, 9] },
    { groupId: 7, children: [15] },
    { groupId: 15, children: [72] },
    { groupId: 40, children: [41] },
  ]),
);
const ROLLEN = rollenAus([
  { id: 15, name: 'Mitarbeiter', isLeader: false, sortKey: 0 },
  { id: 16, name: 'Leiter', isLeader: true, sortKey: 1 },
  { id: 17, name: 'Co-Leiter', isLeader: true, sortKey: 2 },
]);
const NAMEN: Record<number, string> = {
  1: 'Alwin',
  2: 'Bea',
  3: 'Carl',
  4: 'Dora',
  5: 'Emil',
  6: 'Fia',
};
const name = (id: number) => NAMEN[id];
const m = (personId: number, rolleId: number): Mitglied => ({ personId, rolleId });
const MITGLIEDER = new Map<number, Mitglied[]>([
  [1, [m(2, 17), m(1, 16)]],
  [7, [m(3, 15), m(5, 16)]],
  [15, [m(4, 15), m(3, 15)]],
  [72, [m(6, 15)]],
  [9, [m(1, 15), m(2, 15)]],
  [30, [m(6, 16), m(5, 15)]],
  // Bibel (40) und Hauskreis (41): Mitglieder nicht sichtbar (fehlen in der Liste)
]);
const P = praesentationAus(BAUM, MITGLIEDER, ROLLEN, name);
const bereich = (n: string) => P.bereiche.find((b) => b.knoten.gruppe.name === n)!;
const ids = (l: readonly Mitglied[]) => l.map((x) => x.personId);
const spalte = (b: string, n: string) =>
  bereich(b).spalten.find((x) => x.knoten.gruppe.name === n)!;

describe('bereicheSortiert – große Bereiche zuerst, dann nach Name', () => {
  it('nach Zahl der Gruppen darunter, bei Gleichstand alphabetisch', () => {
    expect(bereicheSortiert(BAUM).map((b) => b.gruppe.name)).toEqual([
      'Gottesdienst',
      'Bibel',
      'Café',
    ]);
  });
  it('ändert den Baum nicht', () => {
    const vorher = BAUM.map((b) => b.gruppe.id);
    bereicheSortiert(BAUM);
    expect(BAUM.map((b) => b.gruppe.id)).toEqual(vorher);
  });
});

describe('praesentationAus (O4)', () => {
  it('Bereiche in der Reihenfolge des Baums', () => {
    expect(P.bereiche.map((b) => b.knoten.gruppe.name)).toEqual(['Gottesdienst', 'Bibel', 'Café']);
  });

  it('Leitung des Bereichs: nur Leitungs-Rollen, Leiter vor Co-Leiter', () => {
    expect(ids(bereich('Gottesdienst').leitung)).toEqual([1, 2]);
    expect(bereich('Café').leitung.map((x) => x.personId)).toEqual([6]);
  });

  it('Spalten = direkte Gruppen; jede Person des Teilbaums einmal, Leitung dieser Gruppe zuerst', () => {
    // Spalten in der Reihenfolge des Baums (nach Name)
    expect(bereich('Gottesdienst').spalten.map((x) => x.knoten.gruppe.name)).toEqual([
      'Musik',
      'Technik',
    ]);
    const technik = spalte('Gottesdienst', 'Technik');
    const musik = spalte('Gottesdienst', 'Musik');
    // Emil leitet Technik; Carl (Technik + Ton) einmal; Dora (Ton) und Fia (Ton-Kurs) ohne Rolle
    expect(ids(technik.personen)).toEqual([5, 3, 4, 6]);
    expect(technik.personen.find((x) => x.personId === 4)?.rolleId).toBeNull();
    expect(ids(musik.personen)).toEqual([1, 2]);
  });

  it('Untergruppen mit Pfad, je mit ihren eigenen Mitgliedern', () => {
    const technik = spalte('Gottesdienst', 'Technik');
    expect(technik.unter.map((u) => [...u.pfad, u.knoten.gruppe.name].join(' › '))).toEqual([
      'Ton',
      'Ton › Ton-Kurs',
    ]);
    expect(ids(technik.unter[0].personen)).toEqual([3, 4]);
    expect(ids(technik.unter[1].personen)).toEqual([6]);
  });

  it('Bereich ohne Untergruppen ist selbst die einzige Spalte, ohne Untergruppen-Liste', () => {
    const cafe = bereich('Café');
    expect(cafe.spalten).toHaveLength(1);
    expect(cafe.spalten[0].knoten.gruppe.name).toBe('Café');
    expect(ids(cafe.spalten[0].personen)).toEqual([6, 5]);
    expect(cafe.spalten[0].unter).toEqual([]);
  });

  it('Personen im Bereich: jede einmal aus dem ganzen Teilbaum', () => {
    expect(bereich('Gottesdienst').personen).toBe(6);
    expect(bereich('Café').personen).toBe(2);
  });

  it('nicht sichtbare Gruppen: sichtbar = false, null Personen – nie als „leer“ ausgegeben', () => {
    const bibel = bereich('Bibel');
    expect(bibel.sichtbar).toBe(false);
    expect(bibel.personen).toBe(0);
    expect(bibel.spalten[0].sichtbar).toBe(false);
    expect(bereich('Gottesdienst').sichtbar).toBe(true);
    expect(spalte('Gottesdienst', 'Technik').unter.every((u) => u.sichtbar)).toBe(true);
  });

  it('vollständig nur, wenn die Gruppe UND ihr ganzer Teilbaum lesbar sind', () => {
    expect(bereich('Gottesdienst').vollstaendig).toBe(true);
    expect(spalte('Gottesdienst', 'Technik').vollstaendig).toBe(true);
    expect(bereich('Café').vollstaendig).toBe(true);
    // Hauskreis nicht lesbar → Bibel unvollständig, auch wenn Bibel selbst lesbar wäre
    const nurBibel = new Map(MITGLIEDER).set(40, []);
    const p = praesentationAus(BAUM, nurBibel, ROLLEN, name);
    const bibel = p.bereiche.find((b) => b.knoten.gruppe.name === 'Bibel')!;
    expect(bibel.sichtbar).toBe(true);
    expect(bibel.vollstaendig).toBe(false);
    expect(bibel.spalten[0].vollstaendig).toBe(false);
  });

  it('Summen: Gruppen direkt unter den Bereichen, Personen über alle Bereiche jede einmal', () => {
    expect(P.gruppen).toBe(3); // Technik, Musik, Hauskreis
    expect(P.personen).toBe(6); // Fia und Emil sind in Gottesdienst UND Café – trotzdem einmal
  });
});
