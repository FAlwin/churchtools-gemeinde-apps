import type { Reiter } from '@ui/bedienung/ReiterLeiste';

/** Die Bereiche der Protokolle: Start, Sitzungen (S3-2), To-Dos (S7-1) und – nur für Admins – Verwaltung (S2-2). */
export type ReiterId = 'start' | 'sitzungen' | 'todos' | 'verwaltung';

export const ALLE_REITER: Reiter<ReiterId>[] = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'sitzungen', label: 'Sitzungen', icon: 'calendar' },
  { id: 'todos', label: 'To-Dos', icon: 'todo-liste' },
  { id: 'verwaltung', label: 'Verwaltung', icon: 'regler' },
];

/** „Verwaltung“ nur, wer in ChurchTools Rechte vergeben darf (`darfVerwalten`). */
export function sichtbareReiter(darfVerwalten: boolean): Reiter<ReiterId>[] {
  return ALLE_REITER.filter((r) => r.id !== 'verwaltung' || darfVerwalten);
}
