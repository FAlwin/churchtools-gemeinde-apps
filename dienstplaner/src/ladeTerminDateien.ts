/**
 * **Die Dateien am Termin im Browser** (Scheibe T2a): die ausführliche Liste frisch aus ChurchTools – mit Größe, die
 * die Terminliste nicht mitliefert (gemessen 02.11.2026).
 */
import { ctDaten } from '@ui/ct/verbindung';
import { dateienAusListe, type TerminDatei } from '@shared/ct/terminDateien';

export async function ladeDateien(eventId: number): Promise<TerminDatei[]> {
  return dateienAusListe(await ctDaten<unknown>(`/files/service/${eventId}`));
}
