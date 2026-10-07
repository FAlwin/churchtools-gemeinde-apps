/**
 * Verfügbarkeit (#177): eigene Abwesenheiten über den eigenen Server – der spricht mit ChurchTools
 * im Namen des angemeldeten Kontos. Kein Excel hier; der Sync ist ein eigener Dienst.
 */
import type { Absence, AbsenceEvent, AbsenceReason, NeueAbsence } from '@shared/types/index';
import { apiFetch } from './api';
import { istExtension, ohneServer } from './ctRuntime';

/** Eigene Abwesenheiten in einem Fenster – ohne Angaben nimmt der Server heute bis in einem Jahr. */
export function getMyAbsences(from?: string, to?: string): Promise<Absence[]> {
  if (istExtension) return ohneServer('Das Eintragen von Abwesenheiten');
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const s = q.toString();
  return apiFetch<Absence[]>(`/api/absences${s ? `?${s}` : ''}`);
}

/** Kommende Termine von heute bis `bis` (`YYYY-MM-DD`) – die Monatsansicht sagt, wie weit sie schaut. */
export function getAbsenceEvents(bis?: string): Promise<AbsenceEvent[]> {
  if (istExtension) return ohneServer('Das Eintragen von Abwesenheiten');
  return apiFetch<AbsenceEvent[]>(`/api/absences/events${bis ? `?to=${bis}` : ''}`);
}

export function getAbsenceReasons(): Promise<AbsenceReason[]> {
  if (istExtension) return ohneServer('Das Eintragen von Abwesenheiten');
  return apiFetch<AbsenceReason[]>('/api/absences/reasons');
}

export function createAbsence(neu: NeueAbsence): Promise<Absence> {
  if (istExtension) return ohneServer('Das Eintragen von Abwesenheiten');
  return apiFetch<Absence>('/api/absences', { method: 'POST', body: JSON.stringify(neu) });
}

/** Ändern = neu anlegen + alten entfernen (ChurchTools kann Abwesenheiten nicht ändern). */
export function updateAbsence(id: number, neu: NeueAbsence): Promise<Absence> {
  if (istExtension) return ohneServer('Das Eintragen von Abwesenheiten');
  return apiFetch<Absence>(`/api/absences/${id}`, { method: 'PUT', body: JSON.stringify(neu) });
}

export function deleteAbsence(id: number): Promise<void> {
  if (istExtension) return ohneServer('Das Eintragen von Abwesenheiten');
  return apiFetch<void>(`/api/absences/${id}`, { method: 'DELETE' });
}
