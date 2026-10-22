/**
 * **Termine und Ablauf** – Gottesdienste, Ablaufpunkte, „geändert"-Hinweis, Rechte und Dienste.
 *
 * Bis #465 stand hier alles (843 Zeilen, ~50 Handler). Aufgeteilt nach Fachbereich: Lieder in
 * `liederController.ts`, Arrangements und App-Fassungen in `arrangementController.ts`, Dateien in
 * `dateiController.ts`, SongSelect in `songSelectController.ts`. Reines Verschieben, keine Logik geändert.
 */
import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/errorHandler.js';
import {
  getServicesOhneAblauf,
  getServicesWithSetlists,
  getAgendaItems,
  getSetlistFingerprint,
  getSetlistState,
  invalidateSongUsageCache,
} from '../services/setlistBuilder.js';
import { getMemoizedVersion, rememberVersion } from '../services/versionMemo.js';
import { getUserId } from '../services/ctAuth.js';
import { getCapabilities } from '../services/ctCapabilities.js';
import { getAblaufVorlagen, getCtServices } from '../services/ctRead.js';
import { getSiteConfig } from '../services/siteConfig.js';
import {
  createAgendaItem,
  deleteAgendaItem,
  reorderAgenda,
  restoreAgendaItem,
  setAgendaItemVorBeginn,
  setAgendaItemWeggelassen,
  updateAgendaItem,
  setAblaufAbgeschlossen,
  createAblauf,
} from '../services/ctWrite.js';
import { gesehenHolen, gesehenMerken } from '../services/kontoAblage.js';
import { setlistGeaendert, standardFenster } from '@shared/ct/setlistKern';
import type { AgendaServiceOption } from '@shared/types/index';
import { ctCookie } from '../utils/ctCookie.js';
import { accountKey } from '../middleware/session.js';
import { idSchema } from './idSchemas.js';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

/** GET /api/services – Gottesdienste mit Setlist. */
export async function getServices(req: Request, res: Response): Promise<void> {
  const cookie = ctCookie(req);
  const def = standardFenster();
  const from = dateSchema.parse(req.query.from) ?? def.from;
  const to = dateSchema.parse(req.query.to) ?? def.to;
  const withHashes = await getServicesWithSetlists(
    cookie,
    from,
    to,
    accountKey(req.ctUserId, cookie),
  );
  // „Geändert"-Badge je Konto (#143): mit dem zuletzt gesehenen Fingerabdruck vergleichen. Ohne
  // gemerkten Stand (nie geöffnet) gilt NICHT als geändert. userId best effort aus dem Cookie
  // (seit #149) – fehlt sie, wird ohne Badge ausgeliefert (Komfort-Feature, kein harter Fehler).
  let seen: Awaited<ReturnType<typeof gesehenHolen>> = {};
  try {
    const userId = req.ctUserId ?? (await getUserId(cookie));
    seen = await gesehenHolen(cookie, userId);
  } catch {
    /* Konto-ID/Datei nicht verfügbar → ohne Badge ausliefern */
  }
  const services = withHashes.map(({ service, hash }) => {
    const prev = seen[String(service.id)];
    return { ...service, setlistChanged: setlistGeaendert(prev, hash) };
  });
  res.json(services);
}

/**
 * GET /api/services/ohne-ablauf – Veranstaltungen ohne Ablauf, die laut Verwaltung einen bekommen
 * sollen (13.10.2026). Eigene Abfrage neben `/api/services`, damit alles, was dort einen Ablauf
 * voraussetzt (Offline-Vorrat, Liederheft, Navigation), unverändert bleibt.
 */
export async function getServicesOhneAblaufCtrl(req: Request, res: Response): Promise<void> {
  const cookie = ctCookie(req);
  const regel = (await getSiteConfig()).ablaufAnlegen;
  res.json(await getServicesOhneAblauf(cookie, accountKey(req.ctUserId, cookie), regel));
}

/** GET /api/ablauf-vorlagen – die Ablauf-Vorlagen aus ChurchTools (13.10.2026). */
export async function getAblaufVorlagenCtrl(req: Request, res: Response): Promise<void> {
  res.json(await getAblaufVorlagen(ctCookie(req)));
}

const ablaufAnlegenSchema = z.object({
  kalenderId: idSchema,
  quelle: z.discriminatedUnion('art', [
    z.object({ art: z.literal('vorlage'), vorlageId: idSchema }),
    z.object({ art: z.literal('kopie'), eventId: idSchema }),
    z.object({ art: z.literal('leer') }),
  ]),
});

