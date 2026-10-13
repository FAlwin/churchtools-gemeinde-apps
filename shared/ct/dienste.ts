/**
 * **Die Dienste der Gemeinde** (`GET /services`, Dienstplaner E3-2). Gemessen an der Test-Instanz
 * (13.10.2026): je Dienst `id`, `name`, `serviceGroupId` (Dienstgruppe) und `groupIds` – die
 * ChurchTools-Gruppen, aus denen besetzt wird. Deren Leitung darf den Dienst einteilen (E0).
 */
import { ctId } from './ctId';

export interface Dienst {
  id: number;
  name: string;
  /** Dienstgruppe (`serviceGroupId`); `null`, wenn ChurchTools keine nennt. */
  dienstgruppeId: number | null;
  /** Die ChurchTools-Gruppen des Dienstes (`groupIds`). */
  gruppenIds: number[];
}

interface RohDienst {
  id?: unknown;
  name?: unknown;
  serviceGroupId?: unknown;
  groupIds?: unknown;
}

/** Die Dienste nach ID. Einträge ohne ID fallen weg; ohne Namen heißt der Dienst „Dienst“. */
export function diensteAus(roh: RohDienst[] | null | undefined): Map<number, Dienst> {
  const out = new Map<number, Dienst>();
  for (const r of roh ?? []) {
    const id = ctId(r.id);
    if (id === null) continue;
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Dienst';
    const gruppenIds = Array.isArray(r.groupIds)
      ? r.groupIds.map(ctId).filter((n): n is number => n !== null)
      : [];
    out.set(id, { id, name, dienstgruppeId: ctId(r.serviceGroupId), gruppenIds });
  }
  return out;
}
