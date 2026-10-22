/**
 * **Mitglieder und Rollen für das Organigramm** (Bauplan O2). Nur das Auswerten; geholt wird beim Aufrufer.
 *
 * Gemessen (Test-Instanz 22.10.2026):
 * - `GET /group/roles` liefert je Rolle `isLeader`, `sortKey` und `nameTranslated` – auch für Typen, deren Rolle
 *   intern englisch heißt (`leader` → „Leiter“). Leitung ist also, was ChurchTools als Leitung markiert, nicht
 *   ein Rollenname. ChurchTools zeigt die Rollen einer Gruppe in dieser Reihenfolge: Leitung zuerst, sonst nach
 *   `sortKey` (Leiter, Co-Leiter, Mitarbeiter, Coach, Organisator).
 * - `GET /groups/{id}/members` liefert je Eintrag `personId`, `person.title` (Name), `person.imageUrl`,
 *   `person.initials`, `groupTypeRoleId`, `groupMemberStatus`, `memberEndDate`.
 */
import { ctId } from '../ct/ctId';

export interface Rolle {
  id: number;
  name: string;
  leitung: boolean;
  sortKey: number;
}

export interface RohRolle {
  id?: unknown;
  name?: unknown;
  nameTranslated?: unknown;
  isLeader?: unknown;
  sortKey?: unknown;
}

export function rollenAus(rows: readonly RohRolle[] | null | undefined): Map<number, Rolle> {
  const m = new Map<number, Rolle>();
  for (const r of rows ?? []) {
    const id = ctId(r.id);
    if (id === null) continue;
    const uebersetzt = typeof r.nameTranslated === 'string' ? r.nameTranslated.trim() : '';
    const roh = typeof r.name === 'string' ? r.name.trim() : '';
    m.set(id, {
      id,
      name: uebersetzt || roh || 'Mitglied',
      leitung: r.isLeader === true,
      sortKey: typeof r.sortKey === 'number' ? r.sortKey : 99,
    });
  }
  return m;
}

/**
 * Der Rang einer Rolle in Listen – Leitung zuerst, dann nach `sortKey`. Unbekannte Rolle (oder `null` = nur über
 * eine Untergruppe dabei) ganz hinten. EINE Regel für Baum, Fenster und Präsentation.
 */
export function rollenRang(rollen: ReadonlyMap<number, Rolle>): (rolleId: number | null) => number {
  return (rolleId) => {
    const r = rolleId === null ? undefined : rollen.get(rolleId);
    if (!r) return 10_000;
    return (r.leitung ? 0 : 1_000) + r.sortKey;
  };
}

export function istLeitung(rollen: ReadonlyMap<number, Rolle>, rolleId: number | null): boolean {
  return rolleId !== null && rollen.get(rolleId)?.leitung === true;
}

export interface Person {
  id: number;
  name: string;
  /** Profilbild aus ChurchTools – `null`, wenn keins hinterlegt ist. */
  bild: string | null;
  initialen: string;
}

export interface Mitglied {
  personId: number;
  /** Rolle in dieser Gruppe – `null` bei Personen, die nur über eine Untergruppe dazukommen. */
  rolleId: number | null;
}

export interface RohMitglied {
  personId?: unknown;
  person?: { title?: unknown; imageUrl?: unknown; initials?: unknown } | null;
  groupTypeRoleId?: unknown;
  groupMemberStatus?: unknown;
  memberEndDate?: unknown;
}

function initialenAus(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Mitglieder einer Gruppe: nur **aktive, nicht beendete** (angefragte oder wartende zählen nicht – wie
 * `aktiveMitgliedschaften` in `shared/ct/gruppen.ts`). Die Personen kommen gleich mit, damit Namen und Bilder an
 * einer Stelle stehen.
 */
export function mitgliederAus(rows: readonly RohMitglied[] | null | undefined): {
  mitglieder: Mitglied[];
  personen: Person[];
} {
  const mitglieder: Mitglied[] = [];
  const personen: Person[] = [];
  for (const r of rows ?? []) {
    if (r.groupMemberStatus !== 'active' || r.memberEndDate) continue;
    const personId = ctId(r.personId);
    if (personId === null) continue;
    const name = typeof r.person?.title === 'string' ? r.person.title.trim() : '';
    const bild = r.person?.imageUrl;
    const initialen = typeof r.person?.initials === 'string' ? r.person.initials.trim() : '';
    mitglieder.push({ personId, rolleId: ctId(r.groupTypeRoleId) });
    personen.push({
      id: personId,
      name: name || `Person ${personId}`,
      bild: typeof bild === 'string' && bild !== '' ? bild : null,
      initialen: initialen || initialenAus(name) || '?',
    });
  }
  return { mitglieder, personen };
}
