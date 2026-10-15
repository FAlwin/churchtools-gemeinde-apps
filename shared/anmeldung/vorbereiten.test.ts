import { describe, expect, it } from 'vitest';
import {
  fehlendeBedingungen,
  vorgabenText,
  vorgabenVollstaendig,
  vorgabenVorschlag,
  type Stammdaten,
} from './vorbereiten';

/** Stammdaten wie in der Test-Instanz (gelesen 14.10.2026). */
const TEST: Stammdaten = {
  status: [
    { id: 0, name: 'unknown', nameTranslated: 'Unbekannt', isMember: false },
    { id: 1, name: 'status.friend', nameTranslated: 'Freund', isMember: false },
    { id: 2, name: 'status.potential', nameTranslated: 'Interessent', isMember: false },
    { id: 3, name: 'status.member', nameTranslated: 'Mitglied', isMember: true },
  ],
  standorte: [{ id: 0, name: 'Zentrale' }],
  bereiche: [{ id: 1, name: 'Gemeindeliste' }],
};

describe('Vorgaben für neue Personen (A6-2)', () => {
  it('Vorschlag: Interessent, einziger Standort und Bereich – vollständig, in Worten', () => {
    const v = vorgabenVorschlag(TEST);
    expect(v).toEqual({ statusId: 2, campusId: 0, departmentId: 1 });
    expect(vorgabenVollstaendig(v)).toBe(true);
    expect(vorgabenText(v as never, TEST)).toBe('Interessent · Zentrale · Gemeindeliste');
  });
  it('mehrere Standorte oder kein „Interessent“ → nicht vorschlagen, unvollständig', () => {
    const v = vorgabenVorschlag({
      ...TEST,
      status: TEST.status.filter((x) => x.id !== 2),
      standorte: [...TEST.standorte, { id: 5, name: 'Nord' }],
    });
    expect(v).toEqual({ departmentId: 1 });
    expect(vorgabenVollstaendig(v)).toBe(false);
    // Standort 0 ist gültig – nicht mit „fehlt“ verwechseln.
    expect(vorgabenVollstaendig({ statusId: 2, campusId: 0, departmentId: 1 })).toBe(true);
  });
});

describe('fehlendeBedingungen', () => {
  it('nur echte Ursachen, in Worten; Abgeleitetes (canSignUp …) nicht', () => {
    expect(
      fehlendeBedingungen({
        groupHasLeader: false,
        newPersonStatusIsSet: false,
        canSignUp: false,
        canContactLeader: false,
        groupIsActive: true,
      }),
    ).toEqual(['Die Gruppe hat keine Leitung.', 'Für neue Personen fehlt der Status.']);
    expect(fehlendeBedingungen({ ganzNeu: false })).toEqual(['ChurchTools meldet: ganzNeu']);
    expect(fehlendeBedingungen(null)).toEqual([]);
  });
  it('voll mit Warteliste ist kein Fehler; voll ohne Warteliste schon', () => {
    expect(fehlendeBedingungen({ groupIsNotFull: false, groupAllowsWaitinglist: true })).toEqual(
      [],
    );
    expect(fehlendeBedingungen({ groupIsNotFull: false, groupAllowsWaitinglist: false })).toEqual([
      'Alle Plätze sind belegt (ohne Warteliste).',
    ]);
  });
});
