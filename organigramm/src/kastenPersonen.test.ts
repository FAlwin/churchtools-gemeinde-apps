import { describe, expect, it } from 'vitest';
import { rollenAus } from '@shared/organigramm/mitglieder';
import { kastenInhalt, pdfPersonenWahl, personenInhalt } from './kastenPersonen';
import type { MitgliederStand } from './ladeMitglieder';

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

describe('personenInhalt und das PDF-Häkchen (O7b-6b)', () => {
  it('EINE Stelle für alle Gruppen: Stand und Namen aus den geladenen Mitgliedern', () => {
    const daten = {
      je: new Map<number, MitgliederStand>([
        [7, sichtbar],
        [12, { art: 'verborgen' }],
      ]),
      personen: new Map([
        [1, { id: 1, name: 'Alwin', bild: null, initialen: 'A' }],
        [2, { id: 2, name: 'Bea', bild: null, initialen: 'B' }],
      ]),
    };
    const inhalt = personenInhalt(daten, ROLLEN, 'alle');
    expect(inhalt(7)).toEqual(kastenInhalt(sichtbar, 'alle', ROLLEN, name));
    expect(inhalt(12)).toEqual({ art: 'hinweis', text: 'Mitglieder nicht sichtbar' });
    expect(inhalt(99)).toBeNull();
    expect(personenInhalt(null, ROLLEN, 'alle')(7)).toBeNull();
  });

  it('das Häkchen zeigt die Stufe des Reiters – bei „Aus“ die Rollen (Alwin, 29.10.2026)', () => {
    expect(pdfPersonenWahl('aus')).toBe('rollen');
    expect(pdfPersonenWahl('rollen')).toBe('rollen');
    expect(pdfPersonenWahl('alle')).toBe('alle');
  });
});
