import { describe, expect, it } from 'vitest';
import { diensteAus } from './dienste';

describe('diensteAus', () => {
  it('Form wie an der Test-Instanz gemessen (13.10.2026)', () => {
    const d = diensteAus([
      { id: 7, name: 'Licht', serviceGroupId: 3, groupIds: [7] },
      { id: 3, name: 'Leitung', serviceGroupId: 1, groupIds: [] },
    ]);
    expect(d.get(7)).toEqual({ id: 7, name: 'Licht', dienstgruppeId: 3, gruppenIds: [7] });
    expect(d.get(3)?.gruppenIds).toEqual([]);
  });

  it('ohne ID fällt weg; ohne Namen „Dienst“; fehlende Dienstgruppe → null, null in groupIds keine 0', () => {
    const d = diensteAus([{ name: 'X' }, { id: 5, groupIds: [null, '4'] }]);
    expect([...d.keys()]).toEqual([5]);
    expect(d.get(5)).toEqual({ id: 5, name: 'Dienst', dienstgruppeId: null, gruppenIds: [4] });
    expect(diensteAus(null).size).toBe(0);
  });
});
