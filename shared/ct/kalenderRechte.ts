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

/**
 * **In welchen Kalendern darf man Termin-Vorlagen speichern?** – `churchcal["edit calendar entry template"]`, wie bei
 * `schreibbareKalender` eine Liste von Kalender-IDs (gemessen 23.11.2026 als Admin). Fehlt sie, sind es keine.
 */
export function vorlagenKalender(globaleRechte: unknown): ReadonlySet<number> {
  const cal = (globaleRechte as { churchcal?: Record<string, unknown> } | null | undefined)
    ?.churchcal;
  const liste = cal?.['edit calendar entry template'];
  return new Set(
    Array.isArray(liste) ? liste.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [],
  );
}

/**
 * **Darf man neue Termin-Tags anlegen?** – `churchcal["admin appointment tags"]` (gemessen 23.11.2026 beim Admin). Je
 * nach ChurchTools-Fassung `true` oder eine Liste; nur ein eindeutiges Ja zählt – ein neuer Tag ohne das Recht ließe das
 * ganze Anlegen scheitern.
 */
export function darfTagsVerwalten(globaleRechte: unknown): boolean {
  const cal = (globaleRechte as { churchcal?: Record<string, unknown> } | null | undefined)
    ?.churchcal;
  const w = cal?.['admin appointment tags'];
  return w === true || (Array.isArray(w) && w.length > 0);
}
