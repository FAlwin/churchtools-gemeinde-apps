import { describe, expect, it } from 'vitest';
import { rollenAus } from '@shared/organigramm/mitglieder';
import type { PersonenGrenze } from '@shared/organigramm/personen';
import { kastenInhalt, pdfPersonenWahl, personenInhalt, rollenKnopfText } from './kastenPersonen';
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

describe('Rollenfilter im Kästchen (#915)', () => {
  it('abgewählte Rollen fehlen – darunter steht, was ausgeblendet ist, mit Zahl', () => {
    expect(kastenInhalt(sichtbar, 'alle', ROLLEN, name, new Set(['Mitarbeiter']))).toEqual({
      art: 'rollen',
      gruppen: [{ rolle: 'Leiter', namen: ['Alwin'], nurZahl: false }],
      ausgeblendet: 'Mitarbeiter (1) ausgeblendet',
    });
  });

  it('ist alles abgewählt, bleibt nur der Hinweis – die Gruppe sieht nicht leer aus', () => {
    expect(
      kastenInhalt(sichtbar, 'rollen', ROLLEN, name, new Set(['Mitarbeiter', 'Leiter'])),
    ).toEqual({
      art: 'hinweis',
      text: 'Leiter (1), Mitarbeiter (1) ausgeblendet',
    });
  });

  it('eine abgewählte Rolle, die es in der Gruppe nicht gibt, ändert nichts; „nicht sichtbar“ bleibt', () => {
    expect(kastenInhalt(sichtbar, 'rollen', ROLLEN, name, new Set(['Organisator']))).toEqual(
      kastenInhalt(sichtbar, 'rollen', ROLLEN, name),
    );
    expect(kastenInhalt({ art: 'verborgen' }, 'alle', ROLLEN, name, new Set(['Leiter']))).toEqual({
      art: 'hinweis',
      text: 'Mitglieder nicht sichtbar',
    });
  });

  it('Knopf: „Alle“ oder „gewählt von angeboten“ – früher gemerkte, jetzt fehlende Rollen zählen nicht', () => {
    const rollen = [
      { name: 'Leiter', leitung: true },
      { name: 'Mitarbeiter', leitung: false },
    ];
    expect(rollenKnopfText(rollen, new Set())).toBe('Alle');
    expect(rollenKnopfText(rollen, new Set(['Organisator']))).toBe('Alle');
    expect(rollenKnopfText(rollen, new Set(['Mitarbeiter']))).toBe('1 von 2');
  });
});

describe('Grenze im Kästchen (#915 C)', () => {
  const daten = {
    je: new Map<number, MitgliederStand>([
      [1, sichtbar],
      [2, sichtbar],
    ]),
    personen: new Map([
      [1, { id: 1, name: 'Alwin', bild: null, initialen: 'A' }],
      [2, { id: 2, name: 'Bea', bild: null, initialen: 'B' }],
    ]),
  };
  const grenze: PersonenGrenze = (id) => (id === 1 ? 'zahl' : 'alle');

  it('die eigene Wahl gilt höchstens bis zur Grenze der Gruppe – je Gruppe', () => {
    const inhalt = personenInhalt(daten, ROLLEN, 'alle', undefined, grenze);
    expect(inhalt(1)).toEqual({
      art: 'rollen',
      gruppen: [
        { rolle: 'Leiter', namen: ['Alwin'], nurZahl: true },
        { rolle: 'Mitarbeiter', namen: ['Bea'], nurZahl: true },
      ],
    });
    expect(inhalt(2)).toEqual({
      art: 'rollen',
      gruppen: [
        { rolle: 'Leiter', namen: ['Alwin'], nurZahl: false },
        { rolle: 'Mitarbeiter', namen: ['Bea'], nurZahl: false },
      ],
    });
  });

  it('„Keine Personen“ zeigt nichts; die eigene Wahl „Aus“ bleibt aus', () => {
    expect(personenInhalt(daten, ROLLEN, 'alle', undefined, () => 'aus')(1)).toBeNull();
    expect(personenInhalt(daten, ROLLEN, 'aus', undefined, () => 'alle')(1)).toBeNull();
  });
});
