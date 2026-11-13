/**
 * **Der nächste Gebetsabend aus dem Kalender** (Bauplan Gebetsabend G2). Gelesen wird
 * `GET /calendars/appointments?calendar_ids[]=…&from=…&to=…` – dieselbe Abfrage wie in Protokollen und Anmeldungen;
 * die Antwort trägt je Termin `base` (Titel, ID) und `calculated` (Beginn/Ende dieses Vorkommens, UTC).
 */

import type { TerminRoh } from '../ct/kalenderTermine';
export { terminPfad, type TerminRoh } from '../ct/kalenderTermine';

export interface GebetsTermin {
  id: number;
  titel: string;
  /** UTC wie von ChurchTools, z. B. `2026-11-12T18:30:00Z`. */
  beginn: string;
  ende: string | null;
}

/** So weit voraus wird gesucht – ein Gebetsabend, der weiter weg ist, steht nicht als „nächster“ da. */
export const TAGE_VORAUS = 60;

/**
 * Der nächste passende Termin: Titel enthält das Suchwort (leer = jeder), und er ist **nicht vorbei** – ein Abend,
 * der gerade läuft, bleibt der nächste, bis er zu Ende ist. Ohne Ende zählt der Beginn.
 */
export function naechsterTermin(
  roh: readonly TerminRoh[],
  suchwort: string,
  jetzt: Date,
): GebetsTermin | null {
  const wort = suchwort.trim().toLowerCase();
  const passend: GebetsTermin[] = [];
  for (const r of roh) {
    const b = r.base ?? r.appointment?.base;
    const beginn = r.calculated?.startDate;
    if (!b || typeof b.id !== 'number' || !beginn) continue;
    const titel = (b.title ?? '').trim();
    if (wort && !titel.toLowerCase().includes(wort)) continue;
    const ende = r.calculated?.endDate ?? null;
    if (Date.parse(ende ?? beginn) < jetzt.getTime()) continue;
    passend.push({ id: b.id, titel, beginn, ende });
  }
  passend.sort((a, z) => Date.parse(a.beginn) - Date.parse(z.beginn));
  return passend[0] ?? null;
}
