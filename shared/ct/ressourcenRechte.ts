/**
 * **Welche Ressourcen darf man buchen – und bei welchen den Status setzen?** (W15-2, Reiter „Ressourcen“ im Fenster
 * „In Kalender eintragen“) – `GET /permissions/global` → `churchresource`:
 *
 * - `create bookings` = Liste der Ressourcen-IDs, die die Person buchen darf (gemessen 23.11.2026 als Admin).
 * - `administer bookings` = Liste der Ressourcen-IDs, bei denen sie den Status („Bestätigt“, „Abgelehnt“) setzen darf;
 *   sonst bleibt jede Buchung „Wartet auf Bestätigung“.
 *
 * Wie bei `kalenderRechte.ts`: Fehlt der Eintrag oder hat er eine andere Form, sind es keine Ressourcen – die Oberfläche
 * zeigt den Reiter dann nicht; ChurchTools prüft beim Anlegen ohnehin selbst.
 */
function idListe(globaleRechte: unknown, recht: string): ReadonlySet<number> {
  const liste = (globaleRechte as { churchresource?: Record<string, unknown> } | null | undefined)
    ?.churchresource?.[recht];
  return new Set(
    Array.isArray(liste) ? liste.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [],
  );
}

/** Ressourcen, die man buchen darf (`create bookings`). */
export const buchbareRessourcen = (globaleRechte: unknown): ReadonlySet<number> =>
  idListe(globaleRechte, 'create bookings');

/** Ressourcen, bei denen man den Status einer Buchung setzen darf (`administer bookings`). */
export const verwaltbareRessourcen = (globaleRechte: unknown): ReadonlySet<number> =>
  idListe(globaleRechte, 'administer bookings');
