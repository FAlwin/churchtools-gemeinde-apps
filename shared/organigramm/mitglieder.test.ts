import { describe, expect, it } from 'vitest';
import { istLeitung, mitgliederAus, rollenAus, rollenRang } from './mitglieder';

// Wie gemessen (Test-Instanz 22.10.2026)
const ROLLEN = rollenAus([
  { id: 15, name: 'Mitarbeiter', nameTranslated: 'Mitarbeiter', isLeader: false, sortKey: 0 },
  { id: 16, name: 'Leiter', nameTranslated: 'Leiter', isLeader: true, sortKey: 1 },
  { id: 17, name: 'Co-Leiter', nameTranslated: 'Co-Leiter', isLeader: true, sortKey: 2 },
  { id: 19, name: 'Organisator', nameTranslated: 'Organisator', isLeader: false, sortKey: 4 },
  { id: 35, name: 'leader', nameTranslated: 'Leiter', isLeader: true, sortKey: 1 },
  { id: null, name: 'kaputt' },
]);

describe('rollenAus', () => {
  it('übersetzter Name vor internem (leader → Leiter); Leitung aus isLeader', () => {
    expect(ROLLEN.get(35)).toEqual({ id: 35, name: 'Leiter', leitung: true, sortKey: 1 });
    expect(ROLLEN.get(15)?.leitung).toBe(false);
  });

  it('ohne ID fällt weg; ohne sortKey hinten; ohne Namen „Mitglied“', () => {
    const r = rollenAus([{ id: 1 }]);
    expect(ROLLEN.size).toBe(5);
    expect(r.get(1)).toEqual({ id: 1, name: 'Mitglied', leitung: false, sortKey: 99 });
  });

  it('nur `true` ist Leitung (kein „1“, kein „ja“)', () => {
    expect(rollenAus([{ id: 1, isLeader: 1 }]).get(1)?.leitung).toBe(false);
  });
});

describe('rollenRang / istLeitung', () => {
  const rang = rollenRang(ROLLEN);
  it('Leitung vor allem anderen, je nach sortKey; unbekannt und ohne Rolle ganz hinten', () => {
    const sortiert = [19, 15, null, 17, 999, 16].sort((a, b) => rang(a) - rang(b));
    expect(sortiert).toEqual([16, 17, 15, 19, null, 999]);
  });

  it('istLeitung folgt isLeader – auch beim englisch benannten Typ', () => {
    expect(istLeitung(ROLLEN, 35)).toBe(true);
    expect(istLeitung(ROLLEN, 17)).toBe(true);
    expect(istLeitung(ROLLEN, 19)).toBe(false);
    expect(istLeitung(ROLLEN, null)).toBe(false);
  });
});

describe('mitgliederAus', () => {
  it('nur aktive, nicht beendete; Name, Bild, Initialen', () => {
    const { mitglieder, personen } = mitgliederAus([
      {
        personId: 1,
        person: { title: 'Alwin Friesen', imageUrl: 'https://ct/images/1/abc', initials: 'AF' },
        groupTypeRoleId: 16,
        groupMemberStatus: 'active',
      },
      {
        personId: 2,
        person: { title: 'Bea' },
        groupTypeRoleId: 15,
        groupMemberStatus: 'requested',
      },
      {
        personId: 3,
        person: { title: 'Carl' },
        groupTypeRoleId: 15,
        groupMemberStatus: 'active',
        memberEndDate: '2026-01-01',
      },
      {
        personId: '4',
        person: { title: 'Dora Engel' },
        groupTypeRoleId: '15',
        groupMemberStatus: 'active',
      },
    ]);
    expect(mitglieder).toEqual([
      { personId: 1, rolleId: 16 },
      { personId: 4, rolleId: 15 },
    ]);
    expect(personen).toEqual([
      { id: 1, name: 'Alwin Friesen', bild: 'https://ct/images/1/abc', initialen: 'AF' },
      { id: 4, name: 'Dora Engel', bild: null, initialen: 'DE' },
    ]);
  });

  it('ohne Namen → „Person <ID>“, Initialen „?“; ohne Rolle → null', () => {
    const { mitglieder, personen } = mitgliederAus([{ personId: 9, groupMemberStatus: 'active' }]);
    expect(mitglieder).toEqual([{ personId: 9, rolleId: null }]);
    expect(personen[0]).toEqual({ id: 9, name: 'Person 9', bild: null, initialen: '?' });
  });
});
