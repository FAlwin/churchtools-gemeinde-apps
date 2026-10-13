import type { Reiter } from '@ui/bedienung/ReiterLeiste';

/** Die Bereiche des Dienstplaners (Entwurf v17): Start · Termine · Planen · Abwesenheiten. */
export type ReiterId = 'start' | 'termine' | 'planen' | 'abwesenheiten';

export const ALLE_REITER: Reiter<ReiterId>[] = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'termine', label: 'Termine', icon: 'calendar' },
  { id: 'planen', label: 'Planen', icon: 'grid' },
  { id: 'abwesenheiten', label: 'Abwesenheiten', icon: 'user-slash' },
];

/**
 * Welche Reiter jemand sieht: „Planen“ nur, wer etwas planen darf (Bauplan: „Planen“ nur mit
 * Planer-Recht). Alle anderen sehen alle.
 */
export function sichtbareReiter(darfPlanen: boolean): Reiter<ReiterId>[] {
  return ALLE_REITER.filter((r) => r.id !== 'planen' || darfPlanen);
}

/**
 * Der Reiter steht in der Adresse (`#/termine`), damit Neuladen und der Zurück-Knopf funktionieren.
 * Unbekannt oder nicht erlaubt → Start.
 */
export function reiterAusAdresse(hash: string, erlaubt: Reiter<ReiterId>[]): ReiterId {
  const id = /^#\/([a-z]+)$/.exec(hash)?.[1];
  return erlaubt.find((r) => r.id === id)?.id ?? 'start';
}

export function adresseFuer(id: ReiterId): string {
  return id === 'start' ? '' : `#/${id}`;
}