/**
 * POST /api/services/:eventId/agenda – einen Ablauf anlegen (13.10.2026). 409, wenn es schon einen
 * gibt; Regel und Nachlesen in `@shared/ct/ablaufAnlegen`.
 */
export async function postAblaufCtrl(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const { kalenderId, quelle } = ablaufAnlegenSchema.parse(req.body);
  if (quelle.art === 'kopie' && quelle.eventId === eventId) {
    throw new HttpError(400, 'Ein Ablauf kann nicht aus sich selbst kopiert werden.');
  }
  await createAblauf(ctCookie(req), eventId, kalenderId, quelle);
  // Kopie oder Vorlage können Lieder enthalten – die Statistik holt sie beim nächsten Blick neu.
  invalidateSongUsageCache();
  res.json({ ok: true });
}

/**
 * GET /api/services/:eventId/setlist/version – aktueller Ablauf-Fingerabdruck (Live-Abgleich).
 * Bewusst leichtgewichtig: nur die Roh-Agenda (KEINE ChordPro-Downloads). Der Client pollt das,
 * solange ein Ablauf offen ist, und lädt bei Änderung den vollen Ablauf nach.
 */
export async function getSetlistVersion(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  // Bei Alt-Cookies ohne Konto-ID nicht das rohe Session-Cookie als Map-Schlüssel halten (#215),
  // sondern nur dessen Fingerabdruck – gleiche Trennschärfe, ohne das Geheimnis zusätzlich im
  // Speicher zu spiegeln.
  //
  // Hinweis zum Umbau in #306: Vorher stand die Ableitung hier von Hand und lieferte bei bekannter
  // Konto-ID die NACKTE Zahl (`42|1500`); `accountKey` liefert `u42|1500`. Das ist folgenlos – das
  // Memo lebt nur im Arbeitsspeicher und verfällt nach fünf Sekunden, es gibt also nichts zu
  // migrieren. Genannt sei es trotzdem, weil „verhaltensgleich" hier nicht ganz stimmt.
  const who = accountKey(req.ctUserId, ctCookie(req));
  const memoKey = `${eventId}|${who}`;
  const memoized = getMemoizedVersion(memoKey);
  if (memoized !== null) {
    res.json({ hash: memoized });
    return;
  }
  const hash = await getSetlistFingerprint(ctCookie(req), eventId);
  rememberVersion(memoKey, hash);
  res.json({ hash });
}

/** POST /api/services/:eventId/seen – merkt den aktuellen Setlist-Stand als „gesehen" (#143). */
export async function markSetlistSeen(req: Request, res: Response): Promise<void> {
  const cookie = ctCookie(req);
  const eventId = idSchema.parse(req.params.eventId);
  const userId = req.ctUserId ?? (await getUserId(cookie));
  const { hash, items } = await getSetlistState(cookie, eventId);
  await gesehenMerken(cookie, userId, eventId, hash, items);
  res.json({ ok: true });
}

export const orderSchema = z.object({
  order: z.array(z.coerce.number().int().positive()).min(1),
  // Die Reihenfolge vor dem Ziehen (E6-3c, #659) – ohne diese Zeile striche zod sie still weg.
  gesehen: z.array(z.coerce.number().int().positive()).optional(),
});

/** Was das Punkt-Fenster beim Öffnen gesehen hat (`PunktStand`, E6-3c) – Grenzen großzügig, es kommt aus ChurchTools. */
const punktStandSchema = z.object({
  title: z.string().max(4000),
  responsibleText: z.string().max(4000),
  durationMin: z.number().int().min(0).nullable(),
  note: z.string().max(10000),
  lied: z.union([z.number().int(), z.string().max(4000)]).nullable(),
});

/** PATCH /api/services/:eventId/agenda/order – neue Reihenfolge der Ablaufpunkte speichern. */
export async function putAgendaOrder(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const { order, gesehen } = orderSchema.parse(req.body);
  await reorderAgenda(ctCookie(req), eventId, order, gesehen);
  // BEWUSST ohne `invalidateSongUsageCache` (#300): Die Reihenfolge ändert nicht, WELCHE Lieder an
  // welchem Datum gespielt wurden – die Statistik kann sich dadurch nicht ändern. Bitte nicht als
  // vergessene Lücke „nachrüsten". (Bis v2.32.0 kostete jedes Verwerfen einen Lauf mit ~250
  // Anfragen; heute ist es ein Aufruf, aber ein unnötiger bleibt unnötig.)
  res.json({ ok: true });
}

