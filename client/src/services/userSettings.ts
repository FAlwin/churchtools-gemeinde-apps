/**
 * Server-Synchronisierung der Lied-/Versions-Einstellungen PRO KONTO (Tonart, Kapo, Spalten,
 * Schrift, Nur-Text, Abschnitte, gewählte Version, Anzeige-Quelle). localStorage bleibt der
 * schnelle Arbeitsspeicher; dieser Layer spiegelt vom/zum Server.
 */
import { apiFetch } from './api';
import { istExtension } from './ctRuntime';
import { holeEinstellungen, schreibeEinstellungen } from './personenAblage';
import { KONTO_ID, SETTINGS_KEY_RE, songIdOfSettingsKey } from '@shared/keys/index';
import { verwaisteEntfernen } from './verwaisteEintraege';
import { createPendingKeys } from './pendingKeys';
import { onAppHidden } from './appHidden';
import { erstelleSchreibSchlange } from './schreibSchlange';
import { lokalSchreiben } from '../utils/lokalSpeicher';

// Grammatik aus @shared/keys (#250) – Client und Server teilen sie jetzt wirklich.
const MIGRATED_FLAG = 'worship_settings_migrated_v1';

/**
 * Ausstehende Uploads überleben das Schließen der App (#275).
 *
 * Der Zwilling `annotations.ts` hatte das seit #256, hier fehlte es: Änderte jemand ohne Netz die
 * Tonart und wurde die App danach beendet (iOS macht das im Hintergrund von selbst), war beim
 * nächsten Start unbekannt, dass etwas fehlt – `pullSettings` spiegelte den älteren Server-Stand
 * zurück und die Änderung war **still weg**. Der Mechanismus liegt in `pendingKeys.ts`, damit es
 * nicht die dritte handgebaute Fassung wird.
 */
const pendingStore = createPendingKeys('worship_settings_pending_v1');

/**
 * Der Transportweg – die Weiche zwischen Server-Variante und Extension (#334), wie in
 * `annotations.ts`: Nur Holen und Schreiben unterscheiden sich, alle Härtungen hier gelten für beide.
 */
const weg = istExtension
  ? {
      holen: holeEinstellungen,
      schreiben: (eintraege: Record<string, string | null>): Promise<unknown> =>
        schreibeEinstellungen(eintraege),
    }
  : {
      holen: (songIds: number[]) =>
        apiFetch<Record<string, string>>(`/api/settings?songs=${songIds.join(',')}`),
      schreiben: (eintraege: Record<string, string | null>, keepalive = false): Promise<unknown> =>
        apiFetch('/api/settings', {
          method: 'PUT',
          body: JSON.stringify(eintraege),
          // keepalive: Request überlebt das Backgrounding der Seite (App-Wechsel/Schließen) – #275.
          ...(keepalive ? { keepalive: true } : {}),
        }),
    };

/**
 * Warteschlange, Wiederholen, Merker und Fehlerzweige liegen in `schreibSchlange.ts` – EIN Baustein mit
 * `annotations.ts` (#846). Die Einstellungen gehen gebündelt in einem Upload; neuere Werte gewinnen ganz.
 */
const schlange = erstelleSchreibSchlange<string | null>({
  merker: pendingStore,
  schreiben: (stapel, keepalive) => weg.schreiben(Object.fromEntries(stapel), keepalive),
  buendeln: 'alle',
  melden: (meldung) => syncErrorHandler?.(meldung),
});

/** Sync nach erfolgreicher Anmeldung wieder einschalten – siehe `annotations.resetSync` (#211). */
export function resetSync(): void {
  schlange.einschalten();
}

