/**
 * **Wer bei einer Einladung eine Mail von ChurchTools bekommt** – die eine Stelle für die Regel „ich bekomme keine“.
 * Wer selbst einlädt, ändert oder löscht, hat sofort zugesagt und bekommt keine Mail (gemessen K2b 28./29.10.2026,
 * W15-0 25.11.2026); jede andere Person bekommt eine. Bis W15-4 stand die Rechnung fünfmal im Code (Festlegen,
 * Bearbeiten, Serie, Löschen, Absagen).
 */

/**
 * Wie viele der Personen eine Mail bekommen: alle außer dem Einlader, jede Person einmal. Einlader bin ich – außer der Termin
 * wird „Im Auftrag von“ jemandem angelegt (`onBehalfOfPid`): Dann ist diese Person der Einlader, und auch ich bekomme eine
 * Mail (gemessen 26.11.2026). Wer ruft, gibt deshalb `imAuftrag ?? ich` mit.
 */
export function mailsAnAndere(personen: readonly number[], einlader: number): number {
  return new Set(personen.filter((p) => p !== einlader)).size;
}
