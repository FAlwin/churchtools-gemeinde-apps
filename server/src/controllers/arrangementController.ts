/**
 * **Arrangements und App-Fassungen** – Verwaltung der Arrangements, Tempo, eigene Versionen (ChordPro)
 * und das Original-Notenblatt. Aus `setlistController.ts` herausgelöst (#465).
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createVersion,
  updateVersion,
  deleteVersion,
  originalNotenblattSchreiben,
} from '../services/setlistBuilder.js';
import {
  arrangementAendern,
  arrangementAnlegen,
  arrangementLoeschen,
  arrangementZumStandard,
  arrangementsLesen,
} from '../services/arrangementVerwaltung.js';
import { updateArrangementTempo } from '../services/ctWrite.js';
import { MAX_BPM, MIN_BPM } from '@shared/tempo/index';
import { ARRANGEMENT_GRENZEN } from '@shared/types/index';
import type { ArrangementAuftrag } from '@shared/types/index';
import { ctCookie } from '../utils/ctCookie.js';
import type { GleicheSchluessel } from '../utils/schemaSpiegel.js';
import { idSchema } from './idSchemas.js';

/**
 * Was ein Arrangement tragen darf (#396) – **die Grenzen kommen aus `ARRANGEMENT_GRENZEN`**, nicht
 * aus der Hand. Das Formular richtet seine `maxLength` nach derselben Liste.
 *
 * **`nullable()` ist hier kein Beiwerk:** `undefined` heißt „nicht geändert", `null` heißt „leeren".
 * Ohne den Unterschied ließe sich kein Feld je wieder freiräumen (siehe `arrangementPayload.ts`).
 */
const arrangementFelderSchema = {
  key: z.string().trim().max(ARRANGEMENT_GRENZEN.key).nullable().optional(),
  tempo: z
    .number()
    .int()
    .min(ARRANGEMENT_GRENZEN.tempo.min)
    .max(ARRANGEMENT_GRENZEN.tempo.max)
    .nullable()
    .optional(),
  beat: z.string().trim().max(ARRANGEMENT_GRENZEN.beat).nullable().optional(),
  /** Länge in SEKUNDEN – die Umrechnung aus Minuten:Sekunden macht die Oberfläche. */
  duration: z
    .number()
    .int()
    .min(ARRANGEMENT_GRENZEN.duration.min)
    .max(ARRANGEMENT_GRENZEN.duration.max)
    .nullable()
    .optional(),
  description: z.string().trim().max(ARRANGEMENT_GRENZEN.description).nullable().optional(),
  sourceId: z.number().int().positive().nullable().optional(),
  sourceReference: z.string().trim().max(ARRANGEMENT_GRENZEN.sourceReference).nullable().optional(),
};

const arrangementNameSchema = z
  .string()
  .trim()
  .min(ARRANGEMENT_GRENZEN.name.min, 'Das Arrangement braucht einen Namen.')
  .max(ARRANGEMENT_GRENZEN.name.max);

const neuesArrangementSchema = z.object({
  name: arrangementNameSchema,
  ...arrangementFelderSchema,
});

/**
 * Die Form des Änderungs-Auftrags – **exportiert, weil ein Test sie gegen den geteilten Typ
 * `ArrangementAuftrag` hält** (`setlistController.arrangement.test.ts`).
 *
 * Hier ist **jedes** Feld optional – eine Zuweisung in beide Richtungen bleibt auch dann gültig, wenn
 * dem Schema ein Feld fehlt. Am 21.09.2026 ausprobiert: Ein Wächter in der Bauart der Anmerkungen
 * ließ das entfernte `beat` anstandslos durch. Der Test prüft deshalb die **Schlüsselmenge** eines
 * vollständig ausgefüllten Auftrags, und `GleicheSchluessel` unten bricht schon den Build.
 *
 * ⚠️ Hier stand bis zum 23.09.2026, bei den Anmerkungen seien „die Felder Pflicht, ein fehlendes fällt
 * dem Compiler auf". **Das war falsch** – auch dort ist alles optional, und der Wächter ließ `bold`
 * (den Anlass #115!) durch. Die falsche Annahme ist der Grund, warum die Lehre von hier nicht dorthin
 * übertragen wurde. Seitdem nutzen alle drei Stellen denselben Baustein (`utils/schemaSpiegel.ts`).
 */
