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
  type CtSchreiber,
  type GeloeschterPunkt,
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
import { ablaufAnlegen } from '@shared/ct/ablaufAnlegen';
import type { AblaufQuelle } from '@shared/types/index';
import type { PunktStand } from '@shared/ct/ablaufZeile';
import type { CtVerwalter } from '@shared/ct/liedVerwaltung';
import * as noten from '@shared/ct/notenblaetter';
import type { CtNotenSchreiber } from '@shared/ct/notenblaetter';
import { notenblattAusSongSelect } from '@shared/ct/songselect';
import { songSelect } from './ctSongSelect';
import { ApiError } from './api';
import { browserSchreiber, schreibFehler } from '@ui/ct/schreiber';
import { ctAnfrage } from './ctRuntime';
import { bearbeitbareKategorien, leser, quellen } from './ctLesen';

/** Der `CtSchreiber` des Browsers (`@ui/ct/schreiber`) samt Liedverwaltung und Notenblättern. */
const schreiber: CtSchreiber & CtVerwalter & CtNotenSchreiber = {
  ...browserSchreiber,
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

/** `PUT /api/services/:id/agenda/abgeschlossen` */
export async function ablaufNeu(
  eventId: number,
  kalenderId: number,
  quelle: AblaufQuelle,
): Promise<{ ok: boolean }> {
  await ablaufAnlegen(schreiber, eventId, kalenderId, quelle);
  return OK;
}

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
