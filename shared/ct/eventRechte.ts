import { idsAusRecht } from './rechte';

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

/**
 * **In welchen Kalendern darf man die Infos eines Events ändern?** (Baustein „Reihe“, Übertragen) – dasselbe Recht
 * (`edit events`), aber gelesen wie im Dienstplaner (`idsAusRecht`): eine Liste → die Kalender-IDs, `null` = ein Recht
 * **ohne Aufzählung** gilt für alle Kalender, kein Recht → `[]`. Anders als `eventKalender` (das den Reiter „Events“ nur bei
 * einer Liste zeigt) darf hier ein `true` nicht zu „darfst du nicht“ führen. Geht an `darfTerminAendern` (`terminKalender`).
 */
export function eventInfosKalender(globaleRechte: unknown): number[] | null {
  const cs = (globaleRechte as { churchservice?: Record<string, unknown> } | null | undefined)
    ?.churchservice;
  return idsAusRecht(cs?.['edit events']);
}
