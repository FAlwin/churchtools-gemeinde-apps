import { describe, expect, it } from 'vitest';
import { rollenAus } from '@shared/organigramm/mitglieder';
import { kastenInhalt } from './kastenPersonen';

// Rollen eines Dienstes wie gemessen (Test-Instanz 29.10.2026): Mitarbeiter ist die Standardrolle.
const ROLLEN = rollenAus([
  { id: 15, name: 'Mitarbeiter', isLeader: false, sortKey: 0, groupTypeId: 2, isDefault: true },
  { id: 16, name: 'Leiter', isLeader: true, sortKey: 1, groupTypeId: 2 },
]);
const name = (id: number) => ['', 'Alwin', 'Bea'][id];
const sichtbar = {
  art: 'sichtbar' as const,
  mitglieder: [
    { personId: 2, rolleId: 15 },
    { personId: 1, rolleId: 16 },
  ],
  angefragt: [],
};

describe('kastenInhalt – was unter dem Namen steht (O7b-6)', () => {
  it('lesbar: die Rollen mit ihren Personen', () => {
    expect(kastenInhalt(sichtbar, 'rollen', ROLLEN, name)).toEqual({
      art: 'rollen',
      gruppen: [
        { rolle: 'Leiter', namen: ['Alwin'], nurZahl: false },
        { rolle: 'Mitarbeiter', namen: ['Bea'], nurZahl: true },
      ],
    });
  });

  it('ohne Leserecht ehrlich „nicht sichtbar“, bei einem Aussetzer „gerade nicht ladbar“ – wie in der Präsentation', () => {
    expect(kastenInhalt({ art: 'verborgen' }, 'alle', ROLLEN, name)).toEqual({
      art: 'hinweis',
      text: 'Mitglieder nicht sichtbar',
    });
    expect(kastenInhalt({ art: 'fehler' }, 'rollen', ROLLEN, name)).toEqual({
      art: 'hinweis',
      text: 'Mitglieder gerade nicht ladbar',
    });
  });

  it('nichts bei „Aus“, solange geladen wird und bei einer Gruppe ohne Mitglieder (oft eine Obergruppe)', () => {
    expect(kastenInhalt(sichtbar, 'aus', ROLLEN, name)).toBeNull();
    expect(kastenInhalt({ art: 'verborgen' }, 'aus', ROLLEN, name)).toBeNull();
    expect(kastenInhalt(undefined, 'alle', ROLLEN, name)).toBeNull();
    expect(kastenInhalt({ ...sichtbar, mitglieder: [] }, 'alle', ROLLEN, name)).toBeNull();
  });
});
