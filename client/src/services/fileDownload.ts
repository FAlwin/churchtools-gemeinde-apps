/**
 * Rohe Datei-Abrufe (PDF/Bild) aus dem Datei-Proxy des Servers (#199).
 *
 * Warum ein eigener Service statt `apiFetch`: Hier kommt **kein JSON** zurück, sondern Bytes –
 * `apiFetch` würde den Rumpf als Text lesen und zu parsen versuchen. Die Konvention „fetch nur in
 * `services/`" gilt trotzdem; vorher stand der Aufruf mitten in `hooks/useSetlistPages.ts`.
 */
import { istExtension } from './ctRuntime';
import { datei } from './ctLesen';

/**
 * Lädt eine Datei **vollständig** und gibt ihre Bytes zurück.
 *
 * Bewusst ein einziger GET statt pdf.js selbst streamen zu lassen: pdf.js nutzt sonst
 * Range-Requests (Teilstücke), die den Datei-Cache des Service Workers verfehlen bzw. verwirren –
 * offline hing der Seitenaufbau dadurch rund 10 Sekunden, bis der Fallback griff (#32). Ein
 * normaler GET trifft den CacheFirst-Eintrag sauber; die Lied-PDFs sind klein, die Volllast ist
 * auch online unkritisch.
 */
export async function fetchFileBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Dokument konnte nicht geladen werden (${res.status})`);
  return res.arrayBuffer();
}

/**
 * Ein Dokument (PDF/Bild) eines Lieds als Bytes – **die Weiche** (#335): Server-Variante über den
 * Datei-Proxy (und damit über den Datei-Cache des Service Workers, #32), Extension direkt aus
 * ChurchTools.
 */
export async function ladeDokument(songId: number, fileId: number): Promise<ArrayBuffer> {
  if (istExtension) return (await datei(songId, fileId)).arrayBuffer();
  return fetchFileBytes(`/api/songs/${songId}/files/${fileId}`);
}
