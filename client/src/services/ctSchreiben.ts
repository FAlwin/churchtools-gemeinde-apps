/**
 * Die schreibenden Aufrufe der ChurchTools-Extension (#335, Phase 3b) – das, was in der
 * Server-Variante `ctWrite.ts` tut, direkt im Browser.
 *
 * **Hier stehen keine Regeln.** Wie ein Ablaufpunkt oder ein Arrangement geschrieben wird (frisch
 * lesen, Rumpf aus dem Ist-Zustand, Reihenfolge-Schutz, Vorlauf-Grenze), steht in
 * `@shared/ct/schreibKern` und gilt für beide Auslieferungen. Hier liegt nur der `CtSchreiber` des
 * Browsers: gelesen über den `leser` aus `ctLesen.ts`, geschrieben über `ctAnfrage` (Sitzung der
 * Seite, CSRF-Token, Bremse, Zeitgrenze).
 *
 * Aufgerufen wird es nur aus der Weiche in `churchtoolsApi.ts`.
 */
import {
  ablaufUmsortieren,
  punktAendern,
  punktAnlegen,
  punktLoeschen,
  tempoSetzen,
  vorBeginnSetzen,
  type CtSchreiber,
  type NeuerPunkt,
  type PunktAenderung,
  type SchreibAuftrag,
} from '@shared/ct/schreibKern';
import { ApiError } from './api';
import { ChurchToolsBremst, ctAnfrage, KeinSpeicherRecht } from './ctRuntime';
import { leser } from './ctLesen';

/**
 * Ein Fehlschlag beim Schreiben, so gemeldet wie im Server: „<Was> fehlgeschlagen (<Status>)." als
 * 502. Die Zweige einzeln – was die Oberfläche anders behandeln muss, bleibt, wie es ist:
 *  - fehlendes Recht (`KeinSpeicherRecht`, mit der Meldung des Auftrags),
 *  - Drosselung (`ChurchToolsBremst`) und Zeitüberschreitung (504): „gleich nochmal",
 *  - abgemeldet (401) und „unklar" (503): sonst würde ein Sitzungsverlust zum Schreibfehler,
 *  - Netzfehler (kein `ApiError`): „nicht erreichbar" hat `ctRuntime` schon gemeldet.
 */
function schreibFehler(e: unknown, auftrag: SchreibAuftrag): unknown {
  if (!(e instanceof ApiError)) return e;
  if (e instanceof KeinSpeicherRecht || e instanceof ChurchToolsBremst) return e;
  if ([401, 503, 504].includes(e.status)) return e;
  return new ApiError(502, `${auftrag.fehler} (${e.status}).`);
}

/** Der `CtSchreiber` des Browsers für die geteilten Schreib-Regeln. */
const schreiber: CtSchreiber = {
  // Der `leser` fragt ChurchTools direkt, ohne Zwischenspeicher – frisch, wie die Regeln es verlangen.
  agenda: (eventId) => leser.agenda(eventId),
  song: (songId) => leser.song(songId),
  async schreibe(pfad, auftrag) {
    try {
      await ctAnfrage(pfad, {
        method: auftrag.method,
        body: auftrag.json === undefined ? undefined : JSON.stringify(auftrag.json),
        verweigert: auftrag.verweigert,
      });
    } catch (e) {
      if (auftrag.okBei404 && e instanceof ApiError && e.status === 404) return;
      throw schreibFehler(e, auftrag);
    }
  },
  fehler: (status, meldung) => new ApiError(status, meldung),
};

const OK = { ok: true } as const;

/** `PATCH /api/services/:id/agenda/order` */
export async function reihenfolge(eventId: number, order: number[]): Promise<{ ok: boolean }> {
  await ablaufUmsortieren(schreiber, eventId, order);
  return OK;
}

/** `POST /api/services/:id/agenda/items` */
export async function punktNeu(eventId: number, data: NeuerPunkt): Promise<{ ok: boolean }> {
  await punktAnlegen(schreiber, eventId, data);
  return OK;
}

/** `PUT /api/services/:id/agenda/items/:itemId` */
export async function punkt(
  eventId: number,
  itemId: number,
  fields: PunktAenderung,
): Promise<{ ok: boolean }> {
  await punktAendern(schreiber, eventId, itemId, fields);
  return OK;
}

/** `DELETE /api/services/:id/agenda/items/:itemId` */
export async function punktWeg(eventId: number, itemId: number): Promise<{ ok: boolean }> {
  await punktLoeschen(schreiber, eventId, itemId);
  return OK;
}

/** `PUT /api/services/:id/agenda/items/:itemId/vor-beginn` */
export async function vorBeginn(
  eventId: number,
  itemId: number,
  wert: boolean,
): Promise<{ ok: boolean }> {
  await vorBeginnSetzen(schreiber, eventId, itemId, wert);
  return OK;
}

/** `PUT /api/songs/:songId/arrangements/:arrangementId/tempo` */
export async function tempo(
  songId: number,
  arrangementId: number,
  wert: number,
): Promise<{ tempo: number }> {
  await tempoSetzen(schreiber, songId, arrangementId, wert);
  return { tempo: wert };
}
