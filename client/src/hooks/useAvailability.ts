import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/availability';

/** Ein Schlüssel-Stamm für alles, was nach einem Schreibvorgang neu geholt werden muss. */
export const ABSENCES_KEY = ['absences'] as const;

/**
 * Eigene Abwesenheiten in einem Fenster. Die Seite „Einträge" zeigt auch **Vergangenes** („Früher",
 * Wunsch Alwin 19.09.2026) – deshalb reicht das Fenster ein Jahr zurück, nicht nur voraus.
 */
export function useMyAbsences(enabled: boolean, from?: string, to?: string) {
  return useQuery({
    queryKey: [...ABSENCES_KEY, 'mine', from ?? '', to ?? ''],
    queryFn: () => api.getMyAbsences(from, to),
    enabled,
    staleTime: 30_000,
  });
}

/** Kommende Termine bis `bis` – so weit, wie das Monatsraster reicht. */
export function useAbsenceEvents(enabled: boolean, bis?: string) {
  return useQuery({
    queryKey: [...ABSENCES_KEY, 'events', bis ?? ''],
    queryFn: () => api.getAbsenceEvents(bis),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * Nach jedem Schreiben die eigene Liste neu holen – die Termine ändern sich dadurch nicht (sie kosten einen
 * ChurchTools-Aufruf). Geschrieben wird seit Dienstplaner E7-2b in der gemeinsamen Seite (`@ui/abwesenheiten`): erst
 * anlegen, dann löschen, nacheinander; sie ruft danach dies hier (`schreiben.geaendert`).
 */
export function useAbsencesRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [...ABSENCES_KEY, 'mine'] });
}

/** Die Gründe der Gemeinde – ändern sich fast nie, deshalb lange frisch. */
export function useAbsenceReasons(enabled: boolean) {
  return useQuery({
    queryKey: [...ABSENCES_KEY, 'reasons'],
    queryFn: () => api.getAbsenceReasons(),
    enabled,
    staleTime: 30 * 60_000,
  });
}
