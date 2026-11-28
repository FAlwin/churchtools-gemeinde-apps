import type { Reiter } from '@ui/bedienung/ReiterLeiste';
import { reiterName } from '@shared/protokolle/hinweis';
import { erweiterungsLink } from '@ui/erweiterung/kuerzel';

/** Die Bereiche der Protokolle: Start, Sitzungen (S3-2), To-Dos (S7-1), Reihen (Baustein „Reihe“, Scheibe 2), Termine (W14) und – nur für Admins – Einstellungen (S2-2, früher „Verwaltung“; R13: der letzte Reiter, nur Einstellungen). */
export type ReiterId = 'start' | 'sitzungen' | 'todos' | 'reihen' | 'termine' | 'verwaltung';

export const ALLE_REITER: Reiter<ReiterId>[] = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'sitzungen', label: 'Sitzungen', icon: 'calendar' },
  { id: 'todos', label: 'To-Dos', icon: 'todo-liste' },
  { id: 'reihen', label: 'Reihen', icon: 'liste' },
  { id: 'termine', label: 'Termine', icon: 'clock' },
  { id: 'verwaltung', label: 'Einstellungen', icon: 'zahnrad' },
];

/** „Einstellungen“ (id `verwaltung`, bleibt – Adresse `#/verwaltung`) nur, wer in ChurchTools Rechte vergeben darf (`darfVerwalten`). */
export function sichtbareReiter(darfVerwalten: boolean): Reiter<ReiterId>[] {
  return ALLE_REITER.filter((r) => r.id !== 'verwaltung' || darfVerwalten);
}

/**
 * **Direkt zu einer Sitzung** (S6-2): `#/sitzungen/<Gruppe>/<Sitzung>` – der Link „Protokoll öffnen“ im Beitrag. Die
 * Sitzung ist die ID aus dem Protokoll-Kopf (`kopf.sitzung`), nicht der Listenschlüssel (`p:…`). Die App liest die
 * Adresse einmal, öffnet die Sitzung und setzt die Adresse auf `#/sitzungen` zurück.
 */
export function sitzungAusAdresse(hash: string): { gruppe: number; sitzung: string } | null {
  const m = /^#\/sitzungen\/(\d+)\/([^/?#]+)$/.exec(hash);
  if (!m) return null;
  try {
    return { gruppe: Number(m[1]), sitzung: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

export function adresseFuerSitzung(gruppe: number, sitzung: string): string {
  return `#/sitzungen/${gruppe}/${encodeURIComponent(sitzung)}`;
}

/** Die volle Adresse für außerhalb (Beitrag): Instanz + Seite der Erweiterung (`/ccm/<Kürzel>/`) + Sitzung. */
export function sitzungsLink(
  basis: string,
  kuerzel: string,
  gruppe: number,
  sitzung: string,
): string {
  return erweiterungsLink(basis, kuerzel, adresseFuerSitzung(gruppe, sitzung));
}

/**
 * **Der rote Zähler am Reiter „To-Dos“** (fällige To-Dos, `faelligZahl`): setzt `zaehler` und den Namen für Vorleser
 * („To-Dos, 3 fällig“). Null oder unbekannt (`null`) → die Reiter bleiben, wie sie sind.
 */
export function reiterMitZaehler(
  reiter: Reiter<ReiterId>[],
  zahl: number | null,
): Reiter<ReiterId>[] {
  if (!zahl) return reiter;
  return reiter.map((r) =>
    r.id === 'todos' ? { ...r, zaehler: zahl, zaehlerName: reiterName(zahl) } : r,
  );
}
