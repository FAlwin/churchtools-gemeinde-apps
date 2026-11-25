/**
 * **In welchen Gruppentypen darf man Gruppen anlegen?** (W15-5, Reiter „Anmeldung“ im Fenster „In Kalender eintragen“) –
 * `GET /permissions/global` → `churchdb["create groups of grouptype"]` ist die Liste der Gruppentyp-IDs (gemessen
 * 25.11.2026). Den Reiter gibt es nur, wenn die Liste nicht leer ist, und die Auswahl „Gruppentyp“ zeigt nur diese Typen.
 * Wie bei `eventRechte.ts`: Fehlt der Eintrag, ist er ein bloßes „wahr“ ohne Aufzählung oder hat er eine andere Form,
 * sind es **keine** Typen – ChurchTools prüft beim Anlegen ohnehin selbst. Die Zeilen liest `idsAusRecht` (eine Stelle für
 * alle Listen-Rechte).
 */
import { idsAusRecht } from './rechte';

export function gruppenTypenAnlegen(globaleRechte: unknown): ReadonlySet<number> {
  const db = (globaleRechte as { churchdb?: Record<string, unknown> } | null | undefined)?.churchdb;
  return new Set(idsAusRecht(db?.['create groups of grouptype']) ?? []);
}
