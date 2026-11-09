import { kalenderVon } from './ablaufRecht';

/**
 * **Filter nach Kalender – die Regeln für alle Apps** (Dienstplaner Wunsch 6, 09.11.2026).
 *
 * Die Terminliste der Musik-App filtert seit 05.11.2026 nach Kalender (`client/src/utils/kalenderFilter.ts`, dort
 * zusätzlich „auch ohne Ablauf“). Der Dienstplaner bekommt denselben Abschnitt im Filter – damit beide dieselbe Regel
 * haben, stehen die gemeinsamen Teile hier: welcher Termin sichtbar ist und welche Kalender im Filter stehen.
 *
 * Anlass (Alwin, 09.11.2026): Gottesdienste werden oft umbenannt („Ostergottesdienst“), der Name taugt dann nicht zum
 * Filtern. Gemessen an der Live-Instanz: Außer dem Kalender kennt ChurchTools an einem Termin keine Kategorie.
 */

/** Der Kalender eines Termins mit Namen, wie ChurchTools ihn am Termin mitschickt. */
export interface TerminKalender {
  id: number;
  name: string;
}

/**
 * Der Kalender aus einem Termin (`calendar.domainIdentifier` + `calendar.title`) – `null` ohne brauchbare ID. Die ID
 * über `kalenderVon`, wie die Ablauf-Rechte sie lesen.
 */
export function terminKalenderAus(ev: {
  calendar?: { domainIdentifier?: unknown; title?: unknown };
}): TerminKalender | null {
  const id = kalenderVon(ev);
  if (id === null) return null;
  const titel = ev.calendar?.title;
  return { id, name: typeof titel === 'string' && titel.trim() !== '' ? titel : `Kalender ${id}` };
}

/** Ist der Kalender eingeblendet? Ein Termin ohne bekannten Kalender steht immer da – er ließe sich sonst nie zeigen. */
export function kalenderSichtbar(
  kalenderId: number | null | undefined,
  aus: readonly number[],
): boolean {
  return kalenderId === null || kalenderId === undefined || !aus.includes(kalenderId);
}

/**
 * Welche Kalender im Filter stehen: die der Termine und die ausgeblendeten (sonst ließe sich ein Kalender ohne
 * sichtbaren Termin nie wieder einschalten), dazu `weitere`. Nach Namen sortiert; ohne Namen steht die Nummer da.
 */
export function kalenderZumFiltern(
  kalenderIds: Iterable<number>,
  name: (id: number) => string | undefined,
  aus: readonly number[],
): TerminKalender[] {
  return [...new Set([...kalenderIds, ...aus])]
    .map((id) => ({ id, name: name(id) ?? `Kalender ${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Gemerkte Kalender-IDs, geprüft – nur ganze Zahlen über 0, ohne Doppelte (von Hand veränderte Speicher). */
export function kalenderIdsAus(roh: unknown): number[] {
  return Array.isArray(roh)
    ? [...new Set(roh.filter((x): x is number => Number.isInteger(x) && (x as number) > 0))]
    : [];
}
