/**
 * **In welchen Gruppen habe ich ein gruppeninternes Recht?** – aus `GET /permissions/internal/groups` (alle Gruppen auf
 * einmal: Schlüssel = Gruppen-ID, darin je Modul ein Block wie `churchdb` oder `churchservice`, darin `'+recht': true`).
 *
 * Die EINE Auswertung dieser Liste (Dienstplaner `+view absence`, Protokolle `+admin meetings`). Alles, was nicht
 * ausdrücklich `true` ist, zählt als „kein Recht“ – auch eine Gruppe, die in der Liste fehlt.
 */
import { ctId } from './ctId';

export function gruppenMitRecht(roh: unknown, block: string, recht: string): Set<number> {
  const ja = new Set<number>();
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return ja;
  for (const [schluessel, rechte] of Object.entries(roh as Record<string, unknown>)) {
    const id = ctId(schluessel);
    const b = (rechte as Record<string, unknown> | null)?.[block];
    if (id !== null && b && typeof b === 'object' && (b as Record<string, unknown>)[recht] === true)
      ja.add(id);
  }
  return ja;
}
