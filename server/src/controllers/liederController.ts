/**
 * **Lieder** – Bibliothek, Anlegen/Ändern/Löschen, Stammdaten, Kategorien und Quellen, Liedblatt,
 * Statistik, Liedtext-Suche und -Vorschau. Aus `setlistController.ts` herausgelöst (#465).
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSongLibrary, getSongChart, getSongUsageMap } from '../services/setlistBuilder.js';
import { getCapabilitiesCached } from '../services/ctCapabilities.js';
import { getSong } from '../services/ctRead.js';
import { getEditableSongCategories } from '../services/ctSongCategories.js';
import { getSongSources } from '../services/ctSongSources.js';
import { liedAendern, liedAnlegen, liedLoeschen } from '../services/songVerwaltung.js';
import { stammdatenAnsicht } from '@shared/ct/liedVerwaltung';
import { liedtextVorschau, sucheImLiedtext } from '../services/songTextIndex.js';
import { arrangementOptionen } from '@shared/ct/setlistKern';
import { LIED_GRENZEN } from '@shared/types/index';
import type { SongArrangementOption } from '@shared/types/index';
import { HttpError } from '../middleware/errorHandler.js';
import { ctCookie } from '../utils/ctCookie.js';
import { idSchema, arrSchema } from './idSchemas.js';

/** GET /api/songs/:songId/arrangements – Arrangements eines bekannten Lieds (für „Zu Ablauf hinzufügen"). */
export async function getSongArrangementsCtrl(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const song = await getSong(ctCookie(req), songId);
  const result: SongArrangementOption[] = arrangementOptionen(song);
  res.json(result);
}

/** GET /api/song-library – alle Lieder (Standard-Arrangement) für die „Alle Lieder"-Ansicht. */
export async function getSongLibraryCtrl(req: Request, res: Response): Promise<void> {
  const songs = await getSongLibrary(ctCookie(req));
  res.json(songs);
}

/**
 * GET /api/song-categories – die Kategorien, in denen der Nutzer Lieder anlegen/ändern darf (#322).
 *
 * **Schon zugeschnitten.** Der Dienst schneidet die Liste am ChurchTools-Recht zu; die Oberfläche
 * bekommt gar nichts zu sehen, was ChurchTools ablehnen würde. Dieselbe Funktion prüft beim Anlegen,
 * ob die gewählte Kategorie erlaubt war – eine Prüfung, die nur in der Oberfläche steht, ist keine.
 */
export async function getSongCategoriesCtrl(req: Request, res: Response): Promise<void> {
  const categories = await getEditableSongCategories(ctCookie(req));
  res.json(categories);
}

/**
 * Ein neues Lied, wie es aus dem Formular kommt (#322, Schritt 10).
 *
 * **Die Grenzen stammen von ChurchTools selbst** (gemessen mit leerem Rumpf, 07.08.2026): Name 2–200
 * Zeichen, `categoryId` eine Ganzzahl. Geprüft wird hier trotzdem, damit ein Tippfehler eine
 * verständliche deutsche Meldung ergibt und nicht erst nach einer Runde durch ChurchTools auffällt.
 *
 * **Die Zahlen kommen aus `LIED_GRENZEN` (`@shared/types`), nicht aus der Hand.** Das Formular richtet
 * seine `maxLength` nach derselben Liste; hier ein zweites Mal hingeschriebene Werte wären zwei
 * Stellen, die auseinanderlaufen, sobald ChurchTools eine Grenze verschiebt.
 *
 * **`categoryId` ist `nonnegative`, nicht `positive`:** Kategorie **0** ist echt („Aktive Songs").
 * Mit `positive()` wäre ausgerechnet die Kategorie unmöglich, in der bei der ECG alle Lieder liegen.
 */
const neuesLiedSchema = z.object({
  name: z
    .string()
    .trim()
    .min(LIED_GRENZEN.name.min, `Der Liedname braucht mindestens ${LIED_GRENZEN.name.min} Zeichen.`)
    .max(LIED_GRENZEN.name.max),
  categoryId: z.number().int().nonnegative(),
  author: z.string().trim().max(LIED_GRENZEN.author).optional(),
  ccli: z.string().trim().max(LIED_GRENZEN.ccli).optional(),
  copyright: z.string().trim().max(LIED_GRENZEN.copyright).optional(),
  key: z.string().trim().max(LIED_GRENZEN.key).optional(),
  arrangementName: z.string().trim().max(LIED_GRENZEN.arrangementName).optional(),
});

