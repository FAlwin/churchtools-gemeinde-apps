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

/**
 * **Welche Seite gilt im Scroll-Modus** – die in der Bildmitte, am Rand aber die erste bzw. letzte (Scheibe B4,
 * 30.10.2026). Ein kurzes letztes Lied (kürzer als eine halbe Bildschirmhöhe) erreichte die Bildmitte sonst nie:
 * Ganz unten blieb das vorletzte gewählt, Kopf und Ablauf-Leiste zeigten das falsche Lied. Dasselbe ganz oben mit
 * einem kurzen ersten Lied.
 *
 * `oben` sind die Oberkanten der Seiten im Scroll-Inhalt (aufsteigend), `y` die Scroll-Position, `sicht` die Höhe
 * des sichtbaren Bereichs, `gesamt` die Höhe des ganzen Inhalts.
 */
export function seiteInDerMitte(oben: number[], y: number, sicht: number, gesamt: number): number {
  if (oben.length === 0) return 0;
  if (y <= 1) return 0;
  if (y + sicht >= gesamt - 1) return oben.length - 1;
  const mitte = y + sicht / 2;
  let m = 0;
  for (let i = 0; i < oben.length; i++) {
    if (oben[i] <= mitte) m = i;
    else break;
  }
  return m;
}
