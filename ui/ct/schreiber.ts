/**
 * **Der `CtSchreiber` des Browsers** für die geteilten Schreib-Regeln (`@shared/ct/schreibKern`) – für jede
 * Erweiterung dieses Repos (Bauplan E6-3a, #645: aus `client/src/services/ctSchreiben.ts` hierher gezogen, damit
 * der Dienstplaner ihn nicht nachbaut). Gelesen wird frisch über `ctDaten`, geschrieben über `ctAnfrage` (Sitzung
 * der Seite, CSRF-Token, Bremse, Zeitgrenze).
 *
 * **Hier stehen keine Regeln.** Wie ein Ablaufpunkt geschrieben wird (frisch lesen, Rumpf aus dem Ist-Zustand,
 * Reihenfolge-Schutz, Vorlauf-Grenze), steht im Schreibkern.
 */
import type { CtSchreiber, SchreibAuftrag } from '@shared/ct/schreibKern';
import type { AblaufBestandLeser } from '@shared/ct/ablaufNeu';
import type { CtAblaufVorlage, CtAgenda, CtEvent, CtSong } from '@shared/ct/typen';
import { ApiError } from './fehler';
import { ChurchToolsBremst, ctAnfrage, ctDaten, KeinSpeicherRecht } from './verbindung';

/**
 * Ein Fehlschlag beim Schreiben, so gemeldet wie im Server: „<Was> fehlgeschlagen (<Status>)." als
 * 502. Die Zweige einzeln – was die Oberfläche anders behandeln muss, bleibt, wie es ist:
 *  - fehlendes Recht (`KeinSpeicherRecht`, mit der Meldung des Auftrags),
 *  - Drosselung (`ChurchToolsBremst`) und Zeitüberschreitung (504): „gleich nochmal",
 *  - abgemeldet (401) und „unklar" (503): sonst würde ein Sitzungsverlust zum Schreibfehler,
 *  - Netzfehler (kein `ApiError`): „nicht erreichbar" hat die Verbindung schon gemeldet.
 */
export function schreibFehler(e: unknown, auftrag: SchreibAuftrag): unknown {
  if (!(e instanceof ApiError)) return e;
  if (e instanceof KeinSpeicherRecht || e instanceof ChurchToolsBremst) return e;
  if ([401, 503, 504].includes(e.status)) return e;
  return new ApiError(502, `${auftrag.fehler} (${e.status}).`);
}

export const browserSchreiber: CtSchreiber = {
  // Ohne Zwischenspeicher – frisch, wie die Regeln es verlangen.
  agenda: (eventId) => ctDaten<CtAgenda>(`/events/${eventId}/agenda`),
  song: (songId) => ctDaten<CtSong>(`/songs/${songId}`),
  vorlage: (vorlageId) => ctDaten<CtAblaufVorlage>(`/agendatemplates/${vorlageId}`),
  async schreibe(pfad, auftrag) {
    try {
      // Der Rumpf geht zurück: Beim Anlegen steht darin die neue ID (3b-2).
      return await ctAnfrage(pfad, {
        method: auftrag.method,
        body: auftrag.json === undefined ? undefined : JSON.stringify(auftrag.json),
        verweigert: auftrag.verweigert,
      });
    } catch (e) {
      if (auftrag.okBei404 && e instanceof ApiError && e.status === 404) return null;
      throw schreibFehler(e, auftrag);
    }
  },
  fehler: (status, meldung) => new ApiError(status, meldung),
};

/** Was die Nachfrage „Neu aufsetzen“ liest (E6-5b) – frisch, wie der Schreiber. */
export const browserAblaufLeser: AblaufBestandLeser = {
  agenda: (eventId) => browserSchreiber.agenda(eventId),
  termin: (eventId) => ctDaten<CtEvent>(`/events/${eventId}`),
};
