/**
 * Die Verbindung einer ChurchTools-Erweiterung zu ChurchTools (#334, Plan
 * `docs/entwicklung/plan-extension.md`) – **für jede Erweiterung dieses Repos** (#474: aus
 * `client/src/services/ctRuntime.ts` hierher gezogen, damit die Anmeldungen sie nicht nachbauen).
 *
 * Eine Erweiterung läuft unter `/ccm/<Kürzel>/` ohne eigenen Server: Sie spricht ChurchTools direkt an,
 * mit der Sitzung der Seite (gemessen 07.10.2026: `/whoami` liefert ohne eigene Anmeldung die Person).
 * Was je App verschieden ist – wohin „erreichbar/nicht erreichbar" gemeldet wird und wie ein fehlendes
 * Recht klingt –, stellt die App einmal mit `verbindungEinrichten` ein.
 *
 * Hier sitzt außerdem die Übersetzung der ChurchTools-Fehler – sie ist der heikle Teil:
 * ChurchTools antwortet auf ein **fehlendes Recht** mit **401 „Die Session ist abgelaufen"**, obwohl
 * die Sitzung gültig ist (gemessen 07.10.2026). Die Service-Schicht behandelt 401 als „abgemeldet" und
 * schaltet den Abgleich ab. Ohne Unterscheidung wäre ein Musiker ohne Recht still abgehängt – oder,
 * schlimmer, ein echter Sitzungsverlust bliebe unbemerkt. Deshalb fragt `fehlerAus` bei 401 nach,
 * wer angemeldet ist (`id > 0`, #381).
 */
import { ajaxMeldungen, ajaxNutzlast, type AjaxMeldungen } from '@shared/ct/altSchnittstelle';
import { parseRetryAfter, STANDARD_SPERRE_MS } from '@shared/ct/bremse';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import { whoamiId } from '@shared/ct/whoami';
import { ctBasis } from './basis';
import { ApiError } from './fehler';

export { ctBasis };

/** Was eine App an der Verbindung einstellt (`verbindungEinrichten`). */
export interface VerbindungsEinstellungen {
  /**
   * Antwortet ChurchTools (`true`) – oder kam keine Antwort (`false`)? Die Musik-App zeigt daraus
   * „offline" an (`reachability.ts`). Ohne Einstellung wird es nirgends gemeldet.
   */
  erreichbar?: (ja: boolean) => void;
  /** Was bei fehlendem Recht gesagt wird, wenn der Aufruf selbst nichts mitgibt (`verweigert`). */
  keinRecht?: string;
}

let meldeErreichbar: (ja: boolean) => void = () => {};

const ALLGEMEIN_KEIN_RECHT =
  'ChurchTools erlaubt dir das nicht. Bitte frag die Verantwortlichen deiner Gemeinde nach dem passenden Recht.';

let keinRechtMeldung = ALLGEMEIN_KEIN_RECHT;

/**
 * Einmal beim Laden der App aufrufen. Was nicht angegeben ist, fällt auf den Standard zurück – ein
 * zweiter Aufruf setzt also alles neu, statt Reste des ersten zu behalten.
 */
export function verbindungEinrichten(e: VerbindungsEinstellungen): void {
  meldeErreichbar = e.erreichbar ?? (() => {});
  keinRechtMeldung = e.keinRecht ?? ALLGEMEIN_KEIN_RECHT;
}

/**
 * Ein Recht fehlt – **dauerhaft**, nicht vorübergehend. Der Abgleich hört dann auf und sagt es; die
 * Daten bleiben lokal. Erbt von `ApiError` mit Status 403, damit Aufrufer, die nur `ApiError` kennen,
 * ihn nicht als Netzfehler behandeln.
 */
export class KeinSpeicherRecht extends ApiError {
  constructor(message: string) {
    super(403, message);
    this.name = 'KeinSpeicherRecht';
  }
}

