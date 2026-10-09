/**
 * **Dateien am Arrangement** – ausliefern (Datei-Proxy mit Content-Type-Härtung, #138), auflisten,
 * hochladen, löschen. Aus `setlistController.ts` herausgelöst (#465).
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  resolveFileUrl,
  listArrangementFiles,
  addArrangementFile,
  removeArrangementFile,
} from '../services/setlistBuilder.js';
import { fetchFileBytes } from '../services/ctFiles.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ctCookie } from '../utils/ctCookie.js';
import { sanitizeFileContentType } from '@shared/dateien/index';
import { idSchema } from './idSchemas.js';

// Content-Type-Härtung (#138) – Regel in `@shared/dateien`, hier weitergereicht (Tests, #335).
export { sanitizeFileContentType };

/** GET /api/songs/:songId/files/:fileId – Datei (PDF/Bild) aus ChurchTools durchreichen. */
export async function getFile(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const fileId = idSchema.parse(req.params.fileId);
  const cookie = ctCookie(req);
  const fileUrl = await resolveFileUrl(cookie, songId, fileId);
  const { buffer, contentType: raw } = await fetchFileBytes(cookie, fileUrl);
  const { contentType, attachment } = sanitizeFileContentType(raw);
  res.setHeader('Content-Type', contentType);
  // nosniff ist global (Helmet) gesetzt; hier zusätzlich, damit ein durchgereichter octet-stream
  // NIE per Content-Sniffing doch als HTML interpretiert wird.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (attachment) res.setHeader('Content-Disposition', 'attachment');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(buffer);
}

/** GET /api/songs/:songId/arrangements/:arrangementId/files */
export async function getArrangementFiles(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = idSchema.parse(req.params.arrangementId);
  res.json(await listArrangementFiles(ctCookie(req), songId, arrangementId));
}

/**
 * POST /api/songs/:songId/arrangements/:arrangementId/files?name=<Dateiname>
 *
 * **Roher Rumpf, kein Multipart.** Der Browser schickt die Datei unverändert als Body, Art über
 * `Content-Type`, Name über `?name=`. Das spart eine Abhängigkeit fürs Zerlegen von Multipart – und
 * eine Abhängigkeit, die Dateien aus dem Netz zerlegt, ist eine Angriffsfläche, die wir für einen
 * einzigen Endpunkt nicht brauchen. Zusammengesetzt wird das Multipart erst zu ChurchTools hin, in
 * `uploadFile`.
 */
export async function postArrangementFile(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = idSchema.parse(req.params.arrangementId);
  const filename = z.string().min(1).max(255).parse(req.query.name);
  const mime = z
    .string()
    .min(1)
    .max(255)
    .catch('application/octet-stream')
    .parse(req.get('content-type'));

  // `express.raw` legt den Rumpf als Buffer ab. Ein leerer Rumpf ist ein Fehler und kein leeres
  // Dokument: Er entstünde bei einem abgebrochenen Upload, und eine 0-Byte-Datei in ChurchTools
  // sähe aus wie eine echte.
  const inhalt = req.body as unknown;
  if (!Buffer.isBuffer(inhalt) || inhalt.length === 0) {
    throw new HttpError(400, 'Die Datei ist leer oder wurde nicht vollständig übertragen.');
  }

  res.json(
    await addArrangementFile(ctCookie(req), songId, arrangementId, {
      filename,
      mime,
      inhalt,
    }),
  );
}

/** DELETE /api/songs/:songId/files/:fileId */
export async function deleteArrangementFileCtrl(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const fileId = idSchema.parse(req.params.fileId);
  await removeArrangementFile(ctCookie(req), songId, fileId);
  res.status(204).end();
}

/**
 * CCLI SongSelect (#322) – **nur die lesenden Wege**: suchen und abfragen.
 *
 * Beide ändern nichts und sind beliebig wiederholbar; das Herunterladen kommt später an eigener
 * Stelle mit eigener Rückfrage.
 *
 * **Rechte:** wie überall geht das Cookie des Nutzers durch und ChurchTools entscheidet. Zusätzlich
 * meldet `capabilities.canUseCcli`, ob die Gemeinde SongSelect überhaupt hat – damit die Oberfläche
 * den Einstieg gar nicht erst zeigt, statt einen Knopf anzubieten, der immer scheitert.
 */
