/**
 * **In welchen Kalendern darf man Termine anlegen?** – `GET /permissions/global` → `churchcal["edit category"]` ist die Liste
 * der Kalender-IDs. Die eine Stelle dafür: Anmeldungen (Termin anlegen) und Protokolle (Reiter „Termine“, W14). Fehlt der
 * Eintrag oder hat er eine andere Form (kein Recht, andere ChurchTools-Fassung), sind es keine Kalender – die Oberfläche
 * zeigt dann nichts zum Eintragen an; ChurchTools prüft beim Anlegen ohnehin selbst.
 */
export function schreibbareKalender(globaleRechte: unknown): ReadonlySet<number> {
  const cal = (globaleRechte as { churchcal?: Record<string, unknown> } | null | undefined)
    ?.churchcal;
  const liste = cal?.['edit category'];
  return new Set(
    Array.isArray(liste) ? liste.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [],
  );
}
