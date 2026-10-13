/**
 * **Termine für die Liste laden** (Bauplan E3-2): `/events` mit den Plätzen; Namen und Dienstgruppen der
 * Dienste kennt schon der Start (`start.dienste`). Die Regeln (eigene Dienste, freie Plätze, Filter) stehen
 * in `shared/dienstplan/termine.ts`.
 *
 * Gemessen an der Live-Instanz (13.10.2026): 14 Termine in 6 Wochen, 171 KB, 0,5 s. Deshalb wird in
 * Schritten von 8 Wochen geladen, nicht alles auf einmal. `to` zählt bei ChurchTools nicht mit (E0).
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { isoTag } from '@shared/ct/zeit';
import { termineAus, type RohTermin, type TerminZeile } from '@shared/dienstplan/termine';
import { planAus, type Plan } from '@shared/dienstplan/plan';
import { planbar, type Start } from './start';

/** Liste (Start, Termine) und Matrix (Planen) – aus derselben Antwort, eine Abfrage für alle drei Reiter. */
export interface TermineDaten {
  zeilen: TerminZeile[];
  plan: Plan;
}

/** Ein Ladeschritt in Wochen. */
export const WOCHEN_JE_SCHRITT = 8;

/**
 * Termine von heute bis `wochen` Wochen voraus. **Wirft**, wenn die Termine nicht als Liste kommen – eine
 * leere Liste hieße „keine Termine“, und das wäre bei einem Aussetzer falsch.
 */
export async function ladeTermine(
  start: Start,
  wochen: number,
  zeitzone: string,
  jetzt = new Date(),
): Promise<TermineDaten> {
  const von = isoTag(jetzt);
  const bis = isoTag(new Date(jetzt.getTime() + wochen * 7 * 86_400_000));
  const termine = await ctDaten<unknown>(`/events?from=${von}&to=${bis}&include=eventServices`);
  if (!Array.isArray(termine)) {
    throw new ApiError(502, 'ChurchTools hat die Termine nicht vollständig geliefert.');
  }
  const roh = termine as RohTermin[];
  return {
    zeilen: termineAus(roh, {
      ichId: start.ichId,
      dienste: start.dienste,
      planbar: (dienst, admin) => planbar(start, dienst, admin),
      zeitzone,
    }),
    plan: planAus(roh, {
      ichId: start.ichId,
      dienste: start.dienste,
      dienstgruppen: start.dienstgruppen,
      zeitzone,
      planbar: (dienst) => planbar(start, dienst),
    }),
  };
}
