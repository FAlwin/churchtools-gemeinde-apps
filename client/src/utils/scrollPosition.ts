// Scroll-Modus (#551): Position und Pedal-Schritt – getrennt von `ScrollDeck`, damit die Datei nur
// Komponenten exportiert.

/** Ein Pedal-Tritt scrollt diesen Anteil der Bildschirmhöhe (Alwin, 14.10.2026: 85 % war zu weit). */
export const SCHRITT_ANTEIL = 2 / 3;

/**
 * Wo man im Scrollen steht: die Seite oben im Bild und wie weit sie schon hinausgescrollt ist (px) –
 * daraus lässt sich die Stelle genau wiederherstellen. `mitte` ist die Seite in der Bildmitte: Sie gilt
 * als „die sichtbare" (Kopfzeile, Lied-Punkte, und sie öffnet sich zum Malen) – oben steht oft nur
 * noch der Rest der Vorseite.
 */
export interface ScrollPosition {
  seite: number;
  versatz: number;
  mitte: number;
}

export const SCROLL_START: ScrollPosition = { seite: 0, versatz: 0, mitte: 0 };
