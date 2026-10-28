/**
 * Ein Fehler mit HTTP-Status – für das eigene Backend der Musik-App UND für ChurchTools direkt.
 *
 * Aus `client/src/services/api.ts` hierher gezogen (#474), damit jede Erweiterung dieses Repos dieselbe
 * Klasse wirft: Aufrufer unterscheiden über `instanceof ApiError` und `status` (401 = abgemeldet,
 * 503/504 = vorübergehend). Zwei Klassen gleichen Namens würden sich gegenseitig nicht erkennen.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Der Rumpf der Antwort, falls es einen gab – z. B. `args.duplicatePersonId` beim Anlegen einer Person (A7-4). */
    public daten?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * **ChurchTools hat geantwortet, aber nicht übernommen, was geschickt wurde** – das Nachlesen zeigt etwas
 * anderes als das 2xx versprach (Lehre vom 11.08.2026). Ein 502, aber nicht „vorübergehend“: Die Meldung sagt,
 * WAS fehlt (`fehlerMeldung`). Stand bis 22.10.2026 nur in den Anmeldungen (A3); die Protokolle brauchen sie
 * beim Einrichten (S2-1).
 */
export class NichtUebernommen extends ApiError {
  constructor(was: string) {
    super(502, `ChurchTools hat ${was} nicht übernommen. Bitte noch einmal versuchen.`);
    this.name = 'NichtUebernommen';
  }
}

/**
 * **Unklar, ob ChurchTools es angelegt hat – nicht einfach wiederholen.** Wo ein zweiter Versuch Schaden anrichtet
 * (Protokolle S5-2: jeder Eingeladene bekäme die Einladung doppelt), sagt die Meldung, wo man nachsieht. Ohne eigene
 * Klasse machte `fehlerMeldung` daraus „antwortet gerade nicht – versuch es gleich noch einmal“ (beim Bau von S5-2
 * gefunden) – genau der falsche Rat.
 */
export class Unklar extends ApiError {
  constructor(message: string) {
    super(502, message);
    this.name = 'Unklar';
  }
}
