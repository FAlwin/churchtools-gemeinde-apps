/**
 * Das HTTP-Fundament für alle ChurchTools-Aufrufe (#280).
 *
 * Hier liegen Zeitgrenzen, Größenbegrenzung und die **Abbildung fremder Fehler auf unsere**. Das ist
 * kein Beiwerk: Erst weil die Abbildung an EINER Stelle steht, konnte #300 die Drosselung (429) von
 * einem echten Ausfall unterscheiden – vorher war beides ein 502 und damit nicht behandelbar.
 *
 * **Zwei Regeln, die hier verankert sind:**
 *  - *Vorübergehend ist nicht ungültig* – Zeitüberschreitung wird 504, Drosselung 503, beides mit
 *    einem eigenen Fehlertyp, damit Aufrufer sie erkennen statt zu raten.
 *  - Ein 429 wird **nicht** als 429 weitergereicht: Der Client deutet das als „zu viele
 *    Anmeldeversuche". Begründung an `CtOverloadedError`.
 */
import { config } from '../config.js';
import {
  CT_ANTWORTET_NICHT,
  HttpError,
  istZeitueberschreitung,
} from '../middleware/errorHandler.js';

export const BASE = config.churchtoolsBaseUrl.replace(/\/$/, '');

/**
 * Zeitgrenzen für ChurchTools-Aufrufe (#248).
 *
 * Ohne Grenze wartet eine Anfrage unbegrenzt, wenn ChurchTools hängt – der Node-Prozess sammelt dann
 * offene Requests, bis nichts mehr geht. Die App pollt im Sekundentakt, das potenziert sich.
 * Dateien dürfen länger dauern als API-Aufrufe (große PDFs über eine schmale Leitung).
 */
const CT_TIMEOUT_MS = 15_000;

export const CT_FILE_TIMEOUT_MS = 60_000;

/**
 * Obergrenze für Dateien (#248) – **die Zahl selbst liegt seit #321 in `@shared/dateien`.**
 *
 * Sie gilt in beide Richtungen: Der Datei-Proxy hält eine Datei **komplett im Speicher**, ein
 * versehentlich in ChurchTools hochgeladener Scan von mehreren hundert MB würde den Container umlegen
 * – und damit die App für ALLE gleichzeitig. 50 MB liegen weit über jedem realen Liedblatt.
 *
 * Warum im geteilten Verzeichnis: Der Client muss dieselbe Grenze kennen, um NICHT erst 50 MB durchs
 * Netz zu schicken und dann abgelehnt zu werden. Zwei Zahlen wären zwei Wahrheiten.
 *
 * Bewusst **nur für Dateien**, nicht für die JSON-Antworten der CT-API (`ctGet`): Dort bestimmt die
 * Datenmenge der Gemeinde die Größe – ein paar hundert Lieder oder Ablaufpunkte –, und es gibt keinen
 * Weg, sie von außen aufzublähen. Ein Limit dort wäre Aufwand ohne Schutzgewinn. Dateien dagegen sind
 * beliebige Uploads.
 */
export { MAX_FILE_BYTES } from '@shared/dateien/index';

