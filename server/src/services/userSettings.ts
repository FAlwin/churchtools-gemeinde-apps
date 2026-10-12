/**
 * **Altbestand** der Lied-/Versions-Einstellungen auf dem Daten-Volume (Tonart, Kapo, Spalten, Schrift,
 * Nur-Text, Abschnitte, gewählte Version, Anzeige-Quelle): eine JSON-Datei pro Konto, Schlüssel→Wert.
 * Seit v2.33.0 liegen die Einstellungen in ChurchTools; hier wird nur noch für den Umzug gelesen und
 * 90 Tage nach geprüftem Umzug gelöscht. `putSettings` samt Konto-Obergrenzen #195 ist am 12.10.2026
 * entfallen.
 */
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { config } from '../config.js';
import { readJsonStore } from './jsonStore.js';

type Store = Record<string, string>;

/**
 * Erlaubte Einstellungs-Schlüssel – begrenzt, was synchronisiert wird.
 *
 * Aufbau: `worship_<feld>_<liedId>` plus optional der Versions-Schlüssel (`versionSlug` liefert
 * `[a-z0-9-]+`) und ein alter Geräte-Zusatz (`_dlarge`/`_dphone`, nur noch lesend). Der
 * **End-Anker** kam mit #215 dazu: Vorher passierte `worship_key_1<Müll>` den Filter und landete
 * als Müll in der Konto-Datei. Ausbrechen konnte damit nichts (Pfade entstehen nur aus der
 * numerischen `userId`, Größe und Anzahl sind gedeckelt) – aber sauber war es nicht.
 *
 * Die beiden erlaubten Zusätze sind Absicht: Ein strenges `_\d+$` würde die versionsbezogenen
 * Schlüssel **stillschweigend verwerfen** – die Einstellungen wären dann geräteübergreifend weg.
 * Liegt in @shared/keys und wird von Client UND Server geteilt (#250) – hier nur re-exportiert.
 */
import { SETTINGS_KEY_RE, songIdOfSettingsKey } from '@shared/keys/index';
export { SETTINGS_KEY_RE };

function fileFor(userId: number): string {
  return path.join(config.annotationsPath, `settings-${userId}.json`);
}

const cache = new Map<number, Store>();
const locks = new Map<number, Promise<unknown>>();

async function read(userId: number): Promise<Store> {
  const cached = cache.get(userId);
  if (cached) return cached;
  // Nur „Datei gibt es noch nicht" ist leer; jeder andere Lesefehler wirft (#273) – sonst landete ein
  // leerer Stand als Wahrheit im Cache und der nächste Schreibvorgang überschrieb die Einstellungen.
  const data = (await readJsonStore<Store>(fileFor(userId), 'Lied-Einstellungen')) ?? {};
  cache.set(userId, data);
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

/** Die Lied-Einstellungen eines Kontos auf dem Daten-Volume löschen (90 Tage nach dem Umzug). */
export async function kontoLoeschen(userId: number): Promise<void> {
  await withLock(userId, async () => {
    await rm(fileFor(userId), { force: true });
    cache.delete(userId);
  });
}

/** Alle Einstellungen eines Kontos zu den genannten Liedern (leere songIds = alle). */
export async function getSettings(userId: number, songIds: number[]): Promise<Store> {
  const store = await read(userId);
  if (songIds.length === 0) return store;
  const set = new Set(songIds);
  const out: Store = {};
  for (const [key, value] of Object.entries(store)) {
    const id = songIdOfSettingsKey(key);
    if (id !== null && set.has(id)) out[key] = value;
  }
  return out;
}
