import { describe, expect, it } from 'vitest';
import { darfEigenesHtml, istAdmin, leitetGruppe, zugangFuer } from './zugang';

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

describe('zugangFuer', () => {
  it('Admin → admin, Leitung → leitung, sonst keiner – der Admin hat Vorrang', () => {
    expect(zugangFuer(true, false)).toBe('admin');
    expect(zugangFuer(true, true)).toBe('admin');
    expect(zugangFuer(false, true)).toBe('leitung');
    expect(zugangFuer(false, false)).toBeNull();
  });
});

describe('darfEigenesHtml', () => {
  it('Admin und Leitung dürfen; wer keinen Zugang hat, nicht (W3b speist hier die Rolle ein)', () => {
    expect(darfEigenesHtml('admin')).toBe(true);
    expect(darfEigenesHtml('leitung')).toBe(true);
    expect(darfEigenesHtml(null)).toBe(false);
  });
});
