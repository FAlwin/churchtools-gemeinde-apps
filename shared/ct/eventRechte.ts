/**
 * **In welchen Kalendern darf man Events anlegen?** (W15-3, Reiter „Events“ im Fenster „In Kalender eintragen“) –
 * `GET /permissions/global` → `churchservice["edit events"]` ist die Liste der Kalender-IDs (gemessen 23.11.2026 als
 * Admin). Der Reiter erscheint nur, wenn der **gewählte** Kalender darin steht – wechselt man den Kalender, kommt er oder
 * geht. Wie bei `kalenderRechte.ts`: Fehlt der Eintrag oder hat er eine andere Form, sind es keine Kalender; ChurchTools
 * prüft beim Anlegen ohnehin selbst.
 */
export function eventKalender(globaleRechte: unknown): ReadonlySet<number> {
  const liste = (globaleRechte as { churchservice?: Record<string, unknown> } | null | undefined)
    ?.churchservice?.['edit events'];
  return new Set(
    Array.isArray(liste) ? liste.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [],
  );
}
