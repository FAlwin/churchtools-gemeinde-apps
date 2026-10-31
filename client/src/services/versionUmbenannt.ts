/**
 * **Was mitgeht, wenn eine Version einen neuen Namen bekommt** – an EINER Stelle (31.10.2026).
 *
 * Eine umbenannte Version ist dieselbe Version unter neuem Schlüssel: Aussehen (Schrift, Spalten, Tonart …) und die
 * eigenen Anmerkungen gehören zu ihr. Umbenannt wird an zwei Stellen – beim Speichern im Editor und in „Dateien
 * verwalten“. Stünde die Regel in beiden, fehlte beim nächsten Mitnehmen eine Hälfte (so geschehen mit den
 * Anmerkungen, #814). Deshalb rufen beide das hier.
 *
 * Muss **vor** `selectVersion` laufen – die liest die Einstellungen der neuen Version sofort.
 */
import { einstellungenMitnehmen } from '../utils/songVersions';
import { anmerkungenMitnehmen } from './annotations';

export function umbenannteVersionMitnehmen(songId: number, alt: string, neu: string): void {
  einstellungenMitnehmen(songId, alt, neu, 'umbenannt');
  anmerkungenMitnehmen(songId, alt, neu);
}
