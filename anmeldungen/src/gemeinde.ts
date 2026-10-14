import { vorgabenVorschlag, type NeuePersonVorgaben } from '@shared/anmeldung/vorbereiten';
import { stammdaten } from './einrichten';

/**
 * **Was für die ganze Gemeinde gilt** (A6-2, #548) – zuerst die Vorgaben für neue Personen (Alwin, 14.10.2026:
 * „einmal je Gemeinde“). Ohne gespeicherte Einstellung gilt der Vorschlag: „Interessent“, dazu Standort und Bereich,
 * wenn es genau einen gibt.
 */
export async function gemeindeVorgaben(): Promise<Partial<NeuePersonVorgaben>> {
  return vorgabenVorschlag(await stammdaten());
}
