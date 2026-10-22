import type { PedalRichtung } from './pedalTasten';
import { SCHRITT_ANTEIL } from './scrollPosition';

/** So viel Luft bleibt über einem angesprungenen Teil (Bildpunkte) – die Überschrift klebt nicht am Rand. */
export const HALTE_LUFT = 8;

/** Unterhalb davon gilt eine Stelle als „schon da“ (Rundung beim Scrollen). */
const SPIEL = 2;

/**
 * **Wohin ein Pedal-Tritt im Scroll-Modus geht** (#609): zur nächsten Halte-Stelle (Teil-Anfang, `----`),
 * wenn sie schon auf dem Bildschirm steht – dann wird nichts übersprungen. Steht sie weiter weg (ein Teil
 * ist länger als der Bildschirm, oder es ist ein hochgeladenes PDF ohne Halte-Stellen), geht es ⅔ weiter,
 * wie bisher. Zurück genauso: zum Anfang des aktuellen bzw. vorigen Teils, wenn er höchstens einen
 * Bildschirm entfernt ist, sonst ⅔ zurück.
 *
 * `oben` ist die jetzige Scroll-Position, `hoehe` die Höhe des Bildschirms, `halte` die Halte-Stellen
 * (Scroll-Positionen, sortiert). Ergebnis: die neue Scroll-Position (das Ende des Inhalts begrenzt der
 * Browser).
 */
export function pedalZiel(
  oben: number,
  hoehe: number,
  halte: readonly number[],
  richtung: PedalRichtung,
): number {
  const schritt = Math.round(hoehe * SCHRITT_ANTEIL);
  if (richtung === 1) {
    const naechste = halte.find((h) => h > oben + SPIEL);
    return naechste !== undefined && naechste <= oben + hoehe ? naechste : oben + schritt;
  }
  let vorige: number | undefined;
  for (const h of halte) if (h < oben - SPIEL) vorige = h;
  return vorige !== undefined && vorige >= oben - hoehe ? vorige : Math.max(0, oben - schritt);
}