/**
 * POST /api/songs – ein neues Lied anlegen (#322, Schritt 10).
 *
 * Rechte, Doppel-Erkennung und die Reihenfolge der Schreibvorgänge stecken im Dienst; der Controller
 * prüft nur die Form der Eingabe. Antwort ist `201` mit den neuen IDs – und, wenn ein Termin
 * mitgegeben war, mit der ehrlichen Auskunft, ob der Ablauf-Eintrag geklappt hat.
 */
export async function postSong(req: Request, res: Response): Promise<void> {
  /**
   * **Eine alte App laut abweisen, nicht still bedienen** (Alwin, 05.10.2026: „Alles jetzt").
   *
   * Bis zum 05.10.2026 trug der Server das neue Lied auf Wunsch gleich in einen Ablauf ein (`eventId`).
   * Eine noch nicht aktualisierte App schickt das weiter mit. Ohne diese Prüfung würde zod das Feld
   * still wegwerfen: Das Lied entstünde, landete aber nicht im Ablauf – und die alte App meldete nichts.
   * Deshalb wird VOR dem Anlegen abgelehnt; so entsteht auch kein halbes Ergebnis.
   */
  if (typeof req.body === 'object' && req.body !== null && 'eventId' in req.body) {
    throw new HttpError(
      410,
      'Diese Version der App ist veraltet – bitte die App neu laden. Das Lied wurde nicht angelegt.',
    );
  }
  const daten = neuesLiedSchema.parse(req.body);
  res.status(201).json(await liedAnlegen(ctCookie(req), daten));
}

/**
 * Was sich an den Stammdaten ändern lässt (#322, Schritt 11).
 *
 * **Jedes Feld ist optional – aber nicht beliebig leer.** Ein fehlendes Feld heißt „nicht geändert",
 * ein leerer Text heißt „löschen" (Autor, CCLI-Nummer, Copyright dürfen weg). Beim **Namen** gilt das
 * nicht: Er ist in ChurchTools Pflicht, deshalb dieselbe Mindestlänge wie beim Anlegen.
 *
 * Die Grenzen kommen aus `LIED_GRENZEN` – dieselbe Liste, die auch das Anlegen und das Formular
 * benutzen.
 */
const liedAendernSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(
        LIED_GRENZEN.name.min,
        `Der Liedname braucht mindestens ${LIED_GRENZEN.name.min} Zeichen.`,
      )
      .max(LIED_GRENZEN.name.max)
      .optional(),
    categoryId: z.number().int().nonnegative().optional(),
    author: z.string().trim().max(LIED_GRENZEN.author).optional(),
    ccli: z.string().trim().max(LIED_GRENZEN.ccli).optional(),
    copyright: z.string().trim().max(LIED_GRENZEN.copyright).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Es wurde keine Änderung mitgeschickt.',
  });

// Die Antwortform für Stammdaten – einmal, für Lesen und Schreiben – steht seit #335 (3b-2) in
// `@shared/ct/liedVerwaltung`; die Extension antwortet ihrer Oberfläche genauso.
/**
 * GET /api/songs/:songId/stammdaten – was im Änderungsformular stehen soll (#322, Schritt 11).
 *
 * **Warum ein eigener Weg und nicht die Bibliothek:** `SongLibraryEntry` kennt CCLI-Nummer, Copyright
 * und Kategorie nicht. Sie dort zu ergänzen hieße, sie in **jede** Liedliste mitzuschleppen – Felder,
 * die kein Bildschirm anzeigt. Hier werden sie für genau ein Lied geholt, wenn das Formular aufgeht.
 */
export async function getSongStammdaten(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  res.json(stammdatenAnsicht(await getSong(ctCookie(req), songId)));
}

/**
 * PUT /api/songs/:songId – Stammdaten eines Liedes ändern (#322, Schritt 11).
 *
 * Rechte an alter und neuer Kategorie, die CCLI-Blockade und das **lesen–ändern–schreiben** stecken im
 * Dienst; der Controller prüft nur die Form. Zurück kommt das Lied, wie ChurchTools es **danach**
 * liest – nicht das, was das Formular geschickt hat.
 */
export async function putSong(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const aenderung = liedAendernSchema.parse(req.body);
  res.json(stammdatenAnsicht(await liedAendern(ctCookie(req), songId, aenderung)));
}

