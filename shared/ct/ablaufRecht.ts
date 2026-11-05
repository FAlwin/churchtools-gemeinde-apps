/**
 * **Wer darf einen Ablauf bearbeiten?** – die eine Regel für Musik-App und Dienstplaner (Bauplan E6-2a, #635).
 * Gemessen an der Test-Instanz (E6-0, 17.10.2026): ChurchTools lässt bearbeiten, wer
 * 1. Admin ist, **oder**
 * 2. `edit agenda` für den **Kalender dieses Termins** hat (das Recht ist eine Liste von Kalender-IDs), **oder**
 * 3. **Admin dieses Termins** ist (`adminIds`/`eventAdminIds`) – auch ganz ohne `edit agenda`.
 *
 * Vorher prüfte die Musik-App nur „irgendein `edit agenda`“ (`canEditAgendas`): Termin-Admins konnten dort nicht
 * bearbeiten, und wer nur für einen anderen Kalender durfte, sah Knöpfe, die mit 403 endeten.
 */
import type { UserCapabilities } from '../types/index';
import { ctId } from './ctId';

/** Was die Regel aus den Rechten braucht – `ablaufKalender: null` = das Recht gilt für alle Kalender. */
export interface AblaufRechte {
  isAdmin: boolean;
  ablaufKalender: readonly number[] | null;
}

/** Was die Regel vom Termin braucht. */
export interface AblaufTermin {
  kalenderId?: number | null;
  terminAdminIds?: readonly number[];
}

/**
 * Der Kalender eines Termins (`calendar.domainIdentifier`), `null` ohne brauchbare Angabe – eine Stelle dafür (#645;
 * vorher zweimal `ctId(ev.calendar?.domainIdentifier)`). Der Untertitel (`setlistKern`) braucht die rohe Angabe für
 * seinen Pfad und liest sie selbst.
 */
export function kalenderVon(ev: { calendar?: { domainIdentifier?: unknown } }): number | null {
  return ctId(ev.calendar?.domainIdentifier);
}

/** Die Admins eines Termins aus der ChurchTools-Antwort (`adminIds` ∪ `eventAdminIds`), ohne Unbrauchbares. */
export function terminAdminIds(ev: { adminIds?: unknown; eventAdminIds?: unknown }): number[] {
  const ids = new Set<number>();
  for (const liste of [ev.adminIds, ev.eventAdminIds]) {
    if (!Array.isArray(liste)) continue;
    for (const roh of liste) {
      const id = ctId(roh);
      if (id !== null) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Was die Regel vom Termin braucht, aus der ChurchTools-Antwort – eine Stelle für die Termin-Ansicht und die Spalten der
 * Matrix (E6-6a), die beide aus `/events` lesen.
 */
export function ablaufTerminVon(ev: {
  calendar?: { domainIdentifier?: unknown };
  adminIds?: unknown;
  eventAdminIds?: unknown;
}): AblaufTermin {
  return { kalenderId: kalenderVon(ev), terminAdminIds: terminAdminIds(ev) };
}

/** Darf `ichId` den Ablauf dieses Termins bearbeiten? `ichId: null` (unbekannt) zählt nicht als Termin-Admin. */
export function darfAblaufBearbeiten(
  rechte: AblaufRechte,
  termin: AblaufTermin,
  ichId: number | null,
): boolean {
  const kalender = termin.kalenderId ?? null;
  if (kalender !== null && darfAblaufImKalender(rechte, kalender)) return true;
  if (rechte.isAdmin || rechte.ablaufKalender === null) return true;
  // Kalender unbekannt (ältere Server liefern ihn nicht, `Service.kalenderId` ist optional): wie bisher –
  // irgendein `edit agenda` genügt, ChurchTools entscheidet. Sonst verlöre, wer Rechte hat, den Stift.
  if (kalender === null && rechte.ablaufKalender.length > 0) return true;
  return ichId !== null && (termin.terminAdminIds ?? []).includes(ichId);
}

/**
 * Darf man in diesem Kalender Abläufe bearbeiten – unabhängig von einem bestimmten Termin? Der Filter der Terminliste
 * bietet „auch ohne Ablauf“ nur dort an (05.11.2026): Termin-Admins sind hier kein Grund, ihr Recht gilt je Termin.
 */
export function darfAblaufImKalender(rechte: AblaufRechte, kalenderId: number): boolean {
  return (
    rechte.isAdmin || rechte.ablaufKalender === null || rechte.ablaufKalender.includes(kalenderId)
  );
}

/**
 * Die Rechte der Musik-App für die Regel. Kennt der Server `ablaufKalender` noch nicht (ältere Version), gilt
 * `canEditAgendas` wie bisher – lieber ein Knopf, über den ChurchTools entscheidet, als keiner.
 */
export function ablaufRechteAus(
  caps: Pick<UserCapabilities, 'isAdmin' | 'canEditAgendas' | 'ablaufKalender'> | undefined,
): AblaufRechte {
  if (!caps) return { isAdmin: false, ablaufKalender: [] };
  const ablaufKalender =
    caps.ablaufKalender !== undefined ? caps.ablaufKalender : caps.canEditAgendas ? null : [];
  return { isAdmin: caps.isAdmin, ablaufKalender };
}
