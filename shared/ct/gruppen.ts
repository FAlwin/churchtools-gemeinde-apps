/**
 * Gruppen, Rollen und Mitgliedschaften – **wer gehört zum Team?** Für beide Auslieferungen (#335,
 * Phase 3b-4b). Lag bis dahin in `server/src/services/ctCapabilities.ts`.
 *
 * Hier steht nur das Auswerten der Rohdaten und die Rechte-Regel; geholt wird beim Aufrufer (Server:
 * `ctGet` mit dem Cookie, Browser: `ctAnfrage` mit der Sitzung der Seite).
 */
import type { NoteRolePerm } from '../types/index';

/** Eine aktive Mitgliedschaft: Gruppe + Rolle (`groupTypeRoleId`). */
export interface Mitgliedschaft {
  groupId: number;
  roleId: number;
}

/** Was `GET /api/persons/{id}/groups` je Eintrag liefert (der Rest interessiert nicht). */
export interface RohMitgliedschaft {
  group?: { domainIdentifier?: string | number; title?: string };
  groupTypeRoleId?: number;
  groupMemberStatus?: string;
  memberEndDate?: string | null;
}

/** Zählt die Mitgliedschaft? Nur aktive, nicht beendete – angefragte oder wartende nicht. */
function istAktiv(r: RohMitgliedschaft): boolean {
  return r.groupMemberStatus === 'active' && !r.memberEndDate;
}

/**
 * Aktive Mitgliedschaften als {Gruppe, Rolle}. Die Gruppen-ID steht in `group.domainIdentifier`
 * (String), die Rolle in `groupTypeRoleId`. Nur aktive, nicht beendete Mitgliedschaften zählen.
 */
export function aktiveMitgliedschaften(
  rows: RohMitgliedschaft[] | null | undefined,
): Mitgliedschaft[] {
  const out: Mitgliedschaft[] = [];
  for (const r of rows ?? []) {
    if (!istAktiv(r)) continue;
    const groupId = Number(r.group?.domainIdentifier);
    const roleId = Number(r.groupTypeRoleId);
    if (Number.isInteger(groupId) && Number.isInteger(roleId)) out.push({ groupId, roleId });
  }
  return out;
}

/** Sichtbare Gruppen (id + name), alphabetisch – aus `GET /api/groups`. */
export function gruppenAus(
  rows: { id?: unknown; name?: unknown }[] | null | undefined,
): { id: number; name: string }[] {
  return (rows ?? [])
    .filter(
      (g): g is { id: number; name: string } =>
        Number.isInteger(g.id) && typeof g.name === 'string' && g.name !== '',
    )
    .map((g) => ({ id: g.id, name: g.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/**
 * Rollen einer Gruppe (id = `groupTypeRoleId`, name) – aus `GET /api/groups/{id}/roles`. Versteckte
 * Rollen (`isHidden`) werden ausgelassen.
 */
export function rollenAus(
  rows: { groupTypeRoleId?: unknown; name?: unknown; isHidden?: unknown }[] | null | undefined,
): { id: number; name: string }[] {
  return (rows ?? [])
    .filter(
      (r): r is { groupTypeRoleId: number; name: string } =>
        !r.isHidden &&
        Number.isInteger(r.groupTypeRoleId) &&
        typeof r.name === 'string' &&
        r.name !== '',
    )
    .map((r) => ({ id: r.groupTypeRoleId, name: r.name }));
}

/**
 * Darf der Nutzer Team-Notizen nutzen (eigene teilen + geteilte ansehen)? Je gewählter Gruppe zählt die
 * freigegebene Rolle; leere/fehlende Rollen-Freigabe einer Gruppe = NIEMAND (kein „alle").
 */
export function computeTeamNotesAllowed(
  memberships: Mitgliedschaft[],
  musicianGroupIds: number[],
  noteRoles: NoteRolePerm[],
): boolean {
  const selected = new Set(musicianGroupIds);
  const rolesByGroup = new Map<number, number[]>();
  for (const r of noteRoles) rolesByGroup.set(r.groupId, r.roles);
  return memberships.some(
    (m) => selected.has(m.groupId) && (rolesByGroup.get(m.groupId) ?? []).includes(m.roleId),
  );
}

/**
 * Verfügbarkeit (#177): aktives Mitglied irgendeiner gewählten Gruppe – ohne Rollen-Filter.
 * Leer gewählt = niemand.
 */
export function computeAvailabilityAllowed(
  memberships: Mitgliedschaft[],
  musicianGroupIds: number[],
): boolean {
  const selected = new Set(musicianGroupIds);
  return memberships.some((m) => selected.has(m.groupId));
}

/** Eine eigene Gruppe mit Namen – und ob man sie leitet (Anmeldungen, #474: „Deine Gruppen"). */
export interface MeineGruppe {
  id: number;
  name: string;
  leitung: boolean;
}

/**
 * Die eigenen Gruppen mit Namen, alphabetisch, und ob die Rolle eine **Leitungsrolle** ist.
 *
 * Gemessen an der Test-Instanz (3.137.1, 12.10.2026): `GET /api/persons/{id}/groups` liefert je
 * Mitgliedschaft `group.title` und `groupTypeRoleId`; ob die Rolle leitet, steht nicht dort, sondern in
 * `GET /api/group/roles` (`isLeader`, z. B. „Leiter" und „Co-Leiter" ja, „Mitarbeiter" nein). Eine Rolle,
 * die dort fehlt, gilt nicht als Leitung – lieber eine Leitung zu wenig anzeigen als eine zu viel.
 */
export function meineGruppen(
  rows: RohMitgliedschaft[] | null | undefined,
  rollen: { id?: unknown; isLeader?: unknown }[] | null | undefined,
): MeineGruppe[] {
  const leitend = new Set(
    (rollen ?? []).filter((r) => r.isLeader === true).map((r) => Number(r.id)),
  );
  const out: MeineGruppe[] = [];
  for (const r of rows ?? []) {
    if (!istAktiv(r)) continue;
    const id = Number(r.group?.domainIdentifier);
    const name = typeof r.group?.title === 'string' ? r.group.title.trim() : '';
    if (!Number.isInteger(id) || name === '') continue;
    out.push({ id, name, leitung: leitend.has(Number(r.groupTypeRoleId)) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
