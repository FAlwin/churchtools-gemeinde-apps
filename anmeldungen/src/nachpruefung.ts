/**
 * **Nachprüfung** (A6-5c, #623) – seit A7-1 aus demselben Stand wie die Liste (`mitglieder.ts`). Gerechnet wird in
 * `nachpruefen` (`shared/anmeldung/nachpruefung.ts`).
 */
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import type { Mitgliederstand } from '@shared/anmeldung/liste';
import { nachpruefen, pruefMitgliederAus, type Nachpruefung } from '@shared/anmeldung/nachpruefung';

/** **Die Nachprüfung einer Veranstaltung** aus dem geladenen Stand. */
export function nachpruefungAus(
  e: OeffentlicheEinstellungen,
  stand: Mitgliederstand,
  maxPlaetze: number | null,
): Nachpruefung {
  const mitglieder = pruefMitgliederAus(e, stand);
  return nachpruefen(e, mitglieder, {
    belegt: mitglieder.filter((m) => m.status === 'aktiv').length,
    wartend: mitglieder.filter((m) => m.status === 'wartet').length,
    max: maxPlaetze,
  });
}