/** Die ChurchTools-Fehlerantwort lesbar machen (`translatedMessage` vor `message`). */
function meldungAus(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as { translatedMessage?: unknown; message?: unknown };
    if (typeof b.translatedMessage === 'string' && b.translatedMessage) return b.translatedMessage;
    if (typeof b.message === 'string' && b.message) return b.message;
  }
  return `ChurchTools-Fehler ${status}`;
}

/**
 * Ist das ein „verboten" von ChurchTools selbst – oder ein 403 von irgendetwas dazwischen?
 *
 * Nur die JSON-Antwort von ChurchTools trägt `messageKey`/`message` (gemessen: `error.forbidden.view`,
 * „Forbidden to edit person files", „Keine ausreichende Berechtigung"). Ein 403 ohne diesen Rumpf
 * (Proxy, Firewall) kann vorübergehend sein und darf den Abgleich NICHT dauerhaft abschalten.
 */
function istCtVerbot(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as { messageKey?: unknown; message?: unknown };
  const key = typeof b.messageKey === 'string' ? b.messageKey : '';
  const msg = typeof b.message === 'string' ? b.message : '';
  return key.startsWith('error.forbidden') || /forbidden|berechtigung/i.test(msg);
}

/** Wer ist angemeldet? `null` = unklar (Netz, Fehler), `0` = niemand, sonst die Person. */
async function angemeldetePerson(): Promise<number | null> {
  try {
    const res = await fetch(`${ctBasis()}/api/whoami`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: unknown };
    // Ohne gültige Sitzung antwortet ChurchTools mit 200 und id -1 (#381) – das ist „niemand" (0).
    return whoamiId(body.data);
  } catch {
    return null;
  }
}

/**
 * Eine Fehlerantwort von ChurchTools übersetzen – die Zweige einzeln:
 * - 401 + jemand angemeldet → **fehlendes Recht** (`KeinSpeicherRecht`)
 * - 401 + niemand angemeldet → wirklich abgemeldet (`ApiError` 401)
 * - 401 + unklar → vorübergehend (`ApiError` 503): nicht abmelden, nichts verwerfen
 * - 403 von ChurchTools → fehlendes Recht; 403 ohne ChurchTools-Rumpf → vorübergehend
 * - alles andere → `ApiError` mit dem Status
 */
export async function fehlerAus(
  res: Response,
  body: unknown,
  /** Was bei fehlendem Recht gesagt wird – Standard: was die App eingestellt hat (`verbindungEinrichten`). */
  keinRecht: string = keinRechtMeldung,
): Promise<ApiError> {
  if (res.status === 401) {
    const person = await angemeldetePerson();
    if (person === null) return new ApiError(503, 'ChurchTools antwortet gerade nicht eindeutig.');
    if (person === 0) return new ApiError(401, 'Bei ChurchTools nicht mehr angemeldet.');
    return new KeinSpeicherRecht(keinRecht);
  }
  if (res.status === 403 && istCtVerbot(body)) return new KeinSpeicherRecht(keinRecht);
  return new ApiError(res.status, meldungAus(body, res.status), body);
}

// ── Die Bremse (#300, #335) ──────────────────────────────────────────────────
/**
 * ChurchTools bremst gerade (429) – **gerätweit**, für jede Anfrage.
 *
 * Im Server bündelt ein Prozess alle Geräte; hier spricht jedes Gerät ChurchTools selbst an. #300 hat
 * gezeigt, was dann passiert: Nach dem ersten 429 rannten weitere Anfragen in die Wand, verlängerten
 * die Drosselung, und Anmeldung, Rechte und Speichern scheiterten gleichzeitig. Deshalb geht nach
 * einem 429 **gar keine** Anfrage mehr raus, bis die Sperrfrist um ist – `Retry-After`, sonst
 * `STANDARD_SPERRE_MS`.
 */
