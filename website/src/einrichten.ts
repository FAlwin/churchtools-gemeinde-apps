/**
 * **Die Website einrichten** (Bauplan Website W3a-1): legt die beiden Kategorien für die gewählte Gruppe an – jede erst,
 * nachdem nachgesehen ist, dass es sie noch nicht gibt, und danach nachgelesen (`kategorieSicherstellen`: ein 201 ist kein
 * Beleg). Nacheinander, damit ein Fehler nicht eine halb angelegte zweite Kategorie hinterlässt; ein zweiter Versuch
 * ergänzt, was fehlt. Die Rechte an den Kategorien setzt in W3a-1 die Verwaltung von Hand (`docs/betrieb/WEBSITE.md`).
 */
import { kategorieSicherstellen } from '@shared/ct/modulDaten';
import { kategorienFuer } from '@shared/website/einrichten';
import { ctAlleSeiten } from '@ui/ct/verbindung';
import { gruppenAus } from '@shared/ct/gruppen';
import { modulPort } from '@ui/ct/modulPort';

const VERWEIGERT =
  'Einrichten darf nur, wer in ChurchTools bei der Erweiterung „Kategorien erstellen“ hat.';

export async function einrichten(
  modul: number,
  gruppe: { id: number; name: string },
): Promise<void> {
  for (const k of kategorienFuer(gruppe.id, gruppe.name)) {
    await kategorieSicherstellen(modulPort, modul, k, VERWEIGERT);
  }
}

/** Alle Gruppen, die man sehen darf – zur Wahl der Gruppe „Website“ (alle Seiten der Liste, nie abgeschnitten). */
export async function ladeGruppen(): Promise<{ id: number; name: string }[]> {
  return gruppenAus(await ctAlleSeiten<{ id?: unknown; name?: unknown }>('/groups'));
}
