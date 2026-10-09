/**
 * Die Personen-Ablage der **Erweiterung** – der Anschluss aus dem Browser an `@shared/ct/personenAblage`.
 *
 * Die Regeln (Dateinamen, Ersetzen als Doppelschritt, Zusammenführen nach Zeitstempel, Teilen) liegen
 * seit dem Umzug der Server-App nach ChurchTools in `shared/ct`, damit Server und Erweiterung dieselben
 * benutzen. Hier steht nur, WIE der Browser ChurchTools anspricht: mit der Sitzung der Seite über
 * `ctAnfrage`/`ctDatei` (samt Bremse, Zeitgrenze und CSRF-Token).
 *
 * Die Härtungen gegen verlorene Änderungen (Warteschlange, Wiederholen, Nachholen nach Neustart)
 * liegen unverändert in `annotations.ts`/`userSettings.ts` – ausgetauscht ist dort nur der Transportweg.
 */
import { ApiError } from './api';
import { ctAnfrage, ctDatei, KeinSpeicherRecht } from './ctRuntime';
import { whoamiId } from '@shared/ct/whoami';
import {
  erstellePersonenAblage,
  type AblagePort,
  type GeteilteAblage,
} from '@shared/ct/personenAblage';
import type { AnnotationText, GesehenerStand, PageAnnotation } from '@shared/types/index';

export {
  geteilteEinstellungen,
  geteilteLieder,
  mische,
  type DatenDatei,
  type GeteilteAblage,
} from '@shared/ct/personenAblage';

let ich: number | null = null;

/** Der Browser-Anschluss – auch für das Teilen (`ctTeilen.ts`). */
export const ablagePort: AblagePort = {
  async meineId() {
    if (ich !== null) return ich;
    const body = await ctAnfrage<{ data?: unknown }>('/whoami');
    const id = whoamiId(body?.data);
    // id -1 = keine gültige Sitzung (#381) – dann gibt es keine eigene Ablage.
    if (!id) throw new ApiError(401, 'Bei ChurchTools nicht angemeldet.');
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

/** Die eine Ablage dieses Geräts. */
export const eigeneAblage = erstellePersonenAblage();
const ablage = eigeneAblage;
const port = ablagePort;

/** Nur für Tests: alles vergessen. */
export function _zuruecksetzen(): void {
  ich = null;
  ablage.zuruecksetzen();
}

/** Die Dateiliste der eigenen Person neu lesen. */
export const aktualisiereListe = (): Promise<void> => ablage.aktualisiereListe(port);

export const holeAnmerkungen = (songIds: number[]): Promise<Record<string, PageAnnotation>> =>
  ablage.holeAnmerkungen(port, songIds);

export const schreibeAnmerkung = (key: string, teil: PageAnnotation): Promise<void> =>
  ablage.schreibeAnmerkung(port, key, teil);

export const holeEinstellungen = (songIds: number[]): Promise<Record<string, string>> =>
  ablage.holeEinstellungen(port, songIds);

export const schreibeEinstellungen = (eintraege: Record<string, string | null>): Promise<void> =>
  ablage.schreibeEinstellungen(port, eintraege);

export const holeGesehen = (jetzt = Date.now()): Promise<Record<number, GesehenerStand>> =>
  ablage.holeGesehen(port, jetzt);

export const merkeGesehen = (
  eventId: number,
  stand: Omit<GesehenerStand, 'seenAt'>,
  jetzt = Date.now(),
): Promise<void> => ablage.merkeGesehen(port, eventId, stand, jetzt);

export const holeTeilen = (): Promise<boolean> => ablage.holeTeilen(port);

export const schreibeTeilen = (an: boolean, name: string): Promise<void> =>
  ablage.schreibeTeilen(port, an, name);

export const geteilteAblage = (personId: number): Promise<GeteilteAblage | null> =>
  ablage.geteilteAblage(port, personId);

export const geteilteAnmerkungen = (
  a: GeteilteAblage,
  songIds: number[],
): Promise<Record<string, { strokes: string | null; texts: AnnotationText[] }>> =>
  ablage.geteilteAnmerkungen(port, a, songIds);
