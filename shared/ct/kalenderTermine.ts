/**
 * **Termine eines Kalenders in einem Zeitraum** – `GET /calendars/appointments?calendar_ids[]=…&from=…&to=…`. Die
 * Antwort trägt je Termin `base` (Titel, ID) und `calculated` (Beginn/Ende dieses Vorkommens: UTC, bei ganztägigen
 * Terminen nur der Tag, Ende einschließlich – gemessen am Ferienkalender 11./12.11.2026).
 *
 * Lag bis O9-2 (12.11.2026) in `shared/gebetsabend/termin.ts`. **Die einzige Stelle, die diesen Pfad baut** – seit
 * 16.11.2026 auch für Anmeldungen und Protokolle. Wer mehr Felder liest (Kalender, `startDate` am `base`), behält einen
 * eigenen Rohtyp; der Pfad kommt trotzdem von hier.
 */

/** Ein Eintrag der Liste, nur die gelesenen Felder. */
export interface TerminRoh {
  base?: { id?: number; title?: string };
  appointment?: { base?: { id?: number; title?: string } };
  calculated?: { startDate?: string; endDate?: string };
}

export function terminPfad(kalender: number, von: string, bis: string): string {
  return `/calendars/appointments?calendar_ids[]=${kalender}&from=${von}&to=${bis}`;
}
