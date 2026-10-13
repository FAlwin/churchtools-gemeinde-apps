/**
 * **Die Dienstgruppen der Gemeinde** (`GET /servicegroups`, Dienstplaner E2). Gemessen an der
 * Test-Instanz (13.10.2026): Admin und einfaches Mitglied bekommen **dieselbe** vollständige Liste
 * (`id`, `name`, `nameTranslated`, `sortKey`, …) – sie sagt also nichts über Rechte. Wer was planen
 * darf, steht in `/permissions/global` (`dienstRechte.ts`). Einzige Ausnahme: `viewAll` („für alle
 * sichtbar“) – solche Gruppen liefert ChurchTools jedem vollständig (gemessen 13.10.2026).
 */
import { ctId } from './ctId';

export interface Dienstgruppe {
  id: number;
  name: string;
  /** „Für alle sichtbar“ (`viewAll`): ChurchTools zeigt jedem alle Plätze dieser Gruppe. */
  fuerAlle: boolean;
}

interface RohDienstgruppe {
  id?: unknown;
  name?: unknown;
  nameTranslated?: unknown;
  sortKey?: unknown;
  viewAll?: unknown;
}

/**
 * Die Dienstgruppen in der Reihenfolge, die die Gemeinde in ChurchTools eingestellt hat (`sortKey`),
 * mit dem übersetzten Namen, wenn es einen gibt. Einträge ohne ID oder Namen fallen weg.
 */
export function dienstgruppenAus(roh: RohDienstgruppe[] | null | undefined): Dienstgruppe[] {
  const out: (Dienstgruppe & { sortKey: number })[] = [];
  for (const r of roh ?? []) {
    const id = ctId(r.id);
    const text = [r.nameTranslated, r.name].find((n) => typeof n === 'string' && n.trim() !== '');
    if (id === null || typeof text !== 'string') continue;
    const sortKey = typeof r.sortKey === 'number' ? r.sortKey : Number.MAX_SAFE_INTEGER;
    out.push({ id, name: text.trim(), fuerAlle: r.viewAll === true, sortKey });
  }
  return out
    .sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name, 'de'))
    .map(({ id, name, fuerAlle }) => ({ id, name, fuerAlle }));
}
