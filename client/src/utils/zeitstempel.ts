import { tagMonat } from '@shared/ct/datum';
import { gemeindeZeitzone, heuteImKalender, ortszeitAus } from '@shared/ct/zeit';

/**
 * **„Stand" eines Offline-Vorrats, lesbar** – die eine Stelle (#410, Code-Check 23.09.2026).
 *
 * Die Terminliste (Wolke am Termin) und „Mehr → Offline" formatierten `savedAt` je für sich und waren
 * schon auseinandergelaufen: die eine ohne Jahr, die andere mit. Jetzt gilt dieselbe Regel wie beim
 * Datum überall in der App (`tagKurz`): das Jahr nur, wenn es nicht das laufende ist. Seit #847 in der Uhr der
 * Gemeinde (vorher `toLocaleString`, also die des Geräts) – auf `ortszeitAus` gebaut.
 */
export function standKurz(ms: number, heute = new Date(), zeitzone = gemeindeZeitzone()): string {
  const lokal = ortszeitAus(new Date(ms).toISOString(), zeitzone);
  const jahr =
    lokal.slice(0, 4) === heuteImKalender(heute, zeitzone).slice(0, 4) ? '' : lokal.slice(0, 4);
  return `${tagMonat(lokal)}${jahr}, ${lokal.slice(11, 16)}`;
}
