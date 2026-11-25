/**
 * **Wer bei einer Einladung eine Mail von ChurchTools bekommt** – die eine Stelle für die Regel „ich bekomme keine“.
 * Wer selbst einlädt, ändert oder löscht, hat sofort zugesagt und bekommt keine Mail (gemessen K2b 28./29.10.2026,
 * W15-0 25.11.2026); jede andere Person bekommt eine. Bis W15-4 stand die Rechnung fünfmal im Code (Festlegen,
 * Bearbeiten, Serie, Löschen, Absagen).
 */

/** Wie viele der Personen eine Mail bekommen: alle außer mir, jede Person einmal. */
export function mailsAnAndere(personen: readonly number[], ich: number): number {
  return new Set(personen.filter((p) => p !== ich)).size;
}
