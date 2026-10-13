import { describe, expect, it } from 'vitest';
import { diensteAus } from './dienste';

describe('diensteAus', () => {
  it('Form wie an der Test-Instanz gemessen (13.10.2026)', () => {
    const d = diensteAus([
      {
        id: 7,
        name: 'Licht',
        nameTranslated: 'Licht',
        sortKey: 0,
        serviceGroupId: 3,
        groupIds: [7],
      },
      { id: 3, name: 'Leitung', sortKey: 0, serviceGroupId: 1, groupIds: [] },
    ]);
    expect(d.get(7)).toEqual({
      id: 7,
      name: 'Licht',
      dienstgruppeId: 3,
      gruppenIds: [7],
      sortKey: 0,
    });
    expect(d.get(3)?.gruppenIds).toEqual([]);
  });

  it('Reihenfolge der Gemeinde: sortKey, dann Name; ohne sortKey ans Ende', () => {
    const d = diensteAus([
      { id: 9, name: 'Gesang', sortKey: 100 },
      { id: 6, name: 'Ton', sortKey: 0 },
      { id: 4, name: 'Ohne' },
      { id: 7, name: 'Licht', sortKey: 0 },
    ]);
    expect([...d.values()].map((x) => x.name)).toEqual(['Licht', 'Ton', 'Gesang', 'Ohne']);
  });

  it('übersetzter Name vor dem Grundnamen; ohne Namen „Dienst“', () => {
    expect(diensteAus([{ id: 1, name: 'Tech', nameTranslated: 'Technik' }]).get(1)?.name).toBe(
      'Technik',
    );
    expect(diensteAus([{ id: 1, name: 'Tech', nameTranslated: ' ' }]).get(1)?.name).toBe('Tech');
    expect(diensteAus([{ id: 5 }]).get(5)?.name).toBe('Dienst');
  });

  it('ohne ID fällt weg; fehlende Dienstgruppe → null, null in groupIds wird keine 0', () => {
    const d = diensteAus([{ name: 'X' }, { id: 5, groupIds: [null, '4'] }]);
    expect([...d.keys()]).toEqual([5]);
    expect(d.get(5)).toMatchObject({ dienstgruppeId: null, gruppenIds: [4] });
    expect(diensteAus(null).size).toBe(0);
  });
});
