import { describe, expect, it } from 'vitest';
import {
  darfAussehenUndMenue,
  darfEigenesHtml,
  istAdmin,
  leitetGruppe,
  schreibtIn,
  zugangFuer,
} from './zugang';
import { MODUL_KUERZEL } from './rechte';

const mitglied = (
  gruppe: number,
  rolle: number,
  status = 'active',
  ende: string | null = null,
) => ({
  group: { domainIdentifier: String(gruppe), title: `Gruppe ${gruppe}` },
  groupTypeRoleId: rolle,
  groupMemberStatus: status,
  memberEndDate: ende,
});
const ROLLEN = [
  { id: 2, isLeader: true },
  { id: 3, isLeader: false },
];

describe('istAdmin', () => {
  it('Admin ist, wer „Gruppen verwalten“ hat (`churchdb → administer groups`)', () => {
    expect(istAdmin({ churchdb: { 'administer groups': true } })).toBe(true);
    expect(istAdmin({ churchdb: { 'administer groups': false } })).toBe(false);
    expect(istAdmin({ churchdb: {} })).toBe(false);
  });

  it('fehlende oder fremde Rechteantwort: kein Admin', () => {
    expect(istAdmin(null)).toBe(false);
    expect(istAdmin(undefined)).toBe(false);
    expect(istAdmin({})).toBe(false);
    expect(istAdmin({ churchcore: { 'administer groups': true } })).toBe(false);
    expect(istAdmin({ churchdb: { 'administer groups': 'true' } })).toBe(false);
  });
});

describe('leitetGruppe', () => {
  it('Leitung der gewählten Gruppe: ja', () => {
    expect(leitetGruppe([mitglied(7, 2)], ROLLEN, 7)).toBe(true);
  });

  it('Mitarbeiter (Rolle ohne Leitung) der Gruppe: nein', () => {
    expect(leitetGruppe([mitglied(7, 3)], ROLLEN, 7)).toBe(false);
  });

  it('Leitung einer ANDEREN Gruppe: nein', () => {
    expect(leitetGruppe([mitglied(9, 2)], ROLLEN, 7)).toBe(false);
  });

  it('nicht mehr aktive oder beendete Mitgliedschaft zählt nicht', () => {
    expect(leitetGruppe([mitglied(7, 2, 'requested')], ROLLEN, 7)).toBe(false);
    expect(leitetGruppe([mitglied(7, 2, 'active', '2026-01-01')], ROLLEN, 7)).toBe(false);
  });

  it('Rolle unbekannt (nicht in der Rollenliste): keine Leitung – lieber eine zu wenig', () => {
    expect(leitetGruppe([mitglied(7, 99)], ROLLEN, 7)).toBe(false);
  });

  it('keine Mitgliedschaften oder keine Rollen: nein', () => {
    expect(leitetGruppe(null, ROLLEN, 7)).toBe(false);
    expect(leitetGruppe([mitglied(7, 2)], null, 7)).toBe(false);
    expect(leitetGruppe([], [], 7)).toBe(false);
  });
});

const KAT = { entwuerfe: 104, veroeffentlicht: 107 };
/** Der Block des Moduls in `GET /permissions/global`, wie ChurchTools ihn liefert (gemessen W3b-0: `create custom data: [104, 107]`). */
const global = (schreiben: Record<string, unknown>) => ({
  [MODUL_KUERZEL]: { view: true, ...schreiben },
});
const schreibt = (ids: number[]) =>
  global({
    'create custom data': ids,
    'edit custom data': ids,
    'delete custom data': ids,
  });

describe('schreibtIn (aus den EIGENEN Rechten)', () => {
  it('liest, wo die Person anlegen, ändern UND löschen darf', () => {
    expect(schreibtIn(schreibt([104, 107]))).toEqual([104, 107]);
    expect(schreibtIn(schreibt([104]))).toEqual([104]);
  });

  it('nur anlegen (ohne ändern/löschen) zählt nicht – Speichern bräche mittendrin ab', () => {
    expect(
      schreibtIn(
        global({
          'create custom data': [104, 107],
          'edit custom data': [104],
          'delete custom data': [104, 107],
        }),
      ),
    ).toEqual([104]);
  });

  it('kein Block des Moduls, fremdes Modul, leere Antwort: keine', () => {
    expect(schreibtIn({})).toEqual([]);
    expect(schreibtIn(null)).toEqual([]);
    expect(schreibtIn({ protokolle: { 'create custom data': [104] } })).toEqual([]);
  });
});

describe('zugangFuer', () => {
  it('Admin → admin, hat Vorrang vor allem (auch ohne Rechte und vor der Einrichtung)', () => {
    expect(zugangFuer(true, [], KAT)).toBe('admin');
    expect(zugangFuer(true, [104, 107], KAT)).toBe('admin');
    expect(zugangFuer(true, [], null)).toBe('admin');
  });

  it('schreibt in Entwürfe UND Veröffentlicht → leitung', () => {
    expect(zugangFuer(false, [104, 107], KAT)).toBe('leitung');
  });

  it('schreibt nur in Entwürfe → redakteur', () => {
    expect(zugangFuer(false, [104], KAT)).toBe('redakteur');
  });

  it('keine Rechte → keiner', () => {
    expect(zugangFuer(false, [], KAT)).toBeNull();
  });

  it('Rechte an FREMDEN Kategorien zählen nicht', () => {
    expect(zugangFuer(false, [1, 2, 3, 999], KAT)).toBeNull();
    expect(zugangFuer(false, [999, 104], KAT)).toBe('redakteur');
  });

  it('nur in „Veröffentlicht“ schreiben (ohne Entwürfe): kein Zugang – der Editor arbeitet in Entwürfen', () => {
    expect(zugangFuer(false, [107], KAT)).toBeNull();
  });

  it('nicht eingerichtet (keine Kategorien): nur der Admin', () => {
    expect(zugangFuer(false, [104, 107], null)).toBeNull();
    expect(zugangFuer(false, [104], { entwuerfe: null, veroeffentlicht: null })).toBeNull();
    expect(zugangFuer(false, [104], { entwuerfe: 104, veroeffentlicht: null })).toBe('redakteur');
  });
});

describe('Was ein Zugang darf (E-W12, E-W22)', () => {
  it('Eigenes HTML: Admin und Leitung, nie ein Redakteur oder wer keinen Zugang hat', () => {
    expect(darfEigenesHtml('admin')).toBe(true);
    expect(darfEigenesHtml('leitung')).toBe(true);
    expect(darfEigenesHtml('redakteur')).toBe(false);
    expect(darfEigenesHtml(null)).toBe(false);
  });

  it('Aussehen, Einstellungen und Menü: Admin und Leitung, nie ein Redakteur', () => {
    expect(darfAussehenUndMenue('admin')).toBe(true);
    expect(darfAussehenUndMenue('leitung')).toBe(true);
    expect(darfAussehenUndMenue('redakteur')).toBe(false);
    expect(darfAussehenUndMenue(null)).toBe(false);
  });
});
