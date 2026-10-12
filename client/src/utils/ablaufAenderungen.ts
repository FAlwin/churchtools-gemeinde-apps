import type { AgendaItem } from '@shared/types/index';

/** Was der Hinweis über die Änderungen am Ablauf sagt (Alwin, 12.10.2026 – statt Aufleuchten und Zerfallen). */
export interface AblaufAenderungen {
  neu: number;
  /** Geändert oder verschoben, aber nicht neu. */
  geaendert: number;
  /** Titel der entfernten Punkte, in Ablauf-Reihenfolge. */
  entfernt: string[];
}

/**
 * Was während EINES Besuchs eines Termins als neu, geändert oder entfernt aufgefallen ist.
 *
 * Warum gemerkt und nicht einfach vom Server übernommen: Seit 12.10.2026 gilt ein Stand als „gesehen",
 * sobald er angezeigt wurde (`useMarkSeenAfterShown`) – nicht erst beim Verlassen. Der nächste Abruf
 * markiert deshalb nur noch, was SEITDEM dazukam. Ohne Merker verlören die Punkte von vorhin ihr
 * Schildchen, während man noch draufschaut.
 */
export interface AenderungsMerker {
  eventId: number;
  neu: ReadonlySet<number>;
  geaendert: ReadonlySet<number>;
  /** ID → Titel, in der Reihenfolge, in der sie aufgefallen sind. */
  entfernt: ReadonlyMap<number, string>;
}

export function leererMerker(eventId: number): AenderungsMerker {
  return { eventId, neu: new Set(), geaendert: new Set(), entfernt: new Map() };
}

/**
 * Nimmt einen neuen Stand auf. `lokalEntfernt` sind Punkte, die seit dem letzten Stand verschwunden
 * sind, ohne dass der Server sie kennt (#178 – erst nach dem Gesehen-Stand dazugekommen).
 * Gibt `vorher` unverändert zurück, wenn sich nichts ändert (stabile Identität für React).
 */
export function merkeAenderungen(
  vorher: AenderungsMerker,
  items: AgendaItem[],
  lokalEntfernt: { id: number; title: string }[] = [],
): AenderungsMerker {
  const neu = new Set(vorher.neu);
  const geaendert = new Set(vorher.geaendert);
  const entfernt = new Map(vorher.entfernt);
  const da = new Set<number>();
  for (const i of items) {
    if (i.removed) {
      if (!entfernt.has(i.id)) entfernt.set(i.id, i.title);
      continue;
    }
    da.add(i.id);
    if (i.neu) {
      neu.add(i.id);
      geaendert.delete(i.id);
    } else if (i.changed && !neu.has(i.id)) geaendert.add(i.id);
  }
  for (const l of lokalEntfernt) if (!entfernt.has(l.id)) entfernt.set(l.id, l.title);
  // Wieder aufgetaucht (zurückgeholt) → nicht mehr entfernt. Weg → kein Schildchen mehr.
  for (const id of [...entfernt.keys()]) if (da.has(id)) entfernt.delete(id);
  for (const id of [...neu]) if (!da.has(id)) neu.delete(id);
  for (const id of [...geaendert]) if (!da.has(id)) geaendert.delete(id);

  const gleich =
    gleicheMenge(neu, vorher.neu) &&
    gleicheMenge(geaendert, vorher.geaendert) &&
    [...entfernt.keys()].join() === [...vorher.entfernt.keys()].join();
  return gleich ? vorher : { eventId: vorher.eventId, neu, geaendert, entfernt };
}

function gleicheMenge(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** Die Zahlen und Titel für den Hinweis. */
export function zusammenfassen(m: AenderungsMerker): AblaufAenderungen {
  return { neu: m.neu.size, geaendert: m.geaendert.size, entfernt: [...m.entfernt.values()] };
}

/** Gibt es überhaupt etwas zu melden? */
export function hatAenderungen(a: AblaufAenderungen): boolean {
  return a.neu > 0 || a.geaendert > 0 || a.entfernt.length > 0;
}
