/**
 * Verfügbarkeit (#177): eigene Abwesenheiten. **Auf dem NAS** über den eigenen Server – der spricht mit ChurchTools
 * im Namen des angemeldeten Kontos. **In ChurchTools** (Erweiterung) seit Dienstplaner E7-2b direkt, über denselben
 * Dienst wie der Dienstplaner (`@ui/abwesenheiten/ctDienst`, Regeln in `@shared/absences/abwesenheiten`).
 */
import type { Absence, AbsenceEvent, AbsenceReason, NeueAbsence } from '@shared/types/index';
import { MAX_VORAUS_TAGE } from '@shared/absences/index';
import { heuteImKalender } from '@shared/ct/zeit';
import { plusTage } from '@shared/ct/datum';
import { abwesenheitenDienst } from '@ui/abwesenheiten/ctDienst';
import { ApiError, apiFetch } from './api';
import { istExtension } from './ctRuntime';
import { leser, meinStatus } from './ctLesen';

/** Ohne Angabe: Einträge ab heute ein Jahr, Termine ein halbes Jahr – wie der Server. */
const STANDARD_TERMINE_TAGE = 183;

/** Der direkte Weg in ChurchTools – für die angemeldete Person in der Zeitzone der Gemeinde. */
const ct = abwesenheitenDienst({
  async ich() {
    const s = await meinStatus();
    if (!s.user) throw new ApiError(401, 'Bei ChurchTools nicht angemeldet.');
    return s.user.id;
  },
  zeitzone: leser.zeitzone,
});

/** Eigene Abwesenheiten in einem Fenster – ohne Angaben nimmt der Server heute bis in einem Jahr. */
export function getMyAbsences(from?: string, to?: string): Promise<Absence[]> {
  if (istExtension) {
    const heute = heuteImKalender();
    return ct.meine(from ?? heute, to ?? plusTage(heute, MAX_VORAUS_TAGE - 1));
  }
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const s = q.toString();
  return apiFetch<Absence[]>(`/api/absences${s ? `?${s}` : ''}`);
}

/** Kommende Termine von heute bis `bis` (`YYYY-MM-DD`) – die Monatsansicht sagt, wie weit sie schaut. */
export function getAbsenceEvents(bis?: string): Promise<AbsenceEvent[]> {
  if (istExtension) {
    const heute = heuteImKalender();
    return ct.termine(heute, bis ?? plusTage(heute, STANDARD_TERMINE_TAGE));
  }
  return apiFetch<AbsenceEvent[]>(`/api/absences/events${bis ? `?to=${bis}` : ''}`);
}

export function getAbsenceReasons(): Promise<AbsenceReason[]> {
  if (istExtension) return ct.gruende();
  return apiFetch<AbsenceReason[]>('/api/absences/reasons');
}

export function createAbsence(neu: NeueAbsence): Promise<Absence> {
  if (istExtension) return ct.anlegen(neu);
  return apiFetch<Absence>('/api/absences', { method: 'POST', body: JSON.stringify(neu) });
}

/** Ändern: in ChurchTools derselbe Eintrag (`PUT`); der NAS-Server legt noch neu an und entfernt den alten. */
export function updateAbsence(id: number, neu: NeueAbsence): Promise<Absence> {
  if (istExtension) return ct.aendern(id, neu);
  return apiFetch<Absence>(`/api/absences/${id}`, { method: 'PUT', body: JSON.stringify(neu) });
}

export function deleteAbsence(id: number): Promise<void> {
  if (istExtension) return ct.loeschen(id);
  return apiFetch<void>(`/api/absences/${id}`, { method: 'DELETE' });
}