export const arrangementAendernSchema = z
  .object({ name: arrangementNameSchema.optional(), ...arrangementFelderSchema })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Es wurde keine Änderung mitgeschickt.',
  });

const _arrangementSchluessel: GleicheSchluessel<
  ArrangementAuftrag,
  z.infer<typeof arrangementAendernSchema>
> = true;
void _arrangementSchluessel;

/** GET /api/songs/:songId/arrangements/verwaltung – alle Arrangements mit allen Feldern (#396). */
export async function getArrangementsVerwaltung(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  res.json(await arrangementsLesen(ctCookie(req), songId));
}

/**
 * POST /api/songs/:songId/arrangements – ein weiteres Arrangement anlegen (#396).
 *
 * Rechte, die Quellen-Prüfung und „nie als Standard" stecken im Dienst; der Controller prüft nur die
 * Form der Eingabe.
 */
export async function postArrangement(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const auftrag = neuesArrangementSchema.parse(req.body);
  res.status(201).json(await arrangementAnlegen(ctCookie(req), songId, auftrag));
}

/**
 * PUT /api/songs/:songId/arrangements/:arrangementId – ein Arrangement ändern (#396).
 *
 * **Das ist der allgemeine Weg, den `putArrangementTempo` bewusst nicht war.** Der schmale
 * Tempo-Endpunkt bleibt trotzdem: Er wird vom Blatt aus angetippt, von jemandem, der nur das Tempo
 * meint – und er geht durch dieselbe geprüfte Payload-Funktion wie dieser hier.
 */
export async function putArrangement(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = idSchema.parse(req.params.arrangementId);
  const auftrag = arrangementAendernSchema.parse(req.body);
  res.json(await arrangementAendern(ctCookie(req), songId, arrangementId, auftrag));
}

/**
 * PATCH /api/songs/:songId/arrangements/:arrangementId/default – zum Standard machen (#396).
 *
 * Derselbe Pfad wie bei ChurchTools – nicht aus Nachahmung, sondern weil der Dienst ihn eins zu eins
 * weiterreicht. Zurück kommt die **ganze Liste**: Ein Standardwechsel ändert immer zwei Einträge,
 * und die Oberfläche soll nicht raten müssen, welcher das Flag verloren hat.
 */
export async function patchArrangementDefault(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = idSchema.parse(req.params.arrangementId);
  res.json(await arrangementZumStandard(ctCookie(req), songId, arrangementId));
}

/**
 * DELETE /api/songs/:songId/arrangements/:arrangementId – ein Arrangement löschen (#396).
 *
 * **Die Rückfrage steht in der Oberfläche** und nennt die Folgen (Notenblätter, Dateien, Versionen).
 * Hier werden Recht und die beiden Geländer geprüft – letztes Arrangement und Standard – und der
 * Name zurückgegeben, den es danach nicht mehr gibt.
 */
export async function deleteArrangementCtrl(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = idSchema.parse(req.params.arrangementId);
  const { name } = await arrangementLoeschen(ctCookie(req), songId, arrangementId);
  res.json({ name });
}

const createVersionSchema = z.object({
  arrangementId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, 'Name fehlt').max(60),
  text: z.string().min(1, 'Text fehlt'),
});

/** POST /api/songs/:songId/versions – neue benannte Version anlegen. */
export async function postVersion(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const { arrangementId, name, text } = createVersionSchema.parse(req.body);
  const version = await createVersion(ctCookie(req), songId, arrangementId, name, text);
  res.json(version);
}

/**
 * Grenzen aus `@shared/tempo` – dieselben, die im Client über den Speichern-Knopf entscheiden.
 * Abgeschrieben waren sie hier schon einmal (`.min(20).max(300)`); dann prüfen zwei Stellen
 * denselben Bereich und die Frage ist nur, wann sie auseinanderlaufen.
 */
export const tempoSchema = z.object({
  tempo: z.coerce.number().int().min(MIN_BPM).max(MAX_BPM),
});

