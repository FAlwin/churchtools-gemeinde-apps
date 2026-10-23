import type { Reiter } from '@ui/bedienung/ReiterLeiste';

/** Die Bereiche der Protokolle: Start, Sitzungen (S3-2) und – nur für Admins – Verwaltung (Entwurf 7, S2-2). */
export type ReiterId = 'start' | 'sitzungen' | 'verwaltung';

export const ALLE_REITER: Reiter<ReiterId>[] = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'sitzungen', label: 'Sitzungen', icon: 'calendar' },
  { id: 'verwaltung', label: 'Verwaltung', icon: 'regler' },
];

/** „Verwaltung“ nur, wer in ChurchTools Rechte vergeben darf (`darfVerwalten`). */
export function sichtbareReiter(darfVerwalten: boolean): Reiter<ReiterId>[] {
  return ALLE_REITER.filter((r) => r.id !== 'verwaltung' || darfVerwalten);
}