/** Server → localStorage: vorhandene Einstellungen dieser Lieder spiegeln (setzt nur vorhandene Werte). */
export async function pullSettings(liedIds: number[]): Promise<void> {
  if (schlange.istAus() || liedIds.length === 0) return;
  // Die Konto-Einstellungen („Lieder öffnen mit“) stehen unter der Pseudo-ID 0 und kommen immer mit – auch beim
  // Aufräumen unten, sonst bliebe eine auf einem anderen Gerät zurückgesetzte Wahl hier ewig stehen.
  const songIds = liedIds.includes(KONTO_ID) ? liedIds : [...liedIds, KONTO_ID];
  try {
    const data = await weg.holen(songIds);
    // Nicht überschreiben, was noch wartet, gerade hochlädt oder laut Merker nach einem Neustart noch fehlt (#275).
    const geschuetzt = schlange.schutz();
    for (const [k, v] of Object.entries(data)) {
      if (geschuetzt(k)) continue;
      if (SETTINGS_KEY_RE.test(k)) lokalSchreiben(k, v); // wirft nie (#457)
    }
    // Anderswo zurückgesetzte Einstellungen auch hier entfernen – Regel und Schutz dort.
    verwaisteEntfernen({
      kontoSchluessel: (ls) => (SETTINGS_KEY_RE.test(ls) ? ls : null),
      liedVon: songIdOfSettingsKey,
      songIds,
      aufDemKonto: (k) => k in data,
      geschuetzt,
      freigegeben: localStorage.getItem(MIGRATED_FLAG) !== null,
    });
  } catch (e) {
    schlange.fehlerBewerten(e);
  }
}

/**
 * Meldet dem Nutzer, dass Einstellungen NICHT gespeichert werden konnten (#213). Registriert wird
 * der Handler in `App.tsx` (Toast) – vorher verschwand eine abgelehnte Einstellung spurlos.
 */
let syncErrorHandler: ((msg: string) => void) | null = null;
export function setSettingsSyncErrorHandler(fn: ((msg: string) => void) | null): void {
  syncErrorHandler = fn;
}

/**
 * Alle noch ausstehenden Einstellungen SOFORT abschicken – beim Verlassen/Backgrounding der App (#275).
 *
 * Ohne das friert iOS den 600-ms-Debounce-Timer ein: Wer die Tonart ändert und die App gleich
 * weg-wischt, verliert die Änderung, weil der Timer nie wieder feuert. Die Anmerkungen haben diese
 * Behandlung seit #193/#256 – den Einstellungen fehlte sie.
 */
export function flushPendingSettings(): void {
  schlange.jetztAbschicken();
}

onAppHidden(flushPendingSettings);

/**
 * Beim Start: Uploads nachholen, die beim letzten Mal nicht durchgingen (#275).
 *
 * MUSS vor dem ersten `pullSettings` laufen – sonst überschreibt der Pull genau die Einstellungen,
 * die hier noch hochzuladen sind. Der Wert kommt aus dem localStorage; fehlt er dort, war es ein
 * **Entfernen** (`null`) und genau das wird nachgeholt.
 */
export async function resumePendingSettings(): Promise<void> {
  if (schlange.istAus()) return;
  const keys = pendingStore.read();
  if (keys.size === 0) return;
  for (const key of keys) {
    if (!SETTINGS_KEY_RE.test(key)) {
      pendingStore.unmark(key); // Altlast/Unsinn – nicht endlos mitschleppen
      continue;
    }
    schlange.einreihen(key, localStorage.getItem(key));
  }
  await schlange.abschicken();
}

/** Eine geänderte Einstellung zum Server schreiben (debounced, gebündelt). null/'' = entfernen. */
export function pushSetting(key: string, value: string | null): void {
  if (!SETTINGS_KEY_RE.test(key)) return;
  schlange.vormerken(key, () => value);
}

/** Einmalig: bestehende lokale Einstellungen aufs Konto hochladen (danach Merker gesetzt). */
export async function migrateLocalSettings(): Promise<void> {
  if (schlange.istAus() || localStorage.getItem(MIGRATED_FLAG)) return;
  const body: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && SETTINGS_KEY_RE.test(k)) {
      const v = localStorage.getItem(k);
      if (v != null) body[k] = v;
    }
  }
  if (Object.keys(body).length === 0) {
    lokalSchreiben(MIGRATED_FLAG, '1');
    return;
  }
  try {
    await weg.schreiben(body);
    lokalSchreiben(MIGRATED_FLAG, '1');
  } catch (e) {
    schlange.fehlerBewerten(e);
    // Merker NICHT setzen → nächster Versuch beim nächsten Laden
  }
}
