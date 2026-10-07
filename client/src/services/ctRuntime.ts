/**
 * Die Laufzeit der ChurchTools-Extension (#334, Plan `docs/entwicklung/plan-extension.md`).
 *
 * Modus und Adresse stehen in `modus.ts` (ohne Abhängigkeiten – sonst entstünde ein Import-Kreis über
 * `api` → `reachability`); hier werden sie weitergereicht. Läuft die App als Extension unter
 * `/ccm/<Kürzel>/`, gibt es keinen eigenen Server: Die Service-Schicht spricht ChurchTools direkt an,
 * mit der Sitzung der Seite (gemessen 07.10.2026: `/whoami` liefert ohne eigene Anmeldung die Person).
 *
 * Hier sitzt außerdem die Übersetzung der ChurchTools-Fehler – sie ist der heikle Teil:
 * ChurchTools antwortet auf ein **fehlendes Recht** mit **401 „Die Session ist abgelaufen"**, obwohl
 * die Sitzung gültig ist (gemessen 07.10.2026). Die Service-Schicht behandelt 401 als „abgemeldet" und
 * schaltet den Abgleich ab. Ohne Unterscheidung wäre ein Musiker ohne Recht still abgehängt – oder,
 * schlimmer, ein echter Sitzungsverlust bliebe unbemerkt. Deshalb fragt `fehlerAus` bei 401 nach,
 * wer angemeldet ist (`id > 0`, #381).
 */
import { ApiError } from './api';
import { markReachable } from './reachability';
import { ajaxMeldungen, ajaxNutzlast, type AjaxMeldungen } from '@shared/ct/altSchnittstelle';
import { parseRetryAfter, STANDARD_SPERRE_MS } from '@shared/ct/bremse';
import { ctBasis, istExtension } from './modus';

export { ctBasis, istExtension };

/**
 * Was es in der Extension (noch) nicht gibt – ehrlich gesagt statt still gescheitert (#335).
 * `was` ist ein Satzanfang („Die Liedverwaltung").
 */
export function ohneServer<T>(was: string): Promise<T> {
  return Promise.reject(
    new ApiError(501, `${was} gibt es in der ChurchTools-Erweiterung noch nicht.`),
  );
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

const KEIN_RECHT_MELDUNG =
  'ChurchTools erlaubt dir nicht, hier zu speichern. Deine Änderungen bleiben auf diesem Gerät. ' +
  'Bitte frag die Verantwortlichen deiner Gemeinde nach dem Recht „Eigene Personendaten bearbeiten".';

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
    const body = (await res.json()) as { data?: { id?: unknown } };
    const id = body.data?.id;
    // Ohne gültige Sitzung antwortet ChurchTools mit 200 und id -1 (#381) – das ist „niemand".
    return typeof id === 'number' ? Math.max(id, 0) : null;
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
  /** Was bei fehlendem Recht gesagt wird – Standard: das Speichern an der eigenen Person. */
  keinRecht: string = KEIN_RECHT_MELDUNG,
): Promise<ApiError> {
  if (res.status === 401) {
    const person = await angemeldetePerson();
    if (person === null) return new ApiError(503, 'ChurchTools antwortet gerade nicht eindeutig.');
    if (person === 0) return new ApiError(401, 'Bei ChurchTools nicht mehr angemeldet.');
    return new KeinSpeicherRecht(keinRecht);
  }
  if (res.status === 403 && istCtVerbot(body)) return new KeinSpeicherRecht(keinRecht);
  return new ApiError(res.status, meldungAus(body, res.status));
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
    markReachable(false);
    throw e;
  }
}

let csrfToken: Promise<string | null> | null = null;

/**
 * Das CSRF-Token der Sitzung – einmal geholt, danach gemerkt. Gemessen 07.10.2026 ging Schreiben auch
 * ohne; der offizielle ChurchTools-Client schickt es trotzdem mit, und das ist die sichere Seite.
 * Scheitert das Holen, wird ohne geschrieben (und beim nächsten Mal neu versucht).
 */
function holeCsrf(): Promise<string | null> {
  csrfToken ??= (async () => {
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
  })().then((t) => {
    if (t === null) csrfToken = null;
    return t;
  });
  return csrfToken;
}

/** Nur für Tests: gemerktes CSRF-Token vergessen. */
export function _vergissCsrf(): void {
  csrfToken = null;
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
  markReachable(![502, 503, 504].includes(res.status));
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
    if (method !== 'GET') csrfVerwerfenBeiAblehnung(res.status);
    throw await fehlerAus(res, body, init.verweigert);
  }
  return body as T;
}

/**
 * **Ein abgelehntes Token wird verworfen** – die Lehre aus #298, die im Server seit August gilt
 * (`csrfWriteDenied`) und hier beim Bau der Extension fehlte (gefunden 07.10.2026, Phase 3b-2): Läuft die
 * Sitzung in ChurchTools neu an, ist das gemerkte Token ungültig. Ohne Verwerfen scheiterte danach JEDER
 * Schreibversuch, bis jemand die Seite neu lädt.
 */
function csrfVerwerfenBeiAblehnung(status: number): void {
  if (status === 401 || status === 403) csrfToken = null;
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
  markReachable(![502, 503, 504].includes(res.status));
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
  markReachable(![502, 503, 504].includes(res.status));
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
