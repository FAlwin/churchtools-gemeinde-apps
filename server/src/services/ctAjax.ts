/**
 * **Die einzige Stelle, die die alte ChurchTools-Schnittstelle anspricht** (#322).
 *
 * `POST /index.php?q=churchservice/ajax` ist **undokumentiert und intern**; sie kann sich mit einem
 * ChurchTools-Update ohne Ankündigung ändern. Deshalb liegt sie hinter genau einer Funktion: Ein
 * Update trifft dann einen Ort, nicht fünf. Alles andere im Projekt geht über `/api/` – siehe
 * `ctRead`/`ctWrite`.
 *
 * **Warum als eigenes Modul:** Sie stand ursprünglich privat in `ctSongSelect.ts`, weil SongSelect der
 * erste Nutzer war. Mit den Lied-Kategorien kam ein zweiter (`ctSongCategories.ts`) – und damit die
 * Wahl zwischen einer zweiten Fassung daneben oder einem Import aus dem SongSelect-Modul, das
 * fachlich nichts mit Kategorien zu tun hat. Beides wäre falsch: Das Projekt hat seine teuersten
 * Fehler damit gemacht, dass dieselbe Regel an mehreren Stellen stand (#280, #359). Wer sie hier
 * ändert, ändert sie für alle Nutzer.
 *
 * **Warum ein CSRF-Token, obwohl auch nur gelesen wird:** Die alte Schnittstelle verlangt es für
 * jeden Aufruf – so macht es die ChurchTools-Oberfläche selbst (gemessen). Wir nehmen denselben Weg
 * wie alle Schreibvorgänge (`getCsrfToken`), damit es eine Stelle gibt, die Tokens holt und bei
 * Ablehnung verwirft (#298).
 *
 * Vollständig gemessen und begründet in `docs/entwicklung/churchtools-songselect.md`.
 */
import {
  ajaxMeldungen,
  ajaxNutzlast,
  type AjaxMeldungen,
  type AltPort,
} from '@shared/ct/altSchnittstelle';
import { HttpError } from '../middleware/errorHandler.js';
import { csrfWriteDenied, getCsrfToken } from './ctCsrf.js';
import {
  BASE,
  CT_FILE_TIMEOUT_MS,
  CtOverloadedError,
  ctSignal,
  parseRetryAfter,
} from './ctHttp.js';

/**
 * Die Meldungen eines Aufrufs – **durchgereicht, nicht generisch** (Muster von `uploadFile`).
 *
 * Als die Funktion noch privat in `ctSongSelect.ts` stand, sprachen ihre Meldungen von SongSelect
 * („ChurchTools hat die SongSelect-Anfrage abgelehnt"). Beim Herausziehen wären sie zu „die Anfrage"
 * verwaschen – für den Nutzer ein Verlust, denn ein Fehler beim Liedersuchen und einer beim Laden der
 * Kategorien sind verschiedene Dinge. Genau diese Abwägung ist bei `uploadChordpro` schon einmal so
 * entschieden worden: Der Baustein wird geteilt, der Wortlaut bleibt beim Aufrufer.
 */
export type { AjaxMeldungen };

export async function ctAjax(
  cookie: string,
  func: string,
  felder: Record<string, string> = {},
  meldungen: AjaxMeldungen = {},
): Promise<unknown> {
  const m = ajaxMeldungen(meldungen);
  const csrf = await getCsrfToken(cookie);
  const body = new URLSearchParams({ func, ...felder });

  const res = await fetch(`${BASE}/index.php?q=churchservice/ajax`, {
    signal: ctSignal(CT_FILE_TIMEOUT_MS),
    method: 'POST',
    headers: {
      Cookie: cookie,
      'CSRF-Token': csrf,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      // Ohne diesen Kopf antwortet die alte Schnittstelle mit einer HTML-Seite statt JSON.
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    },
    body,
  });

  if (res.status === 401 || res.status === 403) csrfWriteDenied(cookie, m.verweigert);
  // 429 ist eine Drosselung, kein Serverfehler (#383) – dieselbe Regel wie in `ctGet` (#300),
  // `fileDownloadError`, `ctWrite` und `login` (#381). Nur so erkennt ein Massenlauf die Bremse per
  // `isCtOverloaded`, und der Nutzer liest „bitte einen Moment warten" statt „abgelehnt".
  if (res.status === 429) {
    throw new CtOverloadedError(parseRetryAfter(res.headers.get('retry-after')));
  }
  if (!res.ok) {
    throw new HttpError(502, `${m.abgelehnt} (${res.status}).`);
  }

  // Die Antwort auswerten steht seit #335 (3b-2) in `@shared/ct/altSchnittstelle` – der Browser der
  // Extension liest dieselbe Schnittstelle.
  return ajaxNutzlast(await res.text(), m, (status, meldung) => new HttpError(status, meldung));
}

/**
 * Der Anschluss an die alte Schnittstelle für die Regeln in `@shared/ct` (SongSelect, Lied-Statistik):
 * `ctAjax` mit dem Cookie des Nutzers und die Fehlerklasse des Servers.
 */
export function altPortFuer(cookie: string): AltPort {
  return {
    anfrage: (func, felder, meldungen) => ctAjax(cookie, func, felder, meldungen),
    fehler: (status, meldung) => new HttpError(status, meldung),
  };
}