export class ChurchToolsBremst extends ApiError {
  constructor(public restMs: number) {
    super(
      503,
      `ChurchTools bremst gerade (zu viele Anfragen). Bitte in ${Math.ceil(restMs / 1000)} s erneut versuchen.`,
    );
    this.name = 'ChurchToolsBremst';
  }
}

let gesperrtBis = 0;

function pruefeBremse(): void {
  const rest = gesperrtBis - Date.now();
  if (rest > 0) throw new ChurchToolsBremst(rest);
}

function bremsen(res: Response): ChurchToolsBremst {
  const ms = parseRetryAfter(res.headers.get('retry-after')) ?? STANDARD_SPERRE_MS;
  gesperrtBis = Date.now() + ms;
  return new ChurchToolsBremst(ms);
}

/** Heißt der Fehler „ChurchTools kann gerade nicht mehr" – Drosselung oder Zeitüberschreitung? */
export function istUeberlastet(e: unknown): boolean {
  return e instanceof ChurchToolsBremst || (e instanceof ApiError && e.status === 504);
}

/** Nur für Tests: Bremse lösen. */
export function _bremseLoesen(): void {
  gesperrtBis = 0;
}

/** Zeitgrenzen wie im Server (#248): Ohne Grenze hängt eine Anfrage, wenn ChurchTools hängt. */
const ZEIT_API_MS = 15_000;
const ZEIT_DATEI_MS = 60_000;

/** fetch mit Zeitgrenze; eine Zeitüberschreitung wird zu 504, ein Netzfehler meldet „nicht erreichbar". */
async function mitZeitgrenze(url: string, init: RequestInit, ms: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new ApiError(504, 'ChurchTools antwortet nicht (Zeitüberschreitung).');
    }
    meldeErreichbar(false);
    throw e;
  }
}

/**
 * Das CSRF-Token der Sitzung – einmal geholt, danach gemerkt. Gemessen 07.10.2026 ging Schreiben auch
 * ohne; der offizielle ChurchTools-Client schickt es trotzdem mit, und das ist die sichere Seite.
 * Scheitert das Holen, wird ohne geschrieben – und `null` NICHT gemerkt, der nächste Schreibvorgang
 * fragt neu (`behalten`).
 */
const csrfToken = merkeVersprechen<string | null>({ behalten: (t) => t !== null });

function holeCsrf(): Promise<string | null> {
  return csrfToken.hole('csrf', async () => {
    try {
      const res = await fetch(`${ctBasis()}/api/csrftoken`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: unknown };
      return typeof body.data === 'string' ? body.data : null;
    } catch {
      return null;
    }
  });
}

/** Nur für Tests: gemerktes CSRF-Token vergessen. */
export function _vergissCsrf(): void {
  csrfToken.vergiss();
}

/**
 * Eine Anfrage an die ChurchTools-API (`/api…`) mit der Sitzung der Seite.
 *
 * Wirft bei Netzfehlern (und meldet „nicht erreichbar"), bei HTTP-Fehlern die Übersetzung aus
 * `fehlerAus`. Liefert den JSON-Rumpf (`null` bei leerer Antwort, z. B. 204).
 */
export async function ctAnfrage<T = unknown>(
  pfad: string,
  init: {
    method?: string;
    body?: FormData | string;
    /** Meldung bei fehlendem Recht (siehe `fehlerAus`) – Ablauf und Tempo sagen es anders (#335). */
    verweigert?: string;
  } = {},
): Promise<T> {
  pruefeBremse();
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const csrf = await holeCsrf();
    if (csrf) headers['CSRF-Token'] = csrf;
  }
  const res = await mitZeitgrenze(
    `${ctBasis()}/api${pfad}`,
    { method, credentials: 'include', headers, body: init.body },
    // Datei-Uploads dürfen länger dauern als ein API-Aufruf – wie im Server (`CT_FILE_TIMEOUT_MS`).
    init.body instanceof FormData ? ZEIT_DATEI_MS : ZEIT_API_MS,
  );
  return (await rumpfAus(res, method !== 'GET', init.verweigert)) as T;
}

