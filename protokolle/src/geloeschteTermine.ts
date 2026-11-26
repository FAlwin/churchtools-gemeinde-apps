/**
 * **Gibt es den eingetragenen Termin in ChurchTools noch?** (Reiter „Termine“, entschieden 26.11.2026) – Ein Baustein
 * mit dem Stand „im Kalender“ verweist auf einen Kalendertermin. Wird der in ChurchTools gelöscht, führt „In ChurchTools
 * öffnen“ ins Leere; der Reiter zeigt die Zeile dann wieder als „Noch nicht im Kalender“.
 *
 * **Nur 404 heißt „gelöscht“.** Jeder andere Fehler (403, 5xx, Netz, Zeitüberschreitung, `503` bei unklarer Anmeldung)
 * ist vorübergehend und lässt die Zeile stehen – ein Aussetzer ist kein Beleg (`ApiError` 404 ist die einzige Aussage,
 * dass der Termin weg ist). **Gelesen wird nur:** der gespeicherte Vermerk bleibt, wie er ist, bis jemand neu einträgt.
 */
import { mapLimit } from '@shared/ct/mapLimit';
import { ApiError } from '@ui/ct/fehler';
import { terminPfad, type Leser, type TerminRef } from './termin';

/** Höchstens so viele Abfragen gleichzeitig – wie beim Lesen der Besprechungsanfragen (`lesen.ts`). */
const GLEICHZEITIG = 4;

/**
 * Fragt jeden Termin einmal ab (`lies` = `einmalLesen()` des Ladevorgangs) und meldet jeden, den es nicht mehr gibt,
 * über `onGeloescht` (Adresse = `terminPfad`). Wirft nie: Fehler außer 404 werden verschluckt, weil sie nichts beweisen.
 */
export async function geloeschteTermineSuchen(
  termine: readonly TerminRef[],
  lies: Leser,
  onGeloescht: (pfad: string) => void,
  abgebrochen: () => boolean = () => false,
): Promise<void> {
  // Doppelte Adressen fängt der Leser des Ladevorgangs ab (`einmalLesen`) – hier keine zweite Mechanik.
  const pfade = termine.map(terminPfad);
  await mapLimit(pfade, GLEICHZEITIG, async (pfad) => {
    if (abgebrochen()) return;
    try {
      await lies(pfad);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && !abgebrochen()) onGeloescht(pfad);
    }
  });
}
