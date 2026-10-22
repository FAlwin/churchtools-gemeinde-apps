import type { Reiter } from '@ui/bedienung/ReiterLeiste';

/** Die Bereiche der Protokolle: Start und – nur für Admins – Verwaltung (Entwurf 7, Bauplan S2-2). */
export type ReiterId = 'start' | 'verwaltung';

export const ALLE_REITER: Reiter<ReiterId>[] = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'verwaltung', label: 'Verwaltung', icon: 'regler' },
];

/** „Verwaltung“ nur, wer in ChurchTools Rechte vergeben darf (`darfVerwalten`). */
export function sichtbareReiter(darfVerwalten: boolean): Reiter<ReiterId>[] {
  return ALLE_REITER.filter((r) => r.id !== 'verwaltung' || darfVerwalten);
}
