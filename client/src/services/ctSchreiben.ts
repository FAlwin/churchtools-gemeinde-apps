/**
 * Die schreibenden Aufrufe der ChurchTools-Extension (#335, Phase 3b) – das, was in der
 * Server-Variante `ctWrite.ts` tut, direkt im Browser.
 *
 * **Hier stehen keine Regeln.** Wie ein Ablaufpunkt oder ein Arrangement geschrieben wird (frisch
 * lesen, Rumpf aus dem Ist-Zustand, Reihenfolge-Schutz, Vorlauf-Grenze), steht in
 * `@shared/ct/schreibKern` und gilt für beide Auslieferungen. Der `CtSchreiber` des Browsers steht seit
 * E6-3a (#645) in `@ui/ct/schreiber` – der Dienstplaner schreibt über denselben. Hier kommen nur
 * Liedverwaltung und Notenblätter dazu.
 *
 * Aufgerufen wird es nur aus der Weiche in `churchtoolsApi.ts`.
 */
import {
  ablaufUmsortieren,
  punktAendern,
  punktAnlegen,
  punktLoeschen,
  punktWiederherstellen,
  tempoSetzen,
  vorBeginnSetzen,
  weglassenSetzen,
  ablaufAbschliessen,
  type GeloeschterPunkt,
  type NeuerPunkt,
  type PunktAenderung,
} from '@shared/ct/schreibKern';
import type {
  ArrangementAnsicht,
  ArrangementAuftrag,
  ArrangementFileEntry,
  SongVersion,
} from '@shared/types/index';
import * as lieder from '@shared/ct/liedVerwaltung';
import { ablaufAnlegen } from '@shared/ct/ablaufAnlegen';
import { ablaufNeuAufsetzen as neuAufsetzen, type AblaufStand } from '@shared/ct/ablaufNeu';
import type { AblaufQuelle } from '@shared/types/index';
import type { PunktStand } from '@shared/ct/ablaufZeile';
import * as noten from '@shared/ct/notenblaetter';
import { ApiError } from './api';
// Der Schreiber samt Liedverwaltung und die Lied-Wege liegen seit LW2a (06.11.2026) in `@ui/ct/lieder`.
import { liedSchreiber as schreiber } from '@ui/ct/lieder';
export { arrangement, liedAendern, liedNeu, notenblatt, notenblattAusCcli } from '@ui/ct/lieder';

const OK = { ok: true } as const;

/** `PATCH /api/services/:id/agenda/order` */
export async function reihenfolge(
  eventId: number,
  order: number[],
  gesehen?: number[],
): Promise<{ ok: boolean }> {
  await ablaufUmsortieren(schreiber, eventId, order, gesehen);
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
  gesehen?: PunktStand,
): Promise<{ ok: boolean }> {
  await punktAendern(schreiber, eventId, itemId, fields, gesehen);
  return OK;
}

/** `DELETE /api/services/:id/agenda/items/:itemId` – samt Merkzettel für „Rückgängig". */
export async function punktWeg(
  eventId: number,
  itemId: number,
): Promise<{ ok: boolean; wiederherstellen: GeloeschterPunkt | null }> {
  return { ...OK, wiederherstellen: await punktLoeschen(schreiber, eventId, itemId) };
}

/** `POST /api/services/:id/agenda/items/wiederherstellen` */
export async function punktZurueck(eventId: number, g: GeloeschterPunkt): Promise<{ ok: boolean }> {
  await punktWiederherstellen(schreiber, eventId, g);
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

/** `PUT /api/services/:id/agenda/items/:itemId/weglassen` (E6-3b) */
export async function weglassen(
  eventId: number,
  itemId: number,
  wert: boolean,
): Promise<{ ok: boolean }> {
  await weglassenSetzen(schreiber, eventId, itemId, wert);
  return OK;
}

/** `POST /api/services/:id/agenda` */
export async function ablaufNeu(
  eventId: number,
  kalenderId: number,
  quelle: AblaufQuelle,
): Promise<{ ok: boolean }> {
  await ablaufAnlegen(schreiber, eventId, kalenderId, quelle);
  return OK;
}

/** `PUT /api/services/:id/agenda/neu` (E6-5b) */
export async function ablaufNeuAufsetzen(
  eventId: number,
  kalenderId: number | null,
  quelle: AblaufQuelle,
  gesehen: AblaufStand,
  nurDieser: boolean,
): Promise<{ ok: boolean }> {
  await neuAufsetzen(schreiber, eventId, kalenderId, quelle, gesehen, nurDieser);
  return OK;
}

/** `PUT /api/services/:id/agenda/abgeschlossen` */
export async function abgeschlossen(eventId: number, wert: boolean): Promise<{ ok: boolean }> {
  await ablaufAbschliessen(schreiber, eventId, wert);
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

/** `PATCH /api/songs/:id/arrangements/:arrId/files/:fileId` – umbenennen, Endung bleibt (31.10.2026). */
export function dateiName(
  songId: number,
  arrangementId: number,
  fileId: number,
  name: string,
): Promise<ArrangementFileEntry[]> {
  return noten.dateiUmbenennen(schreiber, songId, arrangementId, fileId, name);
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