/**
 * PUT /api/songs/:songId/arrangements/:arrangementId/tempo – Tempo eines Arrangements setzen.
 *
 * Der Endpunkt ist BEWUSST schmal – er kann nur das Tempo. Ein allgemeines „Arrangement ändern"
 * wäre gefährlicher, als es klingt: `PUT` ersetzt in ChurchTools den ganzen Datensatz, ein
 * unvollständiger Rumpf löscht Tonart und Dauer (siehe `arrangementPayload.ts`). Was der Server
 * nicht anbietet, kann auch niemand versehentlich aufrufen.
 *
 * Der Wert kommt vom Antippen und landet in ChurchTools – dort gilt er für ALLE.
 */
export async function putArrangementTempo(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = idSchema.parse(req.params.arrangementId);
  const { tempo } = tempoSchema.parse(req.body);
  // Rechte erzwingt ChurchTools selbst – das Cookie des Nutzers geht durch, wie beim Bearbeiten
  // der ChordPro-Versionen. Ein 401/403 kommt als 403 zurück.
  await updateArrangementTempo(ctCookie(req), songId, arrangementId, tempo);
  res.json({ tempo });
}

const updateVersionSchema = z.object({
  arrangementId: z.coerce.number().int().positive(),
  text: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(60).optional(),
});

/** PUT /api/songs/:songId/versions/:versionKey – Version aktualisieren (Text und/oder Name). */
export async function putVersion(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const versionKey = z.string().min(1).parse(req.params.versionKey);
  const { arrangementId, text, name } = updateVersionSchema.parse(req.body);
  const version = await updateVersion(ctCookie(req), songId, arrangementId, versionKey, {
    text,
    name,
  });
  res.json(version);
}

const deleteSchema = z.object({ arrangementId: z.coerce.number().int().positive() });

/** DELETE /api/songs/:songId/versions/:versionKey – benannte Version löschen (Original bleibt). */
export async function deleteVersionCtrl(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const versionKey = z.string().min(1).parse(req.params.versionKey);
  const { arrangementId } = deleteSchema.parse(req.body);
  await deleteVersion(ctCookie(req), songId, arrangementId, versionKey);
  res.json({ ok: true });
}

/**
 * Die Dateiverwaltung eines Arrangements (#321).
 *
 * **Rechte:** wie bei den ChordPro-Versionen und beim Tempo – das Cookie des Nutzers geht durch,
 * **ChurchTools entscheidet**. Ein 401/403 kommt als verständliche Meldung zurück (`csrfWriteDenied`,
 * #298). Eine zusätzliche eigene Prüfung stünde daneben und wäre die zweite Stelle für dieselbe
 * Regel – genau das, was in diesem Projekt regelmäßig auseinanderläuft. Die Oberfläche zeigt den
 * Einstieg nur bei `canEditSong`; erzwungen wird er nicht dort, sondern in ChurchTools.
 */

/**
 * PUT /api/songs/:songId/arrangements/:arrangementId/chordpro
 *
 * Schreibt das **Original**-Notenblatt aus eigenem Text – der Editor nach dem Anlegen (Wunsch Alwin,
 * 04.09.2026). Ersetzt ein vorhandenes Original über dieselbe Stelle wie der SongSelect-Import
 * (`originalNotenblattSchreiben`); die verwalteten Versionen `(App)` bleiben unangetastet.
 *
 * Obergrenze wie beim Datei-Upload gedacht: Ein Notenblatt hat ein paar Kilobyte, 200 kB sind weit
 * darüber – eine Grenze gegen Versehen, nicht gegen Nutzer.
 */
export async function putNotenblatt(req: Request, res: Response): Promise<void> {
  const songId = idSchema.parse(req.params.songId);
  const arrangementId = idSchema.parse(req.params.arrangementId);
  const { text } = z
    .object({
      text: z.string().trim().min(1, 'Der Text ist leer.').max(200_000, 'Der Text ist zu lang.'),
    })
    .parse(req.body);
  res.json(await originalNotenblattSchreiben(ctCookie(req), songId, arrangementId, text));
}
