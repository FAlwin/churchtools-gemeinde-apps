/**
 * Team-Notizen nach dem PCO-Modell: Anmerkungen bleiben strikt pro Konto; wer mag, TEILT seine
 * Ebene, Berechtigte können sie ANSEHEN (und clientseitig importieren). Rechte werden serverseitig
 * erzwungen (`canUseGlobalNotes` = Mitglied einer freigegebenen Gruppe/Rolle) – mit dem
 * 5-Minuten-Memo, NICHT live gegen ChurchTools je Anfrage (CT-Aussetzer-Lektion).
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../services/ctAuth.js';
import { getCapabilitiesCached } from '../services/ctCapabilities.js';
import { teiltIch } from '../services/kontoAblage.js';
import {
  anmerkungenVon,
  einstellungenVon,
  teilende,
  teilenSetzen,
} from '../services/ctTeilenServer.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ctCookie } from '../utils/ctCookie.js';
import { songIdsFromQuery } from '../utils/songIdsQuery.js';

/**
 * Seit der Ablage in ChurchTools (09.10.2026) liegt alles in den Personen-Dateien: ob jemand teilt
 * (seine eigene Daten-Datei), seine Anmerkungen und Einstellungen. Gefunden wird man über das
 * Verzeichnis der Erweiterung und die Liste auf dem Daten-Volume (`ctTeilenServer.ts`). Die Rechte
 * prüft weiter der Server, bevor er überhaupt nachsieht.
 */
async function requireTeamNotes(req: Request): Promise<void> {
  const caps = await getCapabilitiesCached(ctCookie(req), req.ctUserId ?? null);
  if (!caps.canUseGlobalNotes) {
    throw new HttpError(403, 'Keine Berechtigung für Team-Notizen.');
  }
}

function songIdsOf(req: Request): number[] {
  return songIdsFromQuery(req.query.songs);
}

function personIdOf(req: Request): number {
  const id = Number(req.params.personId);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Ungültige Personen-ID.');
  return id;
}

async function myUserId(req: Request): Promise<number> {
  return req.ctUserId ?? (await getUserId(ctCookie(req)));
}

/** GET /api/annotations/sharing – teilt mein Konto? */
export async function getSharing(req: Request, res: Response): Promise<void> {
  const userId = await myUserId(req);
  res.json({ enabled: await teiltIch(ctCookie(req), userId) });
}

const sharingSchema = z.object({ enabled: z.boolean() });

/** PUT /api/annotations/sharing – eigenes Teilen umschalten. */
export async function putSharing(req: Request, res: Response): Promise<void> {
  await requireTeamNotes(req);
  const { enabled } = sharingSchema.parse(req.body);
  res.json(await teilenSetzen(ctCookie(req), await myUserId(req), enabled));
}

/** GET /api/annotations/sharers?songs=… – wer teilt Anmerkungen zu diesen Liedern (außer mir)? */
export async function getSharers(req: Request, res: Response): Promise<void> {
  await requireTeamNotes(req);
  res.json(await teilende(ctCookie(req), await myUserId(req), songIdsOf(req)));
}

/** GET /api/annotations/of/:personId?songs=… – geteilte Anmerkungen einer Person (ohne Zoom). */
export async function getAnnotationsOf(req: Request, res: Response): Promise<void> {
  await requireTeamNotes(req);
  res.json(
    await anmerkungenVon(ctCookie(req), await myUserId(req), personIdOf(req), songIdsOf(req)),
  );
}

/** GET /api/settings/of/:personId?songs=… – ihre Lied-Einstellungen (für ihre Ansicht). */
export async function getSettingsOf(req: Request, res: Response): Promise<void> {
  await requireTeamNotes(req);
  res.json(
    await einstellungenVon(ctCookie(req), await myUserId(req), personIdOf(req), songIdsOf(req)),
  );
}
