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

/** Darf `ichId` den Ablauf dieses Termins bearbeiten? `ichId: null` (unbekannt) zählt nicht als Termin-Admin. */
export function darfAblaufBearbeiten(
  rechte: AblaufRechte,
  termin: AblaufTermin,
  ichId: number | null,
): boolean {
  if (rechte.isAdmin) return true;
  if (rechte.ablaufKalender === null) return true;
  const kalender = termin.kalenderId ?? null;
  // Kalender unbekannt (ältere Server liefern ihn nicht, `Service.kalenderId` ist optional): wie bisher –
  // irgendein `edit agenda` genügt, ChurchTools entscheidet. Sonst verlöre, wer Rechte hat, den Stift.
  if (
    kalender === null ? rechte.ablaufKalender.length > 0 : rechte.ablaufKalender.includes(kalender)
  ) {
    return true;
  }
  return ichId !== null && (termin.terminAdminIds ?? []).includes(ichId);
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
