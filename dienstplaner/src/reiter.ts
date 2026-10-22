import type { Reiter } from '@ui/bedienung/ReiterLeiste';
import {
  adresseFuer as adresseVon,
  reiterAusAdresse as ausAdresse,
} from '@ui/bedienung/reiterAdresse';

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

/** Der Reiter aus der Adresse (`#/termine`) – Regel in `@ui/bedienung/reiterAdresse`. Unbekannt → Start. */
export function reiterAusAdresse(hash: string, erlaubt: Reiter<ReiterId>[]): ReiterId {
  return ausAdresse(hash, erlaubt, 'start');
}

export function adresseFuer(id: ReiterId): string {
  return adresseVon(id, 'start');
}

/** Die Termin-Ansicht (E6-1b) hat eine eigene Adresse (`#/termin/148`) – Neuladen und Zurück funktionieren. */
export function terminAusAdresse(hash: string): number | null {
  const id = /^#\/termin\/(\d+)$/.exec(hash)?.[1];
  return id ? Number(id) : null;
}

export function adresseFuerTermin(id: number): string {
  return `#/termin/${id}`;
}
