import type { Service } from '../types/index';
import type { CtEvent } from './typen';
import { tagAusIso } from './zeit';
import { ctId } from './ctId';
import { MONATE_KURZ } from './datum';
import { terminAdminIds } from './ablaufRecht';

const TZ = 'Europe/Berlin';

function parts(iso: string): { day: string; month: string; weekday: string; time: string } {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('de-DE', { day: '2-digit', timeZone: TZ }).format(d);
  const monthNum = Number(
    new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: TZ }).format(d),
  );
  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(d);
  return { day, month: MONATE_KURZ[monthNum - 1] ?? '', weekday, time: `${time} Uhr` };
}

/** Wandelt ein ChurchTools-Event in unser Service-Format um. */
export function mapEventToService(
  ev: CtEvent,
  songCount: number,
  subtitle: string | null,
  /** Zeitzone der Gemeinde – bestimmt, an welchem TAG ein Termin liegt (#414). */
  zeitzone: string,
): Service {
  const p = parts(ev.startDate);
  const kalenderId = ctId(ev.calendar?.domainIdentifier);
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
