// Die Maße des Liedblatts (mm) – **eine Quelle** für den Satz (`chordPdf.ts`), das Teilen-PDF und die
// Umrechnung der Anmerkungen zwischen A4 und Rolle (`rollenAbbildung.ts`, #614). Stimmten sie nicht
// überein, lägen die Anmerkungen beim Scrollen still daneben.
/** Breite einer Seite (A4 und Rolle). */
export const PAGE_W = 210;
/** Höhe einer A4-Seite. */
export const PAGE_H = 297;
/** Rand links, rechts, oben, unten. */
export const MARGIN = 12;
/** Abstand zwischen zwei Spalten. */
export const COL_GAP = 8;

/** Breite einer Spalte bei `spalten` Spalten. */
export function spaltenBreite(spalten: number): number {
  return (PAGE_W - 2 * MARGIN - (spalten - 1) * COL_GAP) / spalten;
}

/** Linker Rand der Spalte `c`. */
export function spaltenX(c: number, spalten: number): number {
  return MARGIN + c * (spaltenBreite(spalten) + COL_GAP);
}
