import { describe, expect, it } from 'vitest';
import { baumAus, elternAus, type OrgGruppe } from './gruppen';
import { hatBereich, imBereich, personenImBereich, sichtbereich } from './sichtbereich';

const g = (id: number): OrgGruppe => ({ id, name: `G${id}`, typId: 2, statusId: 1, farbe: null });
// 10 → 7 → 12; 47 allein
const BAUM = baumAus(
  [g(10), g(7), g(12), g(47)],
  elternAus([
    { groupId: 10, children: [7] },
    { groupId: 7, children: [12] },
  ]),
);

describe('sichtbereich', () => {
  it('Admin → keine Grenze', () => {
    expect(sichtbereich(BAUM, [], true)).toBeNull();
    expect(imBereich(null, 99)).toBe(true);
  });

  it('geleitete Gruppe samt Untergruppen – nicht die Obergruppe, nicht Nachbarn', () => {
    const b = sichtbereich(BAUM, [7], false)!;
    expect([...b].sort((x, y) => x - y)).toEqual([7, 12]);
    expect(imBereich(b, 10)).toBe(false);
    expect(imBereich(b, 47)).toBe(false);
  });

  it('nichts geleitet → leer, also kein Bereich', () => {
    expect(hatBereich(sichtbereich(BAUM, [], false))).toBe(false);
    expect(hatBereich(sichtbereich(BAUM, [12], false))).toBe(true);
  });

  it('unbekannte (nicht sichtbare) geleitete Gruppe zählt nicht', () => {
    expect(sichtbereich(BAUM, [999], false)!.size).toBe(0);
  });
});

describe('personenImBereich', () => {
  const m = new Map([
    [
      7,
      [
        { personId: 1, rolleId: 16 },
        { personId: 2, rolleId: 15 },
      ],
    ],
    [12, [{ personId: 1, rolleId: 15 }]],
    [47, [{ personId: 3, rolleId: 15 }]],
  ]);
  it('jede Person einmal mit allen ihren Gruppen im Bereich', () => {
    const p = personenImBereich(m, new Set([7, 12]));
    expect([...p.keys()]).toEqual([1, 2]);
    expect(p.get(1)!.gruppen).toEqual([
      { gruppeId: 7, rolleId: 16 },
      { gruppeId: 12, rolleId: 15 },
    ]);
  });
});
