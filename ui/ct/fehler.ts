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