export const updateItemSchema = z
  .object({
    // Was das Fenster beim Öffnen gesehen hat (E6-3c) – ohne diese Zeile striche zod es still weg.
    gesehen: punktStandSchema.optional(),
    title: z.string().trim().min(1, 'Titel fehlt').max(255).optional(),
    // arrangementId verknüpft einen bestehenden Punkt mit einem Lied (wandelt ihn in type 'song').
    arrangementId: z.coerce.number().int().positive().optional(),
    // unlink löst eine bestehende Lied-Verknüpfung wieder (Punkt bleibt als leerer Text-Eintrag).
    unlink: z.boolean().optional(),
    // responsible: Textfeld der Zuständigen (z.B. „[Musik]"); CT löst Dienst-Tokens selbst auf.
    responsible: z.string().trim().max(1000).optional(),
    // durationMin: Dauer des Punkts in Minuten (0–600); Server rechnet in CT-Sekunden um.
    durationMin: z.coerce.number().int().min(0).max(600).optional(),
    // note: Bemerkung/Beschreibung des Punkts (frei, kann leeren String haben = löschen).
    note: z.string().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.arrangementId !== undefined ||
      d.unlink === true ||
      d.responsible !== undefined ||
      d.durationMin !== undefined ||
      d.note !== undefined,
    { message: 'Titel, arrangementId, unlink, responsible, durationMin oder note erforderlich.' },
  );

const createItemSchema = z
  .object({
    type: z.enum(['header', 'text', 'song']),
    title: z.string().trim().max(255).optional(),
    arrangementId: z.coerce.number().int().positive().optional(),
    responsible: z.string().trim().max(1000).optional(),
    note: z.string().max(2000).optional(),
    durationMin: z.coerce.number().int().min(0).optional(),
  })
  .refine((d) => d.type !== 'song' || d.arrangementId !== undefined, {
    message: 'Für ein Lied ist arrangementId erforderlich.',
    path: ['arrangementId'],
  });

/** POST /api/services/:eventId/agenda/items – neuen Ablaufpunkt anlegen. */
export async function postAgendaItem(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  // Standard-Titel je Art: in `@shared/ct/schreibKern` (#335) – die Extension legt genauso an.
  await createAgendaItem(ctCookie(req), eventId, createItemSchema.parse(req.body));
  // Der nächste Blick in die Statistik holt sie neu – seit 08.10.2026 ein einziger Abruf bei ChurchTools
  // (`getSongStatistic`), kein Lauf über alle Abläufe mehr (#300).
  invalidateSongUsageCache();
  res.json({ ok: true });
}

/** PUT /api/services/:eventId/agenda/items/:itemId – Punkt umbenennen oder mit Lied verknüpfen. */
export async function putAgendaItem(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const itemId = idSchema.parse(req.params.itemId);
  // „Aufheben leert den Titel": in `@shared/ct/schreibKern` (#335) – die Extension schreibt genauso.
  const { gesehen, ...felder } = updateItemSchema.parse(req.body);
  await updateAgendaItem(ctCookie(req), eventId, itemId, felder, gesehen);
  invalidateSongUsageCache();
  res.json({ ok: true });
}

const vorBeginnSchema = z.object({ vorBeginn: z.boolean() });

/**
 * PUT /api/services/:eventId/agenda/items/:itemId/vor-beginn – Vorlauf festlegen (#423): dieser
 * Punkt läuft vor dem Beginn der Veranstaltung (`true`) oder gehört zum Gottesdienst (`false`).
 */
export async function putAgendaItemVorBeginn(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const itemId = idSchema.parse(req.params.itemId);
  const { vorBeginn } = vorBeginnSchema.parse(req.body);
  await setAgendaItemVorBeginn(ctCookie(req), eventId, itemId, vorBeginn);
  // BEWUSST ohne `invalidateSongUsageCache` (#300): Die Grenze verschiebt nur Uhrzeiten, nicht die
  // gespielten Lieder. Siehe die Begründung bei `putAgendaOrder`.
  res.json({ ok: true });
}

const weglassenSchema = z.object({ weggelassen: z.boolean() });

/**
 * PUT /api/services/:eventId/agenda/items/:itemId/weglassen – den Punkt an diesem Termin weglassen (`true`) oder
 * wieder zeigen (`false`), Auge in ChurchTools (E6-3b, #652).
 */
export async function putAgendaItemWeglassen(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const itemId = idSchema.parse(req.params.itemId);
  const { weggelassen } = weglassenSchema.parse(req.body);
  await setAgendaItemWeggelassen(ctCookie(req), eventId, itemId, weggelassen);
  // Ohne `invalidateSongUsageCache`: Wie der Vorlauf verschiebt das Auge nur Uhrzeiten, nicht die Lieder.
  res.json({ ok: true });
}

const abgeschlossenSchema = z.object({ abgeschlossen: z.boolean() });

/**
 * PUT /api/services/:eventId/agenda/abgeschlossen – den Ablauf in ChurchTools abschließen (`true`) oder
 * wieder öffnen (`false`), wie der Knopf in ChurchTools (Alwin, 09.10.2026). Ändert keine Punkte.
 */
export async function putAblaufAbgeschlossen(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const { abgeschlossen } = abgeschlossenSchema.parse(req.body);
  await setAblaufAbgeschlossen(ctCookie(req), eventId, abgeschlossen);
  res.json({ ok: true });
}

/**
 * DELETE /api/services/:eventId/agenda/items/:itemId – einen Ablaufpunkt löschen. Die Antwort trägt
 * unter `wiederherstellen` alles, was „Rückgängig" braucht (`null`, wenn der Punkt schon weg war).
 */
export async function deleteAgendaItemCtrl(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  const itemId = idSchema.parse(req.params.itemId);
  const wiederherstellen = await deleteAgendaItem(ctCookie(req), eventId, itemId);
  invalidateSongUsageCache();
  res.json({ ok: true, wiederherstellen });
}

/** Der Merkzettel aus dem Löschen – so, wie er zurückkommt (Grenzen wie ChurchTools, OpenAPI). */
export const geloeschterPunktSchema = z.object({
  felder: z.object({
    type: z.enum(['header', 'text', 'song']),
    title: z.string().max(100),
    note: z.string().max(4000),
    duration: z.number().int().min(0),
    responsible: z.string().max(1000),
    serviceGroupNotes: z
      .array(
        z.object({
          serviceGroupId: z.number().int().positive(),
          note: z.string().min(1).max(4000),
        }),
      )
      .max(100),
    arrangementId: z.number().int().positive().optional(),
  }),
  nachId: z.number().int().positive().nullable(),
  vorBeginn: z.boolean(),
  // E6-3b (#652): ohne diese Zeile striche zod das Feld still weg – das Auge ginge beim Zurückholen verloren.
  weggelassen: z.boolean().optional(),
});

/** POST /api/services/:eventId/agenda/items/wiederherstellen – „Rückgängig" nach dem Löschen. */
export async function postAgendaItemWiederherstellen(req: Request, res: Response): Promise<void> {
  const eventId = idSchema.parse(req.params.eventId);
  await restoreAgendaItem(ctCookie(req), eventId, geloeschterPunktSchema.parse(req.body));
  invalidateSongUsageCache();
  res.json({ ok: true });
}

/** GET /api/capabilities – was der angemeldete Nutzer laut ChurchTools darf. */
export async function getCapabilitiesCtrl(req: Request, res: Response): Promise<void> {
  const caps = await getCapabilities(ctCookie(req), req.ctUserId ?? null);
  res.json(caps);
}

/** GET /api/agenda-services – ChurchTools-Dienste (für die Verantwortlich-Chips). */
export async function getAgendaServicesCtrl(req: Request, res: Response): Promise<void> {
  const services = await getCtServices(ctCookie(req));
  const result: AgendaServiceOption[] = services.map((s) => ({ id: s.id, name: s.name }));
  res.json(result);
}

/** GET /api/services/:eventId/setlist – alle Ablaufpunkte (Lieder inkl. ChordPro). */
export async function getSetlist(req: Request, res: Response): Promise<void> {
  const cookie = ctCookie(req);
  const eventId = idSchema.parse(req.params.eventId);
  // Zuletzt gesehenen Stand des Kontos laden → geänderte Punkte markieren (#161). Best effort:
  // ohne Konto-ID/Stand liefern wir ohne Markierungen (kein Fehlalarm bei Erstnutzung).
  let prevSigs: { id: number; sig: string }[] | undefined;
  try {
    const userId = req.ctUserId ?? (await getUserId(cookie));
    prevSigs = (await gesehenHolen(cookie, userId))[String(eventId)]?.items;
  } catch {
    /* Konto-ID/Datei nicht verfügbar → ohne Diff */
  }
  const items = await getAgendaItems(cookie, eventId, prevSigs);
  res.json(items);
}
