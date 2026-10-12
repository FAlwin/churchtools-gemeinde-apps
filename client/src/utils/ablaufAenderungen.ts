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
 * Was EINE Aktualisierung gebracht hat – für den kurzen Hinweis unten und die Schildchen, die genauso
 * lange stehen und mit ihm verschwinden (Alwin, 12.10.2026: „nur ein kurzer Hinweis und fertig").
 *
 * Es ist bewusst nur dieser eine Schub, nichts Angesammeltes: Seit dem Anzeigen gilt ein Stand als
 * „gesehen" (`useMarkSeenAfterShown`), der nächste Abruf markiert also nur, was seitdem dazukam.
 */
export interface AenderungsMeldung {
  neu: ReadonlySet<number>;
  geaendert: ReadonlySet<number>;
  /** Die entfernten Punkte, in Ablauf-Reihenfolge. */
  entfernt: { id: number; title: string }[];
}

/**
 * Die Meldung aus einem Abruf. `lokalEntfernt` sind Punkte, die seit dem zuletzt gezeigten Stand
 * verschwunden sind, ohne dass der Server sie kennt (#178 – erst nach dem Gesehen-Stand dazugekommen).
 */
export function meldungAus(
  items: AgendaItem[],
  lokalEntfernt: { id: number; title: string }[] = [],
): AenderungsMeldung {
  const neu = new Set<number>();
  const geaendert = new Set<number>();
  const entfernt: { id: number; title: string }[] = [];
  for (const i of items) {
    if (i.removed) entfernt.push({ id: i.id, title: i.title });
    else if (i.neu) neu.add(i.id);
    else if (i.changed) geaendert.add(i.id);
  }
  for (const l of lokalEntfernt) {
    if (!entfernt.some((e) => e.id === l.id)) entfernt.push({ id: l.id, title: l.title });
  }
  return { neu, geaendert, entfernt };
}

/**
 * Ein Abruf, der NICHTS Neues bringt, bricht die laufende Meldung nicht ab – er räumt sie nur auf:
 * Punkte, die wieder da sind (Rückgängig), gelten nicht mehr als entfernt; Punkte, die fehlen,
 * tragen kein Schildchen mehr.
 *
 * Warum überhaupt: Nach dem Gesehen-Merken nimmt die App die Markierungen auch aus ihrem gespeicherten
 * Ablauf (`useMarkSetlistSeen`) – sonst zeigte ein Neuladen binnen 30 s den Hinweis noch einmal. Diese
 * Aktualisierung kommt Sekundenbruchteile nach dem Anzeigen an und dürfte den Hinweis nicht sofort
 * wieder schließen.
 */
export function meldungBereinigen(m: AenderungsMeldung, items: AgendaItem[]): AenderungsMeldung {
  const da = new Set(items.filter((i) => !i.removed).map((i) => i.id));
  return {
    neu: new Set([...m.neu].filter((id) => da.has(id))),
    geaendert: new Set([...m.geaendert].filter((id) => da.has(id))),
    entfernt: m.entfernt.filter((e) => !da.has(e.id)),
  };
}

/**
 * Der gespeicherte Ablauf, nachdem sein Stand als gesehen gemerkt wurde: ohne Markierungen und ohne
 * „entfernt"-Platzhalter. Sonst zeigte ein Neuladen innerhalb der Frische-Zeit (30 s) den Hinweis aus
 * dem Speicher noch einmal – in der Erweiterung schon bei einem kurzen Wechsel der ChurchTools-Seite.
 */
export function ohneMarkierungen(items: AgendaItem[]): AgendaItem[] {
  return items
    .filter((i) => !i.removed)
    .map((i) => (i.changed || i.neu ? { ...i, changed: false, neu: false } : i));
}

/** Die Zahlen und Titel für den Hinweis. */
export function zusammenfassen(m: AenderungsMeldung): AblaufAenderungen {
  return { neu: m.neu.size, geaendert: m.geaendert.size, entfernt: m.entfernt.map((e) => e.title) };
}

/** Gibt es überhaupt etwas zu melden? */
export function hatAenderungen(a: AblaufAenderungen): boolean {
  return a.neu > 0 || a.geaendert > 0 || a.entfernt.length > 0;
}
