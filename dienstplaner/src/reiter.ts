import type { Reiter } from '@ui/bedienung/ReiterLeiste';
import {
  adresseFuer as adresseVon,
  reiterAusAdresse as ausAdresse,
} from '@ui/bedienung/reiterAdresse';

/**
 * Die Bereiche des Dienstplaners (Entwurf v17): Start · Dienste · Planen · Abwesenheiten. „Dienste“ hieß bis 28.10.2026
 * „Termine“ (Alwin: passt besser); die Adresse bleibt `#/termine`, damit gemerkte Links weiter gehen.
 */
export type ReiterId = 'start' | 'termine' | 'planen' | 'abwesenheiten';

export const ALLE_REITER: Reiter<ReiterId>[] = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'termine', label: 'Dienste', icon: 'calendar' },
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
  if (planenGruppeAusAdresse(hash) !== null && erlaubt.some((r) => r.id === 'planen')) {
    return 'planen';
  }
  return ausAdresse(hash, erlaubt, 'start');
}

/**
 * **Planen mit einer Gruppe** (Wunsch 7, Alwin 11.11.2026): Die Karte „Planen“ der Startseite öffnet `#/planen/gruppe/3` –
 * nur diese Gruppe, die nächsten 6 Wochen, **nur für diesen Besuch** (der gemerkte Filter bleibt). Eine eigene Adresse,
 * damit Zurück und Neuladen funktionieren.
 */
export function planenGruppeAusAdresse(hash: string): number | null {
  const id = /^#\/planen\/gruppe\/(\d+)$/.exec(hash)?.[1];
  return id ? Number(id) : null;
}

export function adresseFuerPlanenGruppe(gruppeId: number): string {
  return `#/planen/gruppe/${gruppeId}`;
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
