import type { Reiter } from '@ui/bedienung/ReiterLeiste';
import {
  adresseFuer as adresseVon,
  reiterAusAdresse as ausAdresse,
} from '@ui/bedienung/reiterAdresse';

/**
 * Die Bereiche des Dienstplaners (Entwurf v17): Start · Dienste · Planen · Wann kann ich? „Dienste“ hieß bis 28.10.2026
 * „Termine“ (Alwin: passt besser); die Adresse bleibt `#/termine`, damit gemerkte Links weiter gehen. Ebenso
 * „Wann kann ich?“ (E5c-1c, vorher „Abwesenheiten“): ID und Adresse bleiben `abwesenheiten` / `#/abwesenheiten` – gemerkte
 * Links und die Erinnerungs-Mail zeigen dorthin.
 */
export type ReiterId = 'start' | 'termine' | 'planen' | 'abwesenheiten';

export const ALLE_REITER: Reiter<ReiterId>[] = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'termine', label: 'Dienste', icon: 'calendar' },
  { id: 'planen', label: 'Planen', icon: 'grid' },
  { id: 'abwesenheiten', label: 'Wann kann ich?', icon: 'user-slash' },
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
  // „Wann kann ich?“ mit einer Abfrage (`#/abwesenheiten?abfrage=4`, R-3) ist trotz Anhang der Reiter selbst.
  if (abwesenheitenAbfrageAusAdresse(hash) !== null)
    return ausAdresse('#/abwesenheiten', erlaubt, 'start');
  // Gruppen-Besuch und Vorlagen gehören beide zu „Planen“ – dort bleibt der Reiter markiert.
  if (
    (planenGruppeAusAdresse(hash) !== null || vorlagenAusAdresse(hash) !== null) &&
    erlaubt.some((r) => r.id === 'planen')
  ) {
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

/**
 * **„Wann kann ich?“ mit einer Abfrage** (R-3, 25.11.2026): `#/abwesenheiten?abfrage=4` – die Karte auf der Startseite führt
 * dorthin, die Seite zeigt dann genau den Zeitraum der Abfrage der Dienstgruppe 4. Ohne Anhang (oder mit einem kaputten)
 * ist es die Seite wie immer. Eine eigene Adresse, damit Zurück und Neuladen gehen.
 */
export function abwesenheitenAbfrageAusAdresse(hash: string): number | null {
  const id = /^#\/abwesenheiten\?abfrage=(\d+)$/.exec(hash)?.[1];
  return id ? Number(id) : null;
}

export function adresseFuerAbwesenheitenAbfrage(dienstgruppeId: number): string {
  return `#/abwesenheiten?abfrage=${dienstgruppeId}`;
}

export function adresseFuer(id: ReiterId): string {
  return adresseVon(id, 'start');
}

/** Die Termin-Ansicht (E6-1b) hat eine eigene Adresse (`#/termin/148`) – Neuladen und Zurück funktionieren. */
export function terminAusAdresse(hash: string): number | null {
  const id = /^#\/termin\/(\d+)(?:\/live)?$/.exec(hash)?.[1];
  return id ? Number(id) : null;
}

/** `#/termin/148/live`: die Termin-Ansicht mit gleich geöffneter Live-Ansicht (Knopf „Live“ auf der Startseite). */
export function liveAusAdresse(hash: string): boolean {
  return /^#\/termin\/\d+\/live$/.test(hash);
}

export function adresseFuerLive(id: number): string {
  return `#/termin/${id}/live`;
}

export function adresseFuerTermin(id: number): string {
  return `#/termin/${id}`;
}

/**
 * **Die Seite „Ablaufvorlagen“** (E10-V3a, Entwurf: Knopf „Vorlagen“ in „Planen“, kein eigener Reiter): `#/vorlagen` ist
 * die Liste, `#/vorlage/5` eine geöffnete Vorlage. Eigene Adressen, damit Zurück und Neuladen gehen. Antwort:
 * `null` = keine Vorlagen-Adresse, `{ id: null }` = die Liste, `{ id }` = diese Vorlage.
 */
export function vorlagenAusAdresse(hash: string): { id: number | null } | null {
  if (hash === '#/vorlagen') return { id: null };
  const id = /^#\/vorlage\/(\d+)$/.exec(hash)?.[1];
  return id ? { id: Number(id) } : null;
}

export const ADRESSE_VORLAGEN = '#/vorlagen';

export function adresseFuerVorlage(id: number): string {
  return `#/vorlage/${id}`;
}
