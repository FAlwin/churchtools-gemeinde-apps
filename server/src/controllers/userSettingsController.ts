import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUserId } from '../services/ctAuth.js';
import { einstellungenHolen, einstellungenSchreiben } from '../services/kontoAblage.js';
import { ctCookie } from '../utils/ctCookie.js';
import { songIdsFromQuery } from '../utils/songIdsQuery.js';

/** GET /api/settings?songs=1,2,3 – kontobezogene Lied-Einstellungen zu diesen Liedern. */
export async function getSettings(req: Request, res: Response): Promise<void> {
  const userId = await getUserId(ctCookie(req));
  const songs = songIdsFromQuery(req.query.songs);
  res.json(await einstellungenHolen(ctCookie(req), userId, songs));
}

const bodySchema = z.record(z.string().max(120), z.string().max(4000).nullable());

/** PUT /api/settings – mehrere Einstellungen setzen/entfernen (Merge). */
export async function putSettings(req: Request, res: Response): Promise<void> {
  const userId = await getUserId(ctCookie(req));
  const entries = bodySchema.parse(req.body);
  await einstellungenSchreiben(ctCookie(req), userId, entries);
  res.json({ ok: true });
}
