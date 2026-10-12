/**
 * **Was darf die angemeldete Person?** (A3, #486) – entschieden wird an den Rechten, die ChurchTools
 * selbst meldet, nicht am Rollennamen: Organisatoren sind in ChurchTools keine „Leitung“, dürfen aber
 * anlegen und einrichten (Alwin, 12.10.2026). Gemessen an der Test-Instanz:
 * - `GET /permissions/internal/groups/{team}` → `+create group`: Liste der Gruppenart-Nummern, die man
 *   unter dem Team anlegen darf (Organisator: `[5]`), sonst `0`;
 * - Admins haben dort `0`, aber global `administer groups: true` (`GET /permissions/global`);
 * - in einer Veranstaltung: `+edit group infos` (Beschreibung = unsere Einstellungen) und
 *   `+edit group basic settings` (Plätze, Zeitraum **und** Status – in ChurchTools ein Schalter).
 */
type Rechte = Record<string, unknown> | null | undefined;

/** `administer groups` aus `GET /permissions/global` → `churchdb`. */
export function verwaltetGruppen(global: Rechte): boolean {
  return global?.['administer groups'] === true;
}

/** Darf man unter diesem Team eine Gruppe der Art `typId` anlegen? */
export function darfAnlegen(teamRechte: Rechte, global: Rechte, typId: number): boolean {
  if (verwaltetGruppen(global)) return true;
  const erlaubt = teamRechte?.['+create group'];
  return Array.isArray(erlaubt) && erlaubt.map(Number).includes(typId);
}

/** Darf man die Veranstaltung einrichten (Einstellungen, Plätze, Zeitraum) und freigeben? */
export function darfEinrichten(rechte: Rechte, global: Rechte): boolean {
  if (verwaltetGruppen(global)) return true;
  return rechte?.['+edit group infos'] === true && rechte?.['+edit group basic settings'] === true;
}
