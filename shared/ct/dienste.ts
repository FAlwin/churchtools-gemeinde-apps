/**
 * **Die Dienste der Gemeinde** (`GET /services`, Dienstplaner E3). Gemessen an der Test-Instanz
 * (13.10.2026): je Dienst `id`, `name`, `nameTranslated`, `sortKey`, `serviceGroupId` (Dienstgruppe),
 * `groupIds` (die ChurchTools-Gruppen, aus denen besetzt wird – deren Leitung darf einteilen, E0) und
 * `hidePersonName` („Namen verbergen“). Weitere Felder (u. a. `sendServiceRequestEmails`) braucht E4.
 */
import { ctId } from './ctId';

export interface Dienst {
  id: number;
  name: string;
  /** Dienstgruppe (`serviceGroupId`); `null`, wenn ChurchTools keine nennt. */
  dienstgruppeId: number | null;
  /** Die ChurchTools-Gruppen des Dienstes (`groupIds`). */
  gruppenIds: number[];
  /** Reihenfolge in der Gemeinde (`sortKey`); ohne Angabe ans Ende. */
  sortKey: number;
}

interface RohDienst {
  id?: unknown;
  name?: unknown;
  nameTranslated?: unknown;
  sortKey?: unknown;
  serviceGroupId?: unknown;
  groupIds?: unknown;
}

/**
 * Die Dienste nach ID, **in der Reihenfolge der Gemeinde** (`sortKey`, dann Name) – so iteriert die Map.
 * Einträge ohne ID fallen weg; der übersetzte Name geht vor (wie bei den Dienstgruppen), ohne Namen heißt
 * der Dienst „Dienst“.
 */
export function diensteAus(roh: RohDienst[] | null | undefined): Map<number, Dienst> {
  const liste: Dienst[] = [];
  for (const r of roh ?? []) {
    const id = ctId(r.id);
    if (id === null) continue;
    const text = [r.nameTranslated, r.name].find((n) => typeof n === 'string' && n.trim() !== '');
    const gruppenIds = Array.isArray(r.groupIds)
      ? r.groupIds.map(ctId).filter((n): n is number => n !== null)
      : [];
    liste.push({
      id,
      name: typeof text === 'string' ? text.trim() : 'Dienst',
      dienstgruppeId: ctId(r.serviceGroupId),
      gruppenIds,
      sortKey: typeof r.sortKey === 'number' ? r.sortKey : Number.MAX_SAFE_INTEGER,
    });
  }
  liste.sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name, 'de'));
  return new Map(liste.map((d) => [d.id, d]));
}
