/**
 * Die Laufzeit der ChurchTools-Extension (#334, Plan `docs/entwicklung/plan-extension.md`).
 *
 * **Die einzige Stelle, die `import.meta.env.MODE` liest.** Läuft die App als Extension unter
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

/** Läuft dieser Build als ChurchTools-Extension? (`vite build --mode extension`) */
export const istExtension: boolean = import.meta.env.MODE === 'extension';

declare global {
  interface Window {
    /** Setzt ChurchTools auf seinen Extension-Seiten (gemessen 07.10.2026: `https://<instanz>/`). */
    settings?: { base_url?: string };
  }
}

/** Adresse der ChurchTools-Instanz, ohne abschließenden Schrägstrich. */
export function ctBasis(): string {
  const url = window.settings?.base_url ?? window.location.origin;
  return url.replace(/\/+$/, '');
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
export async function fehlerAus(res: Response, body: unknown): Promise<ApiError> {
  if (res.status === 401) {
    const person = await angemeldetePerson();
    if (person === null) return new ApiError(503, 'ChurchTools antwortet gerade nicht eindeutig.');
    if (person === 0) return new ApiError(401, 'Bei ChurchTools nicht mehr angemeldet.');
    return new KeinSpeicherRecht(KEIN_RECHT_MELDUNG);
  }
  if (res.status === 403 && istCtVerbot(body)) return new KeinSpeicherRecht(KEIN_RECHT_MELDUNG);
  return new ApiError(res.status, meldungAus(body, res.status));
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
  init: { method?: string; body?: FormData | string } = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const csrf = await holeCsrf();
    if (csrf) headers['CSRF-Token'] = csrf;
  }
  let res: Response;
  try {
    res = await fetch(`${ctBasis()}/api${pfad}`, {
      method,
      credentials: 'include',
      headers,
      body: init.body,
    });
  } catch (e) {
    markReachable(false);
    throw e;
  }
  markReachable(![502, 503, 504].includes(res.status));
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) throw await fehlerAus(res, body);
  return body as T;
}

/**
 * Eine Datei über ihre `fileUrl` laden – geht nur mit dem Sitzungs-Cookie (gemessen 07.10.2026; ein
 * Login-Token-Header endet in einer Weiterleitungsschleife). Fehler wie bei `ctAnfrage`.
 */
export async function ctDatei(fileUrl: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(fileUrl, { credentials: 'include' });
  } catch (e) {
    markReachable(false);
    throw e;
  }
  markReachable(![502, 503, 504].includes(res.status));
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
