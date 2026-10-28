/**
 * Monats-Helfer für die Abwesenheiten (#177, Monatsansicht seit 19.09.2026).
 *
 * Ein Monat ist hier ein String `YYYY-MM` – so vergleicht er sich mit `<` wie die `YYYY-MM-DD`-Tage
 * aus ChurchTools, ohne Zeitzone und ohne `Date`-Mitternachts-Fallen (siehe `wochen.ts`). Alles rein
 * und ohne Netz prüfbar.
 */
import { MONATE, MONATE_KURZ } from '@shared/ct/datum';

// Seit 14.10.2026 gemeinsam mit dem Dienstplaner in `shared/ct/datum.ts`.
export { letzterTag, monatPlus } from '@shared/ct/datum';

/** `2026-10-04` → `2026-10`. */
export function monatVon(tag: string): string {
  return tag.slice(0, 7);
}

/** `2026-10` → „Oktober 2026". */
export function monatLabel(monat: string): string {
  return `${MONATE[Number(monat.slice(5, 7)) - 1]} ${monat.slice(0, 4)}`;
}

/** `2026-10` → „Okt" – für die Datumskachel in den Abwesenheiten. */
export function monatNurKurz(monat: string): string {
  return MONATE_KURZ[Number(monat.slice(5, 7)) - 1];
}
