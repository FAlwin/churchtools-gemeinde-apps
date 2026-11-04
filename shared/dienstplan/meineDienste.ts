/**
 * **Die eigenen Dienste je Termin** – für die Terminzeilen im Reiter „Abwesenheiten“ (Dienstplaner E7-2c, Entwurf
 * `e7-2-abwesenheiten.html`): „Du bist eingeteilt: Ton“ bzw. „Angefragt: Gesang“, und wer einen solchen Termin
 * abhakt, sieht in Rot „bitte auch den Dienst absagen“ – die Abwesenheit allein sagt dem Planer nichts.
 *
 * Quelle: `GET /persons/{ich}/servicerequests?only_future=true` (gemessen 03.11.2026, `docs/messung-e7.md`): je
 * Einteilung ein Eintrag, offen **und** zugesagt, abgesagte nicht; ohne Admin-Recht lesbar. Ein Aufruf deckt den
 * ganzen Zeitraum ab – die Terminliste der Abwesenheiten reicht ein Jahr voraus, viel weiter als die geladenen Dienste.
 */
export interface MeinDienstKurz {
  /** Name des Dienstes („Ton“). */
  name: string;
  zugesagt: boolean;
}

/** Roh-Einträge → je Termin-ID die eigenen Dienste (Reihenfolge wie geliefert). Unlesbares wird übergangen. */
export function dienstAusAnfragen(roh: unknown[]): Map<number, MeinDienstKurz[]> {
  const je = new Map<number, MeinDienstKurz[]>();
  for (const e of roh) {
    const a = e as {
      serviceName?: unknown;
      isAccepted?: unknown;
      isValid?: unknown;
      event?: { id?: unknown } | null;
    } | null;
    const eventId = a?.event?.id;
    if (!a || typeof eventId !== 'number' || a.isValid === false) continue;
    const name =
      typeof a.serviceName === 'string' && a.serviceName.trim() ? a.serviceName.trim() : 'Dienst';
    je.set(eventId, [...(je.get(eventId) ?? []), { name, zugesagt: a.isAccepted === true }]);
  }
  return je;
}