/** Ein Abbruch-Signal mit Zeitgrenze – die Zahlen stehen nur oben. */
export function ctSignal(ms: number = CT_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * Antwort-Rumpf lesen, aber **höchstens** `maxBytes` (#248).
 *
 * Zuerst die angekündigte Größe prüfen (spart das Laden ganz), dann beim Lesen mitzählen – ein
 * `Content-Length` kann fehlen oder lügen, deshalb reicht die Ankündigung allein nicht.
 *
 * Exportiert, damit die Grenze mit einem kleinen `maxBytes` prüfbar ist – ein Test mit den echten
 * 50 MB würde nur Speicher und Zeit kosten, ohne mehr zu beweisen.
 */
export async function readLimited(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(502, 'Die Datei ist zu groß, um sie anzuzeigen.');
  }
  if (!res.body) return Buffer.alloc(0);
  // Ohne die Angabe ist `value` ein `any` und alles daran hängende ungeprüft (#279).
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel(); // Verbindung abbrechen, statt weiter Speicher zu füllen
      throw new HttpError(502, 'Die Datei ist zu groß, um sie anzuzeigen.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/**
 * Nicht-ok-Antwort eines Datei-Downloads in einen Fehler übersetzen (#274).
 *
 * **404 bleibt 404**: Die Datei ist in ChurchTools wirklich weg, „leer" ist dann die Wahrheit. Alles
 * andere (502/503, Serverfehler) ist vorübergehend und darf vom Aufrufer NICHT als leere Datei
 * durchgehen. Dieselbe Unterscheidung, die `ctGet` seit #152/#199 macht.
 *
 * Steht als Helfer da, weil die Zeile vorher an ZWEI Stellen wortgleich stand (`downloadFileText`
 * und `fetchFileBytes`) – eine davon zu ändern wäre die nächste halb umgesetzte Regel gewesen.
 */
export function fileDownloadError(status: number): never {
  // Ein 429 kommt hier nicht mehr an: `ctFetch` macht daraus schon die Drosselung (#489).
  throw new HttpError(status === 404 ? 404 : 502, `Datei-Download fehlgeschlagen (${status}).`);
}

/**
 * Zeitüberschreitung bei ChurchTools – **504, mit eigenem Fehlertyp** (#248, #489).
 *
 * 504 statt 500: Der Fehler liegt beim Upstream, und der Client soll „gleich nochmal" von „echter
 * Fehler" unterscheiden können. Der eigene Typ ist für die Massenläufe da: `isCtOverloaded` erkennt
 * ihn, so wie die Drosselung. Vorher war es ein schlichter `HttpError(504)` aus dem Datei-Download –
 * den erkannte `isCtOverloaded` NICHT, und der Liedtext-Index lief nach einer Zeitüberschreitung
 * weiter in ChurchTools hinein (gefunden bei #489).
 */
export class CtTimeoutError extends HttpError {
  constructor() {
    super(504, CT_ANTWORTET_NICHT);
    this.name = 'CtTimeoutError';
  }
}

/**
 * ChurchTools drosselt uns (HTTP 429) – als eigene Fehlerklasse (#300).
 *
 * **Warum 503 und nicht 429 nach außen:** Ein 429 aus unserer API würde im Client als „zu viele
 * Anmeldeversuche" gedeutet (`utils/loginError.ts`) und damit die falsche Ursache behaupten. Ein 503
 * **mit** unserem `{error}`-Rumpf fällt dagegen in den vorhandenen „Server hat ein Problem"-Zweig,
 * kippt die App dank #296 NICHT in den Offline-Zustand und lässt die bestehenden Meldungen unverändert.
 * Null Verhaltensänderung im Client, voller Diagnosegewinn.
 */
export class CtOverloadedError extends HttpError {
  constructor(retryAfterMs?: number) {
    super(
      503,
      'ChurchTools bremst uns gerade aus (zu viele Anfragen). Bitte einen Moment warten.',
      retryAfterMs,
    );
    this.name = 'CtOverloadedError';
  }
}

// `Retry-After` lesen – Regel in `@shared/ct/bremse` (#335), hier weitergereicht.
import { parseRetryAfter } from '@shared/ct/bremse';
export { parseRetryAfter };

/**
 * „ChurchTools kann gerade nicht mehr" – Drosselung ODER Zeitüberschreitung (#300).
 *
 * Beides heißt für einen Massenlauf dasselbe: **sofort aufhören**, statt weitere hundert Anfragen in
 * eine Wand zu schicken. Die Zeitüberschreitung kommt in zwei Formen: als `CtTimeoutError`, wenn sie
 * beim Abschicken passiert (`ctFetch`), und roh, wenn erst das Lesen der Antwort zu lange dauert –
 * dasselbe Abbruch-Signal gilt auch für den Rumpf.
 */
export function isCtOverloaded(e: unknown): boolean {
  return e instanceof CtOverloadedError || e instanceof CtTimeoutError || istZeitueberschreitung(e);
}

/**
 * **Die eine Stelle, an der der Server ChurchTools anspricht** (#489).
 *
 * Vorher riefen neun Stellen `fetch` selbst auf, und jede baute die Regeln nach; die Kommentare
 * zählten die Kopien mit („die DRITTE Stelle", „die VIERTE"). Die Kopien waren nicht gleich: Eine
 * Zeitüberschreitung wurde nur beim Datei-Download zu 504, überall sonst lief sie bis zum
 * `errorHandler` durch und kam als 500 „Interner Serverfehler" heraus.
 *
 * Hier gilt für JEDEN Aufruf:
 *  - **Zeitgrenze** (`ctSignal`, auf Wunsch die längere für Dateien);
 *  - **Zeitüberschreitung → `CtTimeoutError` (504)** – vorübergehend ist nicht ungültig;
 *  - **429 → `CtOverloadedError` (503)** samt `Retry-After` (#300) und Log-Zeile.
 *
 * Was ein Status sonst bedeutet (401 = Sitzung weg oder falsches Passwort, 404 = schon gelöscht),
 * ist je Aufrufer verschieden und bleibt dort. `was` steht nur im Log – Pfade gehen nicht nach außen
 * (#199).
 */
export async function ctFetch(
  url: string,
  init: Omit<RequestInit, 'signal'> & { was: string; zeitgrenzeMs?: number },
): Promise<Response> {
  const { was, zeitgrenzeMs, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: ctSignal(zeitgrenzeMs) });
  } catch (e) {
    if (istZeitueberschreitung(e)) {
      console.warn(`[churchtools] Zeitüberschreitung bei ${was}`);
      throw new CtTimeoutError();
    }
    throw e;
  }
  // 429 = ChurchTools drosselt uns (#300). Eigene Fehlerklasse, damit Massenläufe (Lied-Statistik)
  // beim ERSTEN Vorkommen abbrechen können, statt weitere hundert Anfragen in ein erschöpftes Limit
  // zu schicken – genau das hat im Betrieb die ganze App lahmgelegt (Anmeldung, Rechte, Speichern
  // bekamen danach ebenfalls 429). Für den Nutzer heißt es „gleich nochmal", nicht „abgelehnt".
  if (res.status === 429) {
    const retryAfterMs = parseRetryAfter(res.headers.get('retry-after'));
    console.warn(
      `[churchtools] 429 (gedrosselt) bei ${was}` +
        (retryAfterMs === undefined ? '' : `, Retry-After ${Math.round(retryAfterMs / 1000)} s`),
    );
    throw new CtOverloadedError(retryAfterMs);
  }
  return res;
}

/** Führt eine authentifizierte JSON-Anfrage gegen die ChurchTools-API aus. */
export async function ctGet<T = unknown>(cookie: string, path: string): Promise<T> {
  const res = await ctFetch(`${BASE}${path}`, {
    was: path,
    headers: { Cookie: cookie, Accept: 'application/json' },
  });
  if (res.status === 401) {
    throw new HttpError(401, 'Session abgelaufen. Bitte neu anmelden.');
  }
  // 403 NICHT als 401 werten (#152): Ein transienter Proxy-/Rechte-403 (z. B. Alt-Cookie, kein
  // Cache) darf keinen 401 erzeugen – sonst löst der globale „Session abgelaufen"-Fänger (#186)
  // einen Zwangs-Logout samt Geräte-Wipe aus. Als 403 durchreichen (kein Re-Login).
  if (res.status === 403) {
    // Pfad NICHT nach außen geben (#199) – er verrät interne API-Struktur inkl. Personen-IDs.
    console.warn(`[churchtools] 403 bei ${path}`);
    throw new HttpError(403, 'Kein Zugriff auf diese ChurchTools-Daten.');
  }
  if (!res.ok) {
    // 404 durchreichen (z. B. „Termin hat keinen Ablaufplan") – Aufrufer wie die Statistik
    // unterscheiden das von echten Fehlern (500/Netz), die geloggt werden. Rest bleibt 502.
    // 404 NICHT loggen (#215): Der Fall ist erwartbar und würde im 8-Sekunden-Polling das
    // Container-Log fluten. Pfad ohnehin nur ins Log (#199), nach außen generisch.
    if (res.status !== 404) console.warn(`[churchtools] Fehler ${res.status} bei ${path}`);
    throw new HttpError(res.status === 404 ? 404 : 502, `ChurchTools-Fehler (${res.status}).`);
  }
  const json = (await res.json()) as { data?: T };
  return (json.data ?? json) as T;
}