/**
 * DELETE /api/songs/:songId – ein Lied samt allem, was daran hängt, löschen (#322, Schritt 11).
 *
 * **Die Rückfrage steht in der Oberfläche**, nicht hier: Sie muss die Folgen nennen (Arrangements,
 * Notenblätter, Dateien), und dafür braucht sie den Zusammenhang. Hier wird das Recht geprüft und der
 * Name zurückgegeben – nach dem Löschen gibt es ihn nicht mehr, die Meldung braucht ihn aber.
 *
 * **Kein `invalidateSongUsageCache`:** Die Statistik zählt, welche Lieder an welchem Datum gespielt
 * wurden; ein gelöschtes Lied verschwindet ohnehin aus der Bibliothek.
 */
export async function deleteSongCtrl(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const { name } = await liedLoeschen(ctCookie(req), songId);
  res.json({ name });
}

/** GET /api/song-sources – die Liedquellen (Liederbücher) der Gemeinde (#396). */
export async function getSongSourcesCtrl(req: Request, res: Response): Promise<void> {
  res.json(await getSongSources(ctCookie(req)));
}

/**
 * GET /api/song-text-search?q=… – **Suche in den Liedtexten** (#322).
 *
 * Der Index wird beim ersten Aufruf gebaut (ein Datei-Download je Lied) und dann eine Stunde gehalten;
 * gebündelt und gedrosselt, siehe `songTextIndex.ts`. Unter drei Zeichen wird nicht gesucht – kürzere
 * Begriffe treffen fast jedes Lied und der Aufwand wäre für nichts.
 */
export async function getSongTextSearch(req: Request, res: Response): Promise<void> {
  const q = z
    .string()
    .trim()
    .max(100)
    .parse(req.query.q ?? '');
  res.json(await sucheImLiedtext(ctCookie(req), q));
}

/**
 * GET /api/songs/:songId/liedtext-vorschau – **der Textanfang EINES Liedes** (#379).
 *
 * Für den Fall, dass mehrere Lieder gleich heißen: Ohne einen Blick in den Text ist nicht zu entscheiden,
 * welches gemeint ist. **Baut den Suchindex NICHT** – er wird nur benutzt, wenn er ohnehin frisch
 * dasteht; sonst wird genau dieses eine Notenblatt geladen (siehe `liedtextVorschau`).
 *
 * `vorschau: null` heißt „hat keinen Text" – ein eigener Fall, kein Fehler: Die Oberfläche zeigt dann
 * gar keine Vorschau statt einer leeren.
 */
export async function getLiedtextVorschau(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  // Das rohe ChordPro – die Abschnitte baut der Client mit dem Parser des Blattes (04.09.2026).
  res.json({ chordpro: await liedtextVorschau(ctCookie(req), songId) });
}

/**
 * GET /api/song-usage – Nutzungsdaten je Song (Häufigkeit + zuletzt), separat/gecacht.
 *
 * **Erst das eigene Recht, dann der Zwischenspeicher:** Die Statistik wird für alle gemerkt; ohne diese
 * Prüfung bekäme auch wer ohne „Song-Statistik sehen" den Stand, den ein Musiker gerade geladen hat
 * (Alwin, 08.10.2026: nur Musiker sollen sie sehen). Die Rechte sind je Sitzung fünf Minuten gemerkt
 * (`getCapabilitiesCached`) – meist kostet die Prüfung also keinen Abruf bei ChurchTools.
 */
export async function getSongUsageCtrl(req: Request, res: Response): Promise<void> {
  const cookie = ctCookie(req);
  // Gemerkt (#466) – ungemerkt kostete jeder Statistik-Aufruf zwei Anfragen bei ChurchTools.
  const caps = await getCapabilitiesCached(cookie, req.ctUserId ?? null);
  if (!caps.canViewSongStatistics) {
    throw new HttpError(
      403,
      'Keine Berechtigung für die Lied-Statistik (Recht „Song-Statistik sehen").',
    );
  }
  const usage = await getSongUsageMap(cookie);
  res.json(usage);
}

/** GET /api/songs/:songId/chart – Chart-Daten eines einzelnen Lieds. */
export async function getSongChartCtrl(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = arrSchema.parse(req.query.arrangementId);
  const song = await getSongChart(ctCookie(req), songId, arrangementId);
  res.json(song);
}
