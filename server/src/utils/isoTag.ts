import { config } from '../config.js';

/**
 * **Ein Zeitpunkt als `YYYY-MM-DD` – die eine Stelle im Server.**
 *
 * Gerechnet wird in **UTC**, und das ist hier richtig: Die Werte gehen als Zeitfenster (`from`/`to`)
 * an ChurchTools, der Server läuft im Container ohne gesetzte Zeitzone, und ein Fenster von einer
 * Woche bis sechs Wochen verträgt eine Stunde Verschiebung. Der **Client** hat dafür eine eigene
 * Stelle (`utils/heute.ts`), die absichtlich LOKAL rechnet: Dort geht es um die Frage, welcher Tag
 * für den Nutzer „heute" ist, und die beantwortet UTC zwischen Mitternacht und 2 Uhr falsch.
 *
 * Bis zum 21.09.2026 stand diese eine Zeile im Server an drei Stellen (`absences`,
 * `setlistController`, `setlistBuilder`) – zusammengeführt im Code-Check.
 */
export { isoTag } from '@shared/ct/zeit';

import { tagAusIso as tagAusIsoIn } from '@shared/ct/zeit';

/** Der Tag eines Zeitpunkts in der Zeitzone der Gemeinde – Regel in `@shared/ct/zeit` (#335). */
export function tagAusIso(zeitpunkt: string, zeitzone: string = config.zeitzone): string {
  return tagAusIsoIn(zeitpunkt, zeitzone);
}
