/**
 * Lokal erkannte „aufgelöst"-Platzhalter (#178).
 *
 * Der Server markiert Löschungen nur gegen die „gesehen"-Basislinie (seit 12.10.2026 der zuletzt
 * angezeigte und gemerkte Stand; vorher der beim Verlassen). Ein Punkt, der erst DANACH hinzukam und
 * wieder gelöscht wird – oder dessen Merken scheiterte –, steht dort nie drin: Für ihn kommt KEIN
 * removed-Platzhalter vom Server, er verschwände kommentarlos.
 * Die Ansicht weiß aber selbst, was sie zuletzt angezeigt hat: dieser Helfer vergleicht den zuletzt
 * angezeigten Stand mit den aktuell vorhandenen IDs und liefert für verschwundene Punkte die
 * Platzhalter-Daten (inkl. Einfüge-Position wie beim Server: hinter dem letzten noch vorhandenen
 * Vorgänger, `null` = ganz vorne).
 */
export interface ShownRow {
  id: number;
  title: string;
}

export function vanishedRows(
  prevRows: ShownRow[],
  presentIds: ReadonlySet<number>,
): { id: number; title: string; afterId: number | null }[] {
  const out: { id: number; title: string; afterId: number | null }[] = [];
  prevRows.forEach((row, i) => {
    if (presentIds.has(row.id)) return;
    let afterId: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (presentIds.has(prevRows[j].id)) {
        afterId = prevRows[j].id;
        break;
      }
    }
    out.push({ id: row.id, title: row.title, afterId });
  });
  return out;
}
