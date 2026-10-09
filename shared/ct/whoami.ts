/**
 * **Wer ist angemeldet?** – die Regel für `/api/whoami`, für Server UND Erweiterung (#381, #463).
 *
 * ChurchTools antwortet ohne gültige Sitzung **nicht mit 401**, sondern mit **HTTP 200** und einem
 * Phantom-Nutzer `{"id":-1,"lastName":"Anonymous"}` (gemessen an 3.136.2, 03.09.2026). **Die ID ist
 * das Merkmal, nicht der Name** – „Anonymous" ist Anzeigetext. Gelesen wird sie mit `ctId`, weil
 * ChurchTools IDs teils als Zeichenkette liefert.
 *
 * Die Regel stand viermal da (`ctAuth.whoami`, `ctLesen.meinStatus`, `ctRuntime.angemeldetePerson`,
 * `personenAblage.meineId`), mit drei verschiedenen Prüfungen – zwei davon nahmen eine ID als
 * Zeichenkette nicht an. Deshalb hier einmal, mit DREI Ausgängen, denn die Aufrufer brauchen sie:
 *
 * - **ID > 0** → angemeldet;
 * - **`0`** → ausdrücklich niemand (der Phantom-Nutzer);
 * - **`null`** → unlesbar. Das ist NICHT „niemand" – vorübergehend ist nicht ungültig; wer abmelden
 *   würde, muss diesen Fall selbst entscheiden.
 */
import { ctId } from './ctId';

/** `daten` ist der ausgepackte Rumpf (`data`). */
export function whoamiId(daten: unknown): number | null {
  const id = ctId((daten as { id?: unknown } | null | undefined)?.id);
  if (id === null) return null;
  return id > 0 ? id : 0;
}
