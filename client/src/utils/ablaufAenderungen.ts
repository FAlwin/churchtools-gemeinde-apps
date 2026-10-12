import type { AgendaItem } from '@shared/types/index';

/** Was die Hinweisleiste über dem Ablauf sagt (Alwin, 12.10.2026 – statt Aufleuchten und Zerfallen). */
export interface AblaufAenderungen {
  neu: number;
  /** Geändert oder verschoben, aber nicht neu. */
  geaendert: number;
  /** Titel der entfernten Punkte, in Ablauf-Reihenfolge. */
  entfernt: string[];
}

/**
 * Zählt die Änderungen gegenüber dem zuletzt gesehenen Stand. Entfernt sind die Platzhalter des
 * Servers (`removed`) **und** die Punkte, die erst seit dem Öffnen dazukamen und wieder verschwanden
 * (`lokalEntfernt`, #178) – die kennt der Server nicht, weil sie nie im gesehenen Stand standen.
 */
export function ablaufAenderungen(
  items: AgendaItem[],
  lokalEntfernt: { id: number; title: string }[],
): AblaufAenderungen {
  let neu = 0;
  let geaendert = 0;
  const entfernt: string[] = [];
  const entferntIds = new Set<number>();
  for (const i of items) {
    if (i.removed) {
      entfernt.push(i.title);
      entferntIds.add(i.id);
    } else if (i.neu) neu += 1;
    else if (i.changed) geaendert += 1;
  }
  for (const l of lokalEntfernt) if (!entferntIds.has(l.id)) entfernt.push(l.title);
  return { neu, geaendert, entfernt };
}

/** Gibt es überhaupt etwas zu melden? */
export function hatAenderungen(a: AblaufAenderungen): boolean {
  return a.neu > 0 || a.geaendert > 0 || a.entfernt.length > 0;
}
