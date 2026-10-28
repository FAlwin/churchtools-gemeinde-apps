/**
 * **Welches Blatt gehört zu einem Ablaufpunkt?** (E6-O O4, Direktlink aus dem Dienstplaner) Die Blätter eines Termins
 * sind die Punkte MIT Lied in Ablauf-Reihenfolge – genau wie `songs` in `App` (`items.flatMap(i => i.song …)`). Hier
 * zählt dieselbe Regel; `null`, wenn der Punkt fehlt oder kein Lied hat (dann zeigt die App den Ablauf).
 */
export function liedZumPunkt(
  items: readonly { id: number; song: unknown }[],
  punktId: number,
): number | null {
  const i = items.filter((p) => p.song).findIndex((p) => p.id === punktId);
  return i >= 0 ? i : null;
}
