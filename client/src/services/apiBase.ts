/**
 * Basis-URL des eigenen Backends. Liegt bewusst in einem eigenen Modul, damit sowohl `api.ts` als
 * auch `reachability.ts` sie nutzen können, ohne sich gegenseitig zu importieren (Zirkelbezug:
 * `api` meldet an `reachability`, `reachability` fragt selbst beim Server nach – #218).
 */
export const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

/**
 * Die Adresse einer Lied-Datei beim eigenen Server – an EINER Stelle (#463).
 *
 * Sie stand viermal da. Zwei davon MÜSSEN übereinstimmen: Der Offline-Vorrat (`offline.ts`) legt die
 * Datei unter genau der Adresse in den Cache des Service Workers, unter der der Betrachter
 * (`fileDownload.ts`) sie später holt. Wiche eine ab, fände das Gerät offline nichts – ohne Fehler.
 */
export function liedDateiPfad(songId: number, fileId: number): string {
  return `/api/songs/${songId}/files/${fileId}`;
}
