/**
 * **Die Einsätze** für Personen, Hinweise und offene Plätze (Bauplan O3): alle Termine von 6 Monaten zurück bis
 * 3 Monate voraus in EINEM Abruf, wie der Dienstplaner (`/events?from&to&include=eventServices`, live gemessen:
 * ~80 Termine in einer Antwort). Ausgewertet wird in `shared/organigramm/einsaetze.ts`.
 *
 * Was ChurchTools liefert, hängt an den Rechten: Ein Mitarbeiter sieht nicht alle Plätze (gemessen O0 §7: 39 von
 * 60). Die Seite zeigt deshalb „soweit ChurchTools sie dir zeigt“.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import type { RohTermin } from '@shared/dienstplan/termine';
import { einsaetzeAus, zeitraum, type Einsaetze } from '@shared/organigramm/einsaetze';

export async function ladeEinsaetze(
  jetzt = new Date(),
  holen: (pfad: string) => Promise<unknown> = (pfad) => ctDaten<unknown>(pfad),
): Promise<Einsaetze> {
  const { von, bis } = zeitraum(jetzt);
  const termine = await holen(`/events?from=${von}&to=${bis}&include=eventServices`);
  if (!Array.isArray(termine)) {
    throw new ApiError(502, 'ChurchTools hat die Termine nicht vollständig geliefert.');
  }
  return einsaetzeAus(termine as RohTermin[], jetzt);
}

/** Wo die Einsätze gerade stehen – Personen, Hinweise und die offenen Plätze im Baum zeigen danach an. */
export type EinsaetzeStand =
  | { art: 'laedt' }
  | { art: 'fertig'; einsaetze: Einsaetze }
  | { art: 'fehler' };
