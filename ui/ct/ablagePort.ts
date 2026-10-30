/**
 * **Der Browser-Anschluss an die Personen-Ablage** (`@shared/ct/personenAblage`) – für alle Erweiterungen: die
 * Musik-App (Anmerkungen, Einstellungen, Teilen) und seit S7-3 die Protokolle (Einstellungen der To-Do-Übersicht je
 * Benutzer). Bis 30.10.2026 stand er in `client/src/services/personenAblage.ts`; hierher gezogen, damit die zweite
 * App ihn benutzt statt ihn nachzubauen.
 *
 * ChurchTools wird mit der Sitzung der Seite angesprochen (`ctAnfrage`/`ctDatei` samt Bremse, Zeitgrenze, CSRF-Token);
 * Dateien herunterladen geht nur so (ein Token-Header endet in einer Weiterleitungsschleife, gemessen 07.10.2026).
 */
import type { AblagePort } from '@shared/ct/personenAblage';
import { ApiError } from './fehler';
import { angemeldeteId } from './ich';
import { ctAnfrage, ctDatei, KeinSpeicherRecht } from './verbindung';

let ich: number | null = null;

export const ablagePort: AblagePort = {
  async meineId() {
    if (ich !== null) return ich;
    const body = await ctAnfrage<{ data?: unknown }>('/whoami');
    // Niemand angemeldet (#381) → 401, unlesbar → 503 (#491): Nur ein 401 schaltet den
    // Anmerkungs-Abgleich ab, ein Aussetzer von ChurchTools nicht.
    const id = angemeldeteId(body?.data);
    ich = id;
    return id;
  },
  lesen: (pfad) => ctAnfrage<unknown>(pfad),
  datei: async (fileUrl) => new Uint8Array(await (await ctDatei(fileUrl)).arrayBuffer()),
  async hochladen(personId, name, inhalt, typ) {
    const form = new FormData();
    // Kopie: `Blob` verlangt einen Puffer vom Typ ArrayBuffer (TypeScript 5.7).
    form.append('files[]', new Blob([new Uint8Array(inhalt)], { type: typ }), name);
    await ctAnfrage(`/files/person/${personId}`, { method: 'POST', body: form });
  },
  async loeschen(fileId) {
    await ctAnfrage(`/files/${fileId}`, { method: 'DELETE' });
  },
  fehler: (status, meldung) => new ApiError(status, meldung),
  istKeinRecht: (e) => e instanceof KeinSpeicherRecht,
  istNichtGefunden: (e) => e instanceof ApiError && e.status === 404,
};

/** Nur für Tests: die gemerkte eigene ID vergessen. */
export function _ablageIchVergessen(): void {
  ich = null;
}