/** Rumpf lesen und Fehler übersetzen – EINE Stelle für `ctAnfrage` und `ctAltAufruf`. */
async function rumpfAus(res: Response, schreibend: boolean, verweigert?: string): Promise<unknown> {
  meldeErreichbar(![502, 503, 504].includes(res.status));
  if (res.status === 429) throw bremsen(res);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    if (schreibend) csrfVerwerfenBeiAblehnung(res.status);
    throw await fehlerAus(res, body, verweigert);
  }
  return body;
}

/**
 * **Die alte Schnittstelle von ChurchTools** (`/?q=<modul>/ajax`, `{func, …}`) – nur, wo es keine REST-Schnittstelle
 * gibt. Nicht dokumentiert; die Weboberfläche von ChurchTools nutzt sie selbst (A7-5: Mails über `churchhome`
 * `sendEMailToPersonIds`, gemessen 22.10.2026). Antwort `{status, data, message}` – alles außer `success` wirft.
 */
export async function ctAltAufruf<T = unknown>(
  modul: string,
  func: string,
  daten: Record<string, unknown>,
): Promise<T> {
  pruefeBremse();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const csrf = await holeCsrf();
  if (csrf) headers['CSRF-Token'] = csrf;
  const res = await mitZeitgrenze(
    `${ctBasis()}/?q=${modul}/ajax`,
    { method: 'POST', credentials: 'include', headers, body: JSON.stringify({ ...daten, func }) },
    ZEIT_API_MS,
  );
  const body = (await rumpfAus(res, true)) as {
    status?: unknown;
    data?: unknown;
    message?: unknown;
  } | null;
  if (body?.status === 'success') return body.data as T;
  const meldung = typeof body?.message === 'string' ? body.message.trim() : '';
  if (/session expired/i.test(meldung))
    throw new ApiError(401, 'Bei ChurchTools nicht mehr angemeldet.');
  throw new ApiError(
    422,
    meldung
      ? `ChurchTools hat abgelehnt: ${meldung}`
      : 'ChurchTools hat den Auftrag nicht angenommen.',
  );
}

/**
 * Wie `ctAnfrage`, aber ausgepackt: ChurchTools packt fast alles in `{ data: … }` – wie `ctGet` im
 * Server: `data`, sonst den Rumpf. Stand vorher wortgleich in `ctLesen` und `ctModulDaten` (#463).
 */
export async function ctDaten<T>(pfad: string): Promise<T> {
  const body = await ctAnfrage<{ data?: T } | null>(pfad);
  return (body?.data ?? body) as T;
}

/**
 * **Alle Seiten einer ChurchTools-Liste** (#480). Viele Listen liefern nur eine Seite – `members` und
 * `groups` standardmäßig **10** Einträge (gemessen 12.10.2026); wer nur die erste liest, zählt ab dem
 * elften falsch. Geblättert wird nach `meta.pagination.lastPage` (leer: `0`), fehlt die Angabe, bis eine
 * Seite kürzer als `limit` ist.
 *
 * `limit` höchstens 200 (500 → 400, gemessen an `members`). **Mehr als `maxSeiten` Seiten → Fehler**
 * statt still abgeschnitten: Eine halbe Liste sähe aus wie eine ganze.
 */
export async function ctAlleSeiten<T>(pfad: string, limit = 100, maxSeiten = 50): Promise<T[]> {
  const alle: T[] = [];
  const trenner = pfad.includes('?') ? '&' : '?';
  for (let seite = 1; seite <= maxSeiten; seite++) {
    const body = await ctAnfrage<{
      data?: T[];
      meta?: { pagination?: { lastPage?: number } };
    } | null>(`${pfad}${trenner}limit=${limit}&page=${seite}`);
    const teil = Array.isArray(body?.data) ? body.data : [];
    alle.push(...teil);
    const letzte = body?.meta?.pagination?.lastPage;
    if (typeof letzte === 'number' ? seite >= letzte : teil.length < limit) return alle;
  }
  throw new ApiError(502, `Die Liste ${pfad} hat mehr als ${maxSeiten * limit} Einträge.`);
}

