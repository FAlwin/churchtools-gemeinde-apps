/**
 * **Welche Farbe ein Dienst in der Ansicht „Personen“ hat** (Wunsch 5, P1) – die EINE Stelle dafür. Die Farben selbst
 * stehen als `.farbe0 …` in `PersonenRaster.module.scss` (die Palette der ChurchTools-Tags); hier steht nur die
 * Zuordnung: **fest, nach der Reihenfolge der Dienste in der Gemeinde** (`/services`, `sortKey` – die Reihenfolge der
 * Matrix), reihum. Die Farbe hängt am Dienst, nicht an der Zeile und nicht am gezeigten Ausschnitt – deshalb zählen alle
 * Dienste der Gemeinde, nicht nur die gezeigten.
 *
 * P3 („Darstellung“: Kürzel und Farben je Dienst einstellen, für alle Planer der Gruppe gespeichert) ersetzt diese
 * Funktion durch die gespeicherte Wahl; `PersonenRaster` fragt nur `farbe(dienstId)`.
 */

/** Wie viele Farben es in `PersonenRaster.module.scss` gibt (`.farbe0 … .farbe{ANZAHL_FARBEN-1}`). */
export const ANZAHL_FARBEN = 8;

/** Die Farbe (0 … `ANZAHL_FARBEN - 1`) je Dienst-ID, reihum in der Reihenfolge von `dienstIds`. */
export function dienstFarben(dienstIds: Iterable<number>): ReadonlyMap<number, number> {
  const je = new Map<number, number>();
  for (const id of dienstIds) if (!je.has(id)) je.set(id, je.size % ANZAHL_FARBEN);
  return je;
}
