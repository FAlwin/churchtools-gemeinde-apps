import { describe, expect, it } from 'vitest';
import { aktiveMitgliedschaften, meineGruppen, type RohMitgliedschaft } from './gruppen';

/** „Deine Gruppen" der Anmeldungen (#474) – Form der Rohdaten gemessen an der Test-Instanz, 12.10.2026. */
function zeile(
  id: number,
  title: string,
  rolle: number,
  extra: Partial<RohMitgliedschaft> = {},
): RohMitgliedschaft {
  return {
    group: { domainIdentifier: String(id), title },
    groupTypeRoleId: rolle,
    groupMemberStatus: 'active',
    memberEndDate: null,
    ...extra,
  };
}

const ROLLEN = [
  { id: 16, name: 'Leiter', isLeader: true },
  { id: 17, name: 'Co-Leiter', isLeader: true },
  { id: 15, name: 'Mitarbeiter', isLeader: false },
];

describe('meineGruppen', () => {
  it('Name aus group.title, Leitung aus der Rollenliste, alphabetisch', () => {
    expect(
      meineGruppen(
        [zeile(9, 'Lobpreisteam', 16), zeile(7, 'Technik', 15), zeile(3, 'Ältere', 17)],
        ROLLEN,
      ),
    ).toEqual([
      { id: 3, name: 'Ältere', leitung: true },
      { id: 9, name: 'Lobpreisteam', leitung: true },
      { id: 7, name: 'Technik', leitung: false },
    ]);
  });

  it('angefragte, wartende und beendete Mitgliedschaften zählen nicht – wie bei aktiveMitgliedschaften', () => {
    const rows = [
      zeile(1, 'Angefragt', 15, { groupMemberStatus: 'requested' }),
      zeile(2, 'Warteliste', 15, { groupMemberStatus: 'waiting' }),
      zeile(3, 'Vorbei', 15, { memberEndDate: '2026-01-01' }),
      zeile(4, 'Dabei', 15),
    ];
    expect(meineGruppen(rows, ROLLEN).map((g) => g.id)).toEqual([4]);
    expect(aktiveMitgliedschaften(rows).map((m) => m.groupId)).toEqual([4]);
  });

  it('eine unbekannte Rolle ist keine Leitung, ohne Rollenliste auch nicht', () => {
    expect(meineGruppen([zeile(9, 'Lobpreisteam', 99)], ROLLEN)[0].leitung).toBe(false);
    expect(meineGruppen([zeile(9, 'Lobpreisteam', 16)], null)[0].leitung).toBe(false);
  });

  it('ohne Namen oder brauchbare ID fällt die Zeile weg; leere Antwort ergibt leere Liste', () => {
    expect(
      meineGruppen([zeile(9, '  ', 16), { ...zeile(1, 'X', 16), group: { title: 'X' } }], ROLLEN),
    ).toEqual([]);
    expect(meineGruppen(undefined, ROLLEN)).toEqual([]);
  });
});