/**
 * **Ein abgelehntes Token wird verworfen** – die Lehre aus #298, die im Server seit August gilt
 * (`csrfWriteDenied`) und hier beim Bau der Extension fehlte (gefunden 07.10.2026, Phase 3b-2): Läuft die
 * Sitzung in ChurchTools neu an, ist das gemerkte Token ungültig. Ohne Verwerfen scheiterte danach JEDER
 * Schreibversuch, bis jemand die Seite neu lädt.
 */
function csrfVerwerfenBeiAblehnung(status: number): void {
  if (status === 401 || status === 403) csrfToken.vergiss();
}

/**
 * Eine Anfrage an die **alte** ChurchTools-Schnittstelle (`index.php?q=churchservice/ajax`, 3b-2) –
 * für Lied-Kategorien und Liederbücher (`getMasterData`). Wie im Server mit CSRF-Token und
 * `X-Requested-With` (ohne Token → 401, gemessen 07.10.2026). Ausgewertet wird über
 * `@shared/ct/altSchnittstelle`, dieselbe Regel wie im Server.
 */
export async function ctAltAnfrage(
  func: string,
  felder: Record<string, string> = {},
  meldungen: AjaxMeldungen = {},
): Promise<unknown> {
  pruefeBremse();
  const m = ajaxMeldungen(meldungen);
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    // Ohne diesen Kopf antwortet die alte Schnittstelle mit einer HTML-Seite statt JSON.
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json',
  };
  const csrf = await holeCsrf();
  if (csrf) headers['CSRF-Token'] = csrf;
  const res = await mitZeitgrenze(
    `${ctBasis()}/index.php?q=churchservice/ajax`,
    {
      method: 'POST',
      credentials: 'include',
      headers,
      body: new URLSearchParams({ func, ...felder }),
    },
    ZEIT_DATEI_MS,
  );
  meldeErreichbar(![502, 503, 504].includes(res.status));
  if (res.status === 429) throw bremsen(res);
  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    csrfVerwerfenBeiAblehnung(res.status);
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* kein JSON */
    }
    throw await fehlerAus(res, body, m.verweigert);
  }
  if (!res.ok) throw new ApiError(502, `${m.abgelehnt} (${res.status}).`);
  return ajaxNutzlast(text, m, (status, meldung) => new ApiError(status, meldung));
}

/**
 * Eine Datei über ihre `fileUrl` laden – geht nur mit dem Sitzungs-Cookie (gemessen 07.10.2026; ein
 * Login-Token-Header endet in einer Weiterleitungsschleife). Fehler wie bei `ctAnfrage`.
 */
export async function ctDatei(fileUrl: string): Promise<Blob> {
  // Nur Dateien der eigenen Instanz – die Adressen kommen aus ChurchTools-DATEN (Arrangements können
  // freie Links enthalten); die Sitzung soll nicht an einen fremden Host gehen (wie `assertCtFileUrl`).
  if (!fileUrl.startsWith(`${ctBasis()}/`)) {
    throw new ApiError(
      502,
      'Datei-Download abgelehnt: Adresse gehört nicht zur ChurchTools-Instanz.',
    );
  }
  pruefeBremse();
  const res = await mitZeitgrenze(fileUrl, { credentials: 'include' }, ZEIT_DATEI_MS);
  meldeErreichbar(![502, 503, 504].includes(res.status));
  if (res.status === 429) throw bremsen(res);
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* kein JSON */
    }
    throw await fehlerAus(res, body);
  }
  return res.blob();
}
