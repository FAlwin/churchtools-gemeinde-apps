/**
 * **Umzug der alten Ablage nach ChurchTools** (Alwin, 09.10.2026: „einmal automatisch").
 *
 * Bis zu diesem Stand lagen Anmerkungen, Lied-Einstellungen, „gesehen" und Teilen der Server-App auf dem
 * Daten-Volume. Jetzt gilt ChurchTools (`ctPersonenAblage.ts`); was auf dem Volume liegt, zieht beim
 * ersten Zugriff eines Kontos um:
 *
 *  - **ChurchTools gewinnt** – je Seite, je Einstellung. Was dort schon steht (aus der Erweiterung),
 *    wird nicht überschrieben; das Volume füllt nur Lücken.
 *  - **Im Hintergrund, langsam, wieder aufnehmbar.** Bilder einzeln mit Pause (#300); scheitert etwas
 *    (Drosselung, Netz), wird es nach `NACH_FEHLER_MS` erneut versucht – was schon hochgeladen ist,
 *    fehlt dann nicht mehr. Bis der Umzug fertig ist, ergänzen Lesezugriffe die fehlenden Seiten aus dem
 *    Volume (`altFuerLesen`): Man sieht nie einen halben Stand.
 *  - **Fertig heißt geprüft:** Nach dem Hochladen wird ChurchTools frisch gelesen; erst wenn nichts mehr
 *    fehlt, steht der Umzug als fertig.
 *  - **Das Volume wird nicht sofort geleert**, sondern `NAS_AUFBEWAHRUNG_MS` (90 Tage, Alwin) nach dem
 *    geprüften Umzug (`aufraeumen`). Die Liste „Wer teilt" (`sharing.json`) bleibt: Sie ist weiter das
 *    Verzeichnis für Gemeinden ohne Erweiterung.
 *  - **Seiten, die jemand während des Umzugs ändert,** stehen in `ueberschrieben` – sonst holte das
 *    Volume eine gerade gelöschte Zeichnung zurück.
 *
 * Auf Staging aus (`config.ablageUmzug`): Dort sind die Notizen auf dem Volume Testreste.
 *
 * ⚠️ Prozesslokal – siehe „Ein Prozess, ein Zustand" in `docs/entwicklung/entscheidungen.md`.
 */
import { config } from '../config.js';
import * as annotations from './annotations.js';
import * as userSettings from './userSettings.js';
import { kontoVergessen } from './seenSetlists.js';
import { ablagePortFuer, ablageVon } from './ctPersonenAblage.js';
import { teilenSetzen } from './ctTeilenServer.js';
import { aendern, altFuerLesen, lesen, __resetAltbestandForTests } from './altbestand.js';

export { altFuerLesen, merkeUeberschrieben } from './altbestand.js';

/** So lange bleibt die alte Ablage eines Kontos nach dem geprüften Umzug liegen (Alwin: 3 Monate). */
export const NAS_AUFBEWAHRUNG_MS = 90 * 24 * 60 * 60 * 1000;
/** Pause zwischen zwei hochgeladenen Bildern – schont ChurchTools (#300). */
const PAUSE_MS = 300;
/** Nach einem gescheiterten Lauf so lange nicht erneut versuchen. */
const NACH_FEHLER_MS = 5 * 60_000;

const laufend = new Map<number, Promise<void>>();
const letzterFehler = new Map<number, number>();

/** Den Umzug dieses Kontos anstoßen – im Hintergrund, höchstens einer je Konto. */
export function umzugAnstossen(cookie: string, userId: number): void {
  if (!config.ablageUmzug || laufend.has(userId)) return;
  if (Date.now() - (letzterFehler.get(userId) ?? 0) < NACH_FEHLER_MS) return;
  const lauf = umziehen(cookie, userId)
    .catch((e: unknown) => {
      letzterFehler.set(userId, Date.now());
      console.warn(
        `[ablage] Umzug Konto ${userId} unterbrochen – nächster Versuch später:`,
        e instanceof Error ? e.message : e,
      );
    })
    .finally(() => laufend.delete(userId));
  laufend.set(userId, lauf);
}

async function umziehen(cookie: string, userId: number): Promise<void> {
  const alt = await altFuerLesen(userId);
  if (alt === null) {
    if (!(await lesen())[String(userId)]?.fertigAm) {
      await aendern(userId, (e) => (e.fertigAm = Date.now()));
    }
    return;
  }
  const port = ablagePortFuer(cookie, userId);
  const ablage = ablageVon(userId);
  const warte = () => new Promise<void>((r) => setTimeout(r, PAUSE_MS));
  const bericht = await ablage.uebernimmAltbestand(port, alt, warte);
  // Wer auf dem Volume geteilt hat, gehört auch ins Verzeichnis der Erweiterung – best effort, die
  // Liste auf dem Volume findet ihn ohnehin.
  if (alt.teilen?.an) {
    try {
      await teilenSetzen(cookie, userId, true);
    } catch (e) {
      console.warn(`[ablage] Konto ${userId}: Verzeichnis der Team-Notizen nicht ergänzt:`, e);
    }
  }
  const rest = await ablage.pruefeAltbestand(port, alt);
  if (rest.bilder + rest.felder > 0) {
    throw new Error(`nach dem Hochladen fehlen noch ${rest.bilder} Bilder, ${rest.felder} Felder`);
  }
  await aendern(userId, (e) => (e.fertigAm = Date.now()));
  console.warn(
    `[ablage] Umzug Konto ${userId} fertig und geprüft: ${bericht.bilder} Bilder, ${bericht.felder} Felder übernommen`,
  );
}

/**
 * Die alte Ablage der Konten löschen, deren geprüfter Umzug `NAS_AUFBEWAHRUNG_MS` zurückliegt. Läuft
 * beim Start und täglich. Ein Fehler bei einem Konto hält die anderen nicht auf.
 */
export async function aufraeumen(jetzt = Date.now()): Promise<void> {
  const s = await lesen();
  for (const [uid, e] of Object.entries(s)) {
    if (!e.fertigAm || e.geloeschtAm || jetzt - e.fertigAm <= NAS_AUFBEWAHRUNG_MS) continue;
    const userId = Number(uid);
    try {
      await annotations.kontoLoeschen(userId);
      await userSettings.kontoLoeschen(userId);
      await kontoVergessen(userId);
      await aendern(userId, (x) => {
        x.geloeschtAm = jetzt;
        delete x.ueberschrieben;
      });
      console.warn(`[ablage] Alte Ablage von Konto ${userId} gelöscht (Umzug vor 90 Tagen).`);
    } catch (err) {
      console.warn(`[ablage] Alte Ablage von Konto ${userId} nicht gelöscht:`, err);
    }
  }
}

/** Nur für Tests: auf den laufenden Umzug warten. */
export function __laufenderUmzug(userId: number): Promise<void> | undefined {
  return laufend.get(userId);
}

/** Nur für Tests. */
export function __resetUmzugForTests(): void {
  __resetAltbestandForTests();
  laufend.clear();
  letzterFehler.clear();
}
