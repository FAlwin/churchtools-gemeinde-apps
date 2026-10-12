/**
 * **Altbestand** der „zuletzt gesehenen Setlist-Stände" je Konto und Termin (#143) auf dem Volume –
 * eine gemeinsame JSON-Datei. Seit v2.33.0 merkt die App „gesehen" in ChurchTools (`kontoAblage.ts`);
 * hier wird nur noch für den Umzug gelesen (`altbestand.ts`) und ein Konto nach dem Umzug vergessen.
 * `markSeenSetlist` ist am 12.10.2026 entfallen.
 */
import { config } from '../config.js';
import { readJsonStore, writeJsonStore } from './jsonStore.js';
import type { GesehenerStand } from '@shared/types/index';

type SeenEntry = GesehenerStand;
/** eventId → gesehener Stand. */
type EventMap = Record<string, SeenEntry>;
/** userId → EventMap. */
type Store = Record<string, EventMap>;

let store: Store | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Liest die Ablage über `jsonStore` (#404) – dieselbe Regel wie beim Rechte-Cache: Nur „Datei gibt es
 * nicht" heißt leer; ein anderer Lesefehler wirft, und dann wird nichts zwischengespeichert. Sonst
 * schriebe das nächste „gesehen" einen leeren Stand zurück, und die Änderungs-Punkte aller Konten
 * wären weg.
 */
async function load(): Promise<Store> {
  if (store) return store;
  store = (await readJsonStore<Store>(config.seenSetlistsPath, 'Gesehene Abläufe')) ?? {};
  return store;
}

/** Gesehene Stände eines Kontos (eventId → Eintrag). Leeres Objekt, wenn nichts gemerkt. */
export async function getSeenSetlists(userId: number): Promise<EventMap> {
  try {
    return (await load())[String(userId)] ?? {};
  } catch {
    return {}; // Ablage nicht lesbar → keine Änderungs-Punkte, aber auch kein Fehler in der Terminliste
  }
}

/** Die gemerkten Stände eines Kontos vergessen (90 Tage nach dem Umzug nach ChurchTools). */
export async function kontoVergessen(userId: number): Promise<void> {
  const s = await load();
  if (!(String(userId) in s)) return;
  delete s[String(userId)];
  const write = (): Promise<void> => writeJsonStore(config.seenSetlistsPath, JSON.stringify(s));
  writeChain = writeChain.then(write, write);
  await writeChain;
}

/** Nur für Tests: In-Memory-Zustand zurücksetzen, damit die Datei erneut gelesen wird. */
export function __resetForTests(): void {
  store = null;
  writeChain = Promise.resolve();
}
