/**
 * **CCLI SongSelect** – suchen, ein Lied, Liedtext, ChordPro holen. Aus `setlistController.ts`
 * herausgelöst (#465).
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { holeChordProAusSongSelect } from '../services/setlistBuilder.js';
import {
  getSongSelectLyrics,
  getSongSelectSong,
  searchSongSelect,
} from '../services/ctSongSelect.js';
import { ctCookie } from '../utils/ctCookie.js';
import { idSchema } from './idSchemas.js';

/** GET /api/songselect/search?title=… */
export async function getSongSelectSearch(req: Request, res: Response): Promise<void> {
  const title = z.string().min(1).max(200).parse(req.query.title);
  res.json(await searchSongSelect(ctCookie(req), title));
}

/** GET /api/songselect/songs/:songNumber */
export async function getSongSelectByNumber(req: Request, res: Response): Promise<void> {
  const songNumber = idSchema.parse(req.params.songNumber);
  res.json(await getSongSelectSong(ctCookie(req), songNumber));
}

/**
 * GET /api/songselect/songs/:songNumber/liedtext – **der Liedtext eines SongSelect-Liedes** (#379).
 *
 * Grundlage der Vorschau: Bei 147 Treffern zu einem Titel entscheidet nur der Text, welches Lied gemeint
 * ist. Der `disclaimer` von CCLI geht mit durch – er **muss** angezeigt werden.
 *
 * **Nur beim bewussten Öffnen eines Treffers aufrufen, nie beim Durchsehen einer Liste:** Aufs
 * Kontingent zählt er laut CCLI nicht; ob er in der Nutzungs-Historie erscheint, ist offen (siehe
 * `songSelectLiedtext`). Der Client speichert je Nummer
 * zwischen, damit Auf- und Zuklappen nicht mehrfach fragt.
 */
export async function getSongSelectLyricsCtrl(req: Request, res: Response): Promise<void> {
  const songNumber = idSchema.parse(req.params.songNumber);
  res.json(await getSongSelectLyrics(ctCookie(req), songNumber));
}

/**
 * POST /api/songs/:songId/arrangements/:arrangementId/songselect/chordpro
 *
 * Holt das Notenblatt aus CCLI SongSelect ins Arrangement (#322). **Der einzige schreibende
 * SongSelect-Weg** – er ersetzt ein vorhandenes Original-ChordPro (Begründung am Dienst).
 */
export async function postSongSelectChordPro(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = idSchema.parse(req.params.arrangementId);
  const { songNumber } = z.object({ songNumber: z.number().int().positive() }).parse(req.body);
  res.json(await holeChordProAusSongSelect(ctCookie(req), songId, arrangementId, songNumber));
}
