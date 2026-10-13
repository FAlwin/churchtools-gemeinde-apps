/**
 * **Im Gerät merken** – für Ansichtswahl, die nicht über Geräte hinweg gelten muss (Bauplan §3.3: Ansicht
 * und Filter „nur im Gerät“). Jeder Zugriff ist abgesichert: Im privaten Modus oder bei gesperrtem
 * Speicher fehlt `localStorage` – dann gilt die Vorgabe, und Merken entfällt still.
 */

/** Liest `schluessel` und prüft ihn mit `aus`; alles Unlesbare → `vorgabe`. */
export function leseImGeraet<T>(schluessel: string, vorgabe: T, aus: (roh: unknown) => T): T {
  try {
    const roh: unknown = JSON.parse(localStorage.getItem(schluessel) ?? 'null');
    return roh === null ? vorgabe : aus(roh);
  } catch {
    return vorgabe;
  }
}

export function merkeImGeraet(schluessel: string, wert: unknown): void {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // Nicht speicherbar (privater Modus) – die Wahl gilt dann nur bis zum Neuladen.
  }
}

/** Nur die Texte aus einer Liste – für gemerkte Listen, die von Hand verändert sein könnten. */
export function texte(roh: unknown): string[] {
  return Array.isArray(roh) ? roh.filter((x): x is string => typeof x === 'string') : [];
}
