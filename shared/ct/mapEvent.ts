import type { Service } from '../types/index';
import type { CtEvent } from './typen';
import { ortszeitAus, tagAusIso } from './zeit';
import { MONATE_KURZ, wochentagName } from './datum';
import { kalenderVon, terminAdminIds } from './ablaufRecht';

/**
 * Tag, Monat, Wochentag und Uhrzeit eines Termins – in der Zeitzone der Gemeinde, wie `date` (#847). Bis zum
 * 05.11.2026 galt `zeitzone` nur für `date`; diese vier standen fest auf Berlin (halb umgesetzte Regel).
 */
function parts(
  iso: string,
  zeitzone: string,
): { day: string; month: string; weekday: string; time: string } {
  const lokal = ortszeitAus(iso, zeitzone);
  return {
    day: lokal.slice(8, 10),
    month: MONATE_KURZ[Number(lokal.slice(5, 7)) - 1] ?? '',
    weekday: wochentagName(lokal.slice(0, 10)),
    time: `${lokal.slice(11, 16)} Uhr`,
  };
}

/** Wandelt ein ChurchTools-Event in unser Service-Format um. */
export function mapEventToService(
  ev: CtEvent,
  songCount: number,
  subtitle: string | null,
  /** Zeitzone der Gemeinde – bestimmt, an welchem TAG ein Termin liegt (#414). */
  zeitzone: string,
): Service {
  const p = parts(ev.startDate, zeitzone);
  const kalenderId = kalenderVon(ev);
  return {
    id: ev.id,
    day: p.day,
    month: p.month,
    weekday: p.weekday,
    name: ev.name,
    subtitle,
    date: tagAusIso(ev.startDate, zeitzone),
    start: ev.startDate,
    time: p.time,
    location: ev.calendar?.title ?? '',
    songCount,
    // Default; der Controller setzt es je Konto anhand des gemerkten Setlist-Stands (#143).
    setlistChanged: false,
    ...(kalenderId !== null ? { kalenderId } : {}),
    terminAdminIds: terminAdminIds(ev),
  };
}
