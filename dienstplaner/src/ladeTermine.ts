/**
 * **Termine für die Liste laden** (Bauplan E3-2): `/events` mit den Plätzen und `/services` für Namen und
 * Dienstgruppen. Die Regeln (eigene Dienste, freie Plätze, Filter) stehen in `shared/dienstplan/termine.ts`.
 *
 * Gemessen an der Live-Instanz (13.10.2026): 14 Termine in 6 Wochen, 171 KB, 0,5 s. Deshalb wird in
 * Schritten von 8 Wochen geladen, nicht alles auf einmal. `to` zählt bei ChurchTools nicht mit (E0).
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { isoTag } from '@shared/ct/zeit';
import { diensteAus } from '@shared/ct/dienste';
import { darfDienstgruppePlanen } from '@shared/ct/dienstRechte';
import { termineAus, type RohTermin, type TerminZeile } from '@shared/dienstplan/termine';
import type { Start } from './start';

/** Ein Ladeschritt in Wochen. */
export const WOCHEN_JE_SCHRITT = 8;

/**
 * Termine von heute bis `wochen` Wochen voraus. **Wirft**, wenn Termine oder Dienste nicht als Liste
 * kommen – eine leere Liste hieße „keine Termine“, und das wäre bei einem Aussetzer falsch.
 */
export async function ladeTermine(
  start: Start,
  wochen: number,
  zeitzone: string,
  jetzt = new Date(),
): Promise<TerminZeile[]> {
  const von = isoTag(jetzt);
  const bis = isoTag(new Date(jetzt.getTime() + wochen * 7 * 86_400_000));
  const [termine, dienste] = await Promise.all([
    ctDaten<unknown>(`/events?from=${von}&to=${bis}&include=eventServices`),
    ctDaten<unknown>('/services'),
  ]);
  if (!Array.isArray(termine) || !Array.isArray(dienste)) {
    throw new ApiError(502, 'ChurchTools hat die Termine nicht vollständig geliefert.');
  }
  return termineAus(termine as RohTermin[], {
    ichId: start.ichId,
    dienste: diensteAus(dienste as Parameters<typeof diensteAus>[0]),
    planbar: (g) => darfDienstgruppePlanen(start.rechte, g),
    zeitzone,
  });
}
