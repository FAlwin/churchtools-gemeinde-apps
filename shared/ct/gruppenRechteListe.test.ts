import { describe, expect, it } from 'vitest';
import { gruppenMitRecht } from './gruppenRechteListe';

/** Form wie gemessen (Test-Instanz, 25.11.2026, `GET /permissions/internal/groups`, ohne `data`-Hülle aus `ctDaten`). */
const ROH = {
  '194': {
    churchdb: { '+admin meetings': true, '+do group meeting': true },
    churchservice: [],
    finance: [],
  },
  '18': {
    churchdb: { '+admin meetings': false, '+do group meeting': true },
    churchservice: { '+view absence': true },
  },
  '20': { churchdb: { '+admin meetings': 'true' } },
};

describe('gruppenMitRecht', () => {
  it('nur Gruppen, in denen das Recht im Block ausdrücklich `true` ist', () => {
    expect([...gruppenMitRecht(ROH, 'churchdb', '+admin meetings')]).toEqual([194]);
    expect([...gruppenMitRecht(ROH, 'churchdb', '+do group meeting')].sort()).toEqual([18, 194]);
    expect([...gruppenMitRecht(ROH, 'churchservice', '+view absence')]).toEqual([18]);
  });
  it('fehlende Gruppe, leerer Block (Liste statt Objekt), Unsinn: kein Recht', () => {
    expect(gruppenMitRecht(ROH, 'churchservice', '+admin meetings').size).toBe(0);
    expect(gruppenMitRecht(null, 'churchdb', '+admin meetings').size).toBe(0);
    expect(gruppenMitRecht([], 'churchdb', '+admin meetings').size).toBe(0);
    expect(
      gruppenMitRecht(
        { x: { churchdb: { '+admin meetings': true } }, '3': null },
        'churchdb',
        '+admin meetings',
      ).size,
    ).toBe(0);
  });
});
