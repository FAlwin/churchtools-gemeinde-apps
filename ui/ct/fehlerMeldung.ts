/**
 * **Was eine Erweiterung sagt, wenn ChurchTools nicht liefert** – für jede App dieses Repos, damit die
 * Zweige überall gleich unterschieden werden (Dienstplaner E2). Genutzt von Dienstplaner und Anmeldungen;
 * auch der Fall `NichtUebernommen` steht seit S2-1 der Protokolle hier (vorher nur in den Anmeldungen).
 *
 * Die Zweige einzeln, denn vorübergehend ist nicht ungültig:
 * - **401** = abgemeldet → neu laden, „Erneut versuchen“ hilft nicht.
 * - **gebremst, 5xx, keine Antwort** (Netz, Zeitüberschreitung – kein `ApiError`) → vorübergehend,
 *   „Erneut versuchen“.
 * - **sonst** (z. B. 403 kein Recht, 404) → die Meldung von ChurchTools bzw. der Verbindung
 *   (`verbindungEinrichten({ keinRecht })`), mit „Erneut versuchen“.
 */
import { ApiError, NichtUebernommen } from './fehler';
import { istUeberlastet } from './verbindung';

export interface Fehlermeldung {
  text: string;
  /** Lohnt „Erneut versuchen“? */
  nochmal: boolean;
}

export function fehlerMeldung(e: unknown): Fehlermeldung {
  // Vor dem 5xx-Zweig: ein 502, der aber sagt, WAS nicht übernommen wurde – nicht „antwortet gerade nicht“.
  if (e instanceof NichtUebernommen) return { text: e.message, nochmal: true };
  if (e instanceof ApiError && e.status === 401) {
    return {
      text: 'Du bist bei ChurchTools nicht mehr angemeldet. Bitte lade die Seite neu und melde dich an.',
      nochmal: false,
    };
  }
  if (istUeberlastet(e) || (e instanceof ApiError && e.status >= 500) || !(e instanceof ApiError)) {
    return {
      text: 'ChurchTools antwortet gerade nicht. Bitte versuch es gleich noch einmal.',
      nochmal: true,
    };
  }
  return { text: e.message, nochmal: true };
}
