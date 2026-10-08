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
import type {
  ArrangementAnsicht,
  ArrangementAuftrag,
  ArrangementFileEntry,
  LiedAngelegt,
  LiedAnlegenAuftrag,
  LiedStammdaten,
  LiedStammdatenAnsicht,
  SongVersion,
} from '@shared/types/index';
import * as lieder from '@shared/ct/liedVerwaltung';
import type { CtVerwalter } from '@shared/ct/liedVerwaltung';
import * as noten from '@shared/ct/notenblaetter';
import type { CtNotenSchreiber } from '@shared/ct/notenblaetter';
import { notenblattAusSongSelect } from '@shared/ct/songselect';
import { songSelect } from './ctSongSelect';
import { ApiError } from './api';
import { ChurchToolsBremst, ctAnfrage, KeinSpeicherRecht } from './ctRuntime';
import { bearbeitbareKategorien, leser, quellen } from './ctLesen';

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
const schreiber: CtSchreiber & CtVerwalter & CtNotenSchreiber = {
  // Der `leser` fragt ChurchTools direkt, ohne Zwischenspeicher – frisch, wie die Regeln es verlangen.
  agenda: (eventId) => leser.agenda(eventId),
  song: (songId) => leser.song(songId),
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
  // ── Liedverwaltung und Notenblätter (3b-2) ──
  alleLieder: () => leser.alleLieder(),
  bearbeitbareKategorien,
  quellen,
  dateiText: (fileUrl) => leser.dateiText(fileUrl),
  /** Wie `uploadFile` im Server: EIN Feld `files[]`, Name und Art mit der Datei. */
  async hochladen(arrangementId, datei, meldungen) {
    const form = new FormData();
    const inhalt = typeof datei.inhalt === 'string' ? datei.inhalt : new Uint8Array(datei.inhalt);
    form.append('files[]', new Blob([inhalt], { type: datei.mime }), datei.filename);
    const auftrag: SchreibAuftrag = { method: 'POST', ...meldungen };
    try {
      await ctAnfrage(`/files/song_arrangement/${arrangementId}`, {
        method: 'POST',
        body: form,
        verweigert: meldungen.verweigert,
      });
    } catch (e) {
      throw schreibFehler(e, auftrag);
    }
  },
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

// ── Liedverwaltung (3b-2) – dieselben Antworten wie die Endpunkte des Servers ──

/** `POST /api/songs` */
export function liedNeu(auftrag: LiedAnlegenAuftrag): Promise<LiedAngelegt> {
  return lieder.liedAnlegen(schreiber, auftrag);
}

/** `PUT /api/songs/:id` – zurück kommt das Lied, wie ChurchTools es DANACH liest. */
export async function liedAendern(
  songId: number,
  aenderung: Partial<LiedStammdaten>,
): Promise<LiedStammdatenAnsicht> {
  return lieder.stammdatenAnsicht(await lieder.liedAendern(schreiber, songId, aenderung));
}

/** `DELETE /api/songs/:id` */
export function liedWeg(songId: number): Promise<{ name: string }> {
  return lieder.liedLoeschen(schreiber, songId);
}

/** `POST /api/songs/:id/arrangements` */
export function arrangementNeu(
  songId: number,
  auftrag: ArrangementAuftrag & { name: string },
): Promise<ArrangementAnsicht> {
  return lieder.arrangementAnlegen(schreiber, songId, auftrag);
}

/** `PUT /api/songs/:id/arrangements/:arrId` */
export function arrangement(
  songId: number,
  arrangementId: number,
  auftrag: ArrangementAuftrag,
): Promise<ArrangementAnsicht> {
  return lieder.arrangementBearbeiten(schreiber, songId, arrangementId, auftrag);
}

/** `PATCH /api/songs/:id/arrangements/:arrId/default` */
export function arrangementStandard(
  songId: number,
  arrangementId: number,
): Promise<ArrangementAnsicht[]> {
  return lieder.arrangementZumStandard(schreiber, songId, arrangementId);
}

/** `DELETE /api/songs/:id/arrangements/:arrId` */
export function arrangementWeg(songId: number, arrangementId: number): Promise<{ name: string }> {
  return lieder.arrangementLoeschen(schreiber, songId, arrangementId);
}

// ── Notenblätter, Versionen, Dateien (3b-2) ──

/** `POST /api/songs/:id/arrangements/:arrId/files` – die Datei vom Gerät, als Bytes. */
export async function dateiNeu(
  songId: number,
  arrangementId: number,
  datei: File,
): Promise<ArrangementFileEntry[]> {
  // Ein leerer Rumpf ist ein Fehler und kein leeres Dokument – wie im Server: Er entstünde bei einem
  // abgebrochenen Lesen, und eine 0-Byte-Datei in ChurchTools sähe aus wie eine echte.
  const inhalt = new Uint8Array(await datei.arrayBuffer());
  if (inhalt.length === 0) {
    throw new ApiError(400, 'Die Datei ist leer oder wurde nicht vollständig übertragen.');
  }
  return noten.dateiHinzufuegen(schreiber, songId, arrangementId, {
    filename: datei.name,
    mime: datei.type || 'application/octet-stream',
    inhalt,
  });
}

/** `DELETE /api/songs/:id/files/:fileId` */
export async function dateiWeg(songId: number, fileId: number): Promise<void> {
  await noten.dateiEntfernen(schreiber, songId, fileId);
}

/** `PUT /api/songs/:id/arrangements/:arrId/chordpro` – das Original-Notenblatt. */
export function notenblatt(
  songId: number,
  arrangementId: number,
  text: string,
): Promise<ArrangementFileEntry[]> {
  return noten.notenblattSchreiben(schreiber, songId, arrangementId, text);
}

/**
 * `POST /api/songs/:id/arrangements/:arr/songselect/chordpro` (3b-5) – das Original-Notenblatt aus
 * CCLI SongSelect holen und ersetzen; erst holen, dann das alte löschen (`notenblattAusSongSelect`).
 */
export function notenblattAusCcli(
  songId: number,
  arrangementId: number,
  songNumber: number,
): Promise<ArrangementFileEntry[]> {
  return notenblattAusSongSelect(schreiber, songSelect, songId, arrangementId, songNumber);
}

/** `POST /api/songs/:id/versions` */
export function versionNeu(
  songId: number,
  arrangementId: number,
  name: string,
  text: string,
): Promise<SongVersion> {
  return noten.versionAnlegen(schreiber, songId, arrangementId, name, text);
}

/** `PUT /api/songs/:id/versions/:key` */
export function version(
  songId: number,
  arrangementId: number,
  versionKey: string,
  changes: { text?: string; name?: string },
): Promise<SongVersion> {
  return noten.versionAendern(schreiber, songId, arrangementId, versionKey, changes);
}

/** `DELETE /api/songs/:id/versions/:key` */
export async function versionWeg(
  songId: number,
  arrangementId: number,
  versionKey: string,
): Promise<{ ok: boolean }> {
  await noten.versionLoeschen(schreiber, songId, arrangementId, versionKey);
  return OK;
}
