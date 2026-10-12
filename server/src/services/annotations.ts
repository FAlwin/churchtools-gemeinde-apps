/**
 * **Altbestand** der Anmerkungen auf dem Daten-Volume (Striche + Textfelder + Zoom je
 * Lied-Version-Seite): eine JSON-Datei pro ChurchTools-Konto. Seit v2.33.0 liegen Anmerkungen in
 * ChurchTools (`kontoAblage.ts`); hier wird nur noch für den Umzug gelesen (`altbestand.ts`,
 * `ablageUmzug.ts`) und 90 Tage nach geprüftem Umzug gelöscht. Die Schreibfunktionen
 * (`putAnnotation`, `deleteAnnotation`) samt Konto-Obergrenzen #139 sind am 12.10.2026 entfallen.
 * Schlüssel je Eintrag: `song<id>_v<versionKey>_<seite>`.
 */
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { config } from '../config.js';
import { readJsonStore } from './jsonStore.js';
// Anmerkungs-Typen kommen aus @shared/types – EINZIGE Quelle für Client + Server. Re-Export,
// damit Bestandsimporte aus diesem Modul weiter funktionieren.
import { songIdOfAnnoKey } from '@shared/keys/index';
import type { AnnotationText, PageAnnotation } from '@shared/types/index';

export type { AnnotationText, PageAnnotation };

type Store = Record<string, PageAnnotation>;

const MAX_CACHED_ACCOUNTS = 300;

function fileFor(userId: number): string {
  return path.join(config.annotationsPath, `${userId}.json`);
}

const cache = new Map<number, Store>();
// Zugriffe je Konto serialisieren (Löschen nicht mitten in ein Lesen).
const locks = new Map<number, Promise<unknown>>();

/**
 * Legt/aktualisiert einen Cache-Eintrag als jüngsten und wirft bei Überlauf den ältesten hinaus
 * (LRU, #139). Map bewahrt die Einfüge-Reihenfolge → der erste Schlüssel ist der älteste. Die
 * Datei bleibt die Wahrheit; ein evictetes Konto wird beim nächsten Zugriff neu von Disk gelesen.
 */
function cacheSet(userId: number, store: Store): void {
  cache.delete(userId); // ans Ende (= jüngster) verschieben
  cache.set(userId, store);
  if (cache.size > MAX_CACHED_ACCOUNTS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

async function read(userId: number): Promise<Store> {
  const cached = cache.get(userId);
  if (cached) {
    cacheSet(userId, cached); // als jüngst genutzt markieren (LRU)
    return cached;
  }
  // Nur „Datei gibt es noch nicht" ist leer; jeder andere Lesefehler wirft (#273) – sonst landete
  // ein leerer Stand als Wahrheit im Cache und der nächste Schreibvorgang überschrieb das Konto.
  const data = (await readJsonStore<Store>(fileFor(userId), 'Anmerkungen')) ?? {};
  cacheSet(userId, data);
  return data;
}

async function withLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(userId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(
    userId,
    run.catch(() => {}),
  );
  return run;
}

/**
 * Die Ablage eines Kontos auf dem Daten-Volume löschen – erst 90 Tage nach einem vollständig geprüften
 * Umzug nach ChurchTools (`ablageUmzug.ts`, Alwin 09.10.2026). „Gibt es nicht" ist erledigt.
 */
export async function kontoLoeschen(userId: number): Promise<void> {
  await withLock(userId, async () => {
    await rm(fileFor(userId), { force: true });
    cache.delete(userId);
  });
}

/** Alle Einträge eines Kontos zu den genannten Liedern (leere songIds = alle). */
export async function getAnnotations(userId: number, songIds: number[]): Promise<Store> {
  const store = await read(userId);
  if (songIds.length === 0) return store;
  const set = new Set(songIds);
  const out: Store = {};
  for (const [key, value] of Object.entries(store)) {
    const id = songIdOfAnnoKey(key);
    if (id !== null && set.has(id)) out[key] = value;
  }
  return out;
}
