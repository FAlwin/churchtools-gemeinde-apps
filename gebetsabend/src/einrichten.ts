/**
 * **Den Gebetsabend einrichten** (Bauplan Gebetsabend G1): legt die Kategorien „Zugang“ und „Einstellungen“ an –
 * jede erst, nachdem nachgesehen ist, dass es sie noch nicht gibt, und danach nachgelesen (`kategorieSicherstellen`:
 * ein 201 ist kein Beleg). Nacheinander, damit ein Fehler nicht eine halb angelegte zweite Kategorie hinterlässt.
 */
import { kategorieSicherstellen } from '@shared/ct/modulDaten';
import { KATEGORIEN } from '@shared/gebetsabend/einrichten';
import { modulPort } from '@ui/ct/modulPort';

const VERWEIGERT =
  'Einrichten darf nur, wer in ChurchTools bei der Erweiterung „Kategorien erstellen“ hat.';

export async function einrichten(modul: number): Promise<void> {
  for (const k of KATEGORIEN) {
    await kategorieSicherstellen(modulPort, modul, k, VERWEIGERT);
  }
}
