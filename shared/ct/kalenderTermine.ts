/**
 * **Termine eines Kalenders in einem Zeitraum** – `GET /calendars/appointments?calendar_ids[]=…&from=…&to=…`. Die
 * Antwort trägt je Termin `base` (Titel, ID) und `calculated` (Beginn/Ende dieses Vorkommens: UTC, bei ganztägigen
 * Terminen nur der Tag, Ende einschließlich – gemessen am Ferienkalender 11./12.11.2026).
 *
 * Lag bis O9-2 (12.11.2026) in `shared/gebetsabend/termin.ts`. Anmeldungen und Protokolle bauen denselben Pfad noch
 * selbst.
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
