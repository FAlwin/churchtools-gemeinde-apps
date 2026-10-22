import { describe, expect, it } from 'vitest';
import {
  baumAus,
  baumOhneTypen,
  elternAus,
  knotenNachId,
  nachfahren,
  orgGruppenAus,
  type Knoten,
  type OrgGruppe,
} from './gruppen';

/** Gruppen wie gemessen (Live 19.10.2026): Gottesdienst → Technik → Stream/Ton, Café allein. */
const ROH = [
  {
    id: 10,
    name: 'Gottesdienst',
    information: { groupTypeId: 2, groupStatusId: 1, color: 'lime' },
  },
  { id: 7, name: 'Technik', information: { groupTypeId: 2, groupStatusId: 1, color: 'lime' } },
  { id: 12, name: 'Stream', information: { groupTypeId: 2, groupStatusId: 1, color: 'gray' } },
  { id: 15, name: 'Tontechnik', information: { groupTypeId: 2, groupStatusId: 1, color: 'gray' } },
  { id: 47, name: 'Café Team', information: { groupTypeId: 2, groupStatusId: 1, color: null } },
];
const HIER = [
  { groupId: 10, parents: [], children: [7] },
  { groupId: 7, parents: [10], children: [12, 15] },
  { groupId: 12, parents: [7], children: [] },
  { groupId: 15, parents: [7], children: [] },
];

const namen = (k: Knoten[]): unknown[] =>
  k.map((x) => (x.kinder.length ? [x.gruppe.name, namen(x.kinder)] : x.gruppe.name));

describe('orgGruppenAus', () => {
  it('liest ID, Name, Typ, Status und eigene Farbe; ohne Farbe → null', () => {
    const g = orgGruppenAus(ROH);
    expect(g[0]).toEqual({ id: 10, name: 'Gottesdienst', typId: 2, statusId: 1, farbe: 'lime' });
    expect(g.find((x) => x.id === 47)?.farbe).toBeNull();
  });

  it('ohne ID oder Namen fällt die Zeile weg; IDs als Text zählen, leerer Text nicht', () => {
    const g = orgGruppenAus([
      { id: '5', name: ' Jugend ' },
      { id: null, name: 'ohne' },
      { id: 6, name: '  ' },
      { id: '', name: 'leer' },
    ]);
    expect(g).toEqual([{ id: 5, name: 'Jugend', typId: null, statusId: null, farbe: null }]);
  });

  it('null/undefined → leere Liste', () => {
    expect(orgGruppenAus(null)).toEqual([]);
  });
});

describe('elternAus', () => {
  it('nimmt parents UND children – eine Seite allein reicht (Eintrag ohne parents)', () => {
    const e = elternAus([{ groupId: 10, children: [7] }]);
    expect(e.get(7)).toEqual([10]);
  });

  it('mehrere Obergruppen bleiben erhalten, ohne Doppelte, sortiert', () => {
    const e = elternAus([
      { groupId: 191, parents: [188, 10] },
      { groupId: 188, children: [191] },
    ]);
    expect(e.get(191)).toEqual([10, 188]);
  });

  it('eine Gruppe ist nicht ihre eigene Obergruppe', () => {
    expect(elternAus([{ groupId: 3, parents: [3] }]).get(3)).toBeUndefined();
  });
});

describe('baumAus', () => {
  it('baut den Baum nach Namen; Gruppen ohne Obergruppe sind Wurzeln', () => {
    const b = baumAus(orgGruppenAus(ROH), elternAus(HIER));
    expect(namen(b)).toEqual([
      'Café Team',
      ['Gottesdienst', [['Technik', ['Stream', 'Tontechnik']]]],
    ]);
  });

  it('Obergruppe nicht sichtbar → die Gruppe wird Wurzel statt zu verschwinden', () => {
    const ohneGd = orgGruppenAus(ROH).filter((g) => g.id !== 10);
    const b = baumAus(ohneGd, elternAus(HIER));
    expect(b.map((k) => k.gruppe.name)).toEqual(['Café Team', 'Technik']);
  });

  it('zwei Obergruppen → steht unter beiden (wie in ChurchTools)', () => {
    const g: OrgGruppe[] = [
      { id: 1, name: 'A', typId: null, statusId: null, farbe: null },
      { id: 2, name: 'B', typId: null, statusId: null, farbe: null },
      { id: 3, name: 'C', typId: null, statusId: null, farbe: null },
    ];
    const b = baumAus(g, new Map([[3, [1, 2]]]));
    expect(namen(b)).toEqual([
      ['A', ['C']],
      ['B', ['C']],
    ]);
  });

  it('ein Kreis bricht nicht: keine Gruppe zweimal auf einem Pfad, und ohne Wurzel bleibt der Baum leer', () => {
    const g: OrgGruppe[] = [
      { id: 1, name: 'A', typId: null, statusId: null, farbe: null },
      { id: 2, name: 'B', typId: null, statusId: null, farbe: null },
      { id: 3, name: 'C', typId: null, statusId: null, farbe: null },
    ];
    // 1 → 2 → 3 → 2 (Kreis unterhalb einer echten Wurzel)
    const b = baumAus(
      g,
      new Map([
        [2, [1, 3]],
        [3, [2]],
      ]),
    );
    expect(namen(b)).toEqual([['A', [['B', ['C']]]]]);
  });
});

describe('nachfahren', () => {
  it('alle Gruppen unterhalb, ohne die Wurzel', () => {
    const [, gd] = baumAus(orgGruppenAus(ROH), elternAus(HIER));
    expect(nachfahren(gd).sort((a, b) => a - b)).toEqual([7, 12, 15]);
  });
});

describe('baumOhneTypen', () => {
  const t = (id: number, name: string, typId: number): OrgGruppe => ({
    id,
    name,
    typId,
    statusId: 1,
    farbe: null,
  });
  // Leitung (Typ 2) → Infos (Verteiler, Typ 9) → Archiv (Typ 2); dazu Verteiler „Ankündigungen“ als Wurzel
  const baum = baumAus(
    [t(1, 'Leitung', 2), t(2, 'Infos', 9), t(3, 'Archiv', 2), t(4, 'Ankündigungen', 9)],
    elternAus([
      { groupId: 1, children: [2] },
      { groupId: 2, children: [3] },
    ]),
  );

  it('blendet den Typ samt allem darunter aus – auch als Wurzel', () => {
    expect(namen(baumOhneTypen(baum, new Set([9])))).toEqual(['Leitung']);
  });

  it('ohne Auswahl bleibt alles', () => {
    expect(namen(baumOhneTypen(baum, new Set()))).toEqual(namen(baum));
  });
});

describe('knotenNachId', () => {
  it('findet jede Gruppe, bei zwei Obergruppen den ersten Fund', () => {
    const g3: OrgGruppe[] = [1, 2, 3].map((id) => ({
      id,
      name: String.fromCharCode(64 + id),
      typId: null,
      statusId: null,
      farbe: null,
    }));
    const m = knotenNachId(baumAus(g3, new Map([[3, [1, 2]]])));
    expect([...m.keys()].sort()).toEqual([1, 2, 3]);
    expect(m.get(3)?.gruppe.name).toBe('C');
  });
});
