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
  return `${basis.replace(/\/+$/, '')}/ccm/${encodeURIComponent(kuerzel)}/${adresseFuerSitzung(gruppe, sitzung)}`;
}
