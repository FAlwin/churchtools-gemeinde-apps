import { describe, expect, it } from 'vitest';
import { darfAblaeufe, darfAnlegen, darfEinrichten, darfVerschiebenUndLoeschen } from './rechte';

/** Antworten wie gemessen (12.10.2026, Spike in „Technik“ und Admin). */
describe('Rechte (A3, #486)', () => {
  it('anlegen: nur mit der Art „Anmeldung“ in +create group, oder als Gruppen-Admin', () => {
    expect(darfAnlegen({ '+create group': [5] }, {}, 5)).toBe(true);
    expect(darfAnlegen({ '+create group': [1, 2, 3, 4] }, {}, 5)).toBe(false);
    expect(darfAnlegen({ '+create group': 0 }, {}, 5)).toBe(false);
    expect(darfAnlegen({ '+create group': 0 }, { 'administer groups': true }, 5)).toBe(true);
    expect(darfAnlegen(null, null, 5)).toBe(false);
  });
  it('einrichten braucht beides: Infos UND Grundeinstellungen (Status hängt daran)', () => {
    expect(
      darfEinrichten({ '+edit group infos': true, '+edit group basic settings': true }, {}),
    ).toBe(true);
    expect(darfEinrichten({ '+edit group infos': true }, {})).toBe(false);
    expect(darfEinrichten({ '+see persons': 3, '+edit group member fields': 3 }, {})).toBe(false);
    expect(darfEinrichten({}, { 'administer groups': true })).toBe(true);
  });
  it('verschieben und endgültig löschen: nur Gruppen-Admins – der Organisator mit allen Gruppenrechten nicht (gemessen 13.10.)', () => {
    const organisator = {
      'edit group': [129],
      'security level person': [1],
    };
    expect(darfVerschiebenUndLoeschen(organisator)).toBe(false);
    expect(darfVerschiebenUndLoeschen(null)).toBe(false);
    expect(darfVerschiebenUndLoeschen({ 'administer groups': true })).toBe(true);
  });
});

describe('darfAblaeufe (A9-1)', () => {
  it('Recht „Routinen verwalten“ in der Veranstaltung oder Gruppen-Admin – sonst nicht', () => {
    expect(darfAblaeufe({ '+admin routines': true }, {})).toBe(true);
    expect(darfAblaeufe({ '+admin routines': false }, { 'administer groups': true })).toBe(true);
    // Gemessen 24.10.2026: Leitung der Anmeldegruppe ohne das Recht → 403 beim Anlegen.
    expect(darfAblaeufe({ '+admin routines': false, '+edit group infos': true }, {})).toBe(false);
    expect(darfAblaeufe(null, null)).toBe(false);
  });
});
