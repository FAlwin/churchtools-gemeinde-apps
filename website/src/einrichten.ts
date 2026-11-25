/**
 * **Die Website einrichten** (Bauplan Website W3a-1): legt die beiden Kategorien für die gewählte Gruppe an – jede erst,
 * nachdem nachgesehen ist, dass es sie noch nicht gibt, und danach nachgelesen (`kategorieSicherstellen`: ein 201 ist kein
 * Beleg). Nacheinander, damit ein Fehler nicht eine halb angelegte zweite Kategorie hinterlässt; ein zweiter Versuch
 * ergänzt, was fehlt. **Die Rechte an den Kategorien** vergibt seit W3b-1 `./rechte` (Stufen je Rolle, beim Einrichten
 * und später unter Einstellungen → „Wer darf was“); `einrichten` liefert dafür die Nummern der beiden Kategorien.
 */
import { kategorieSicherstellen } from '@shared/ct/modulDaten';
import { kategorienFuer } from '@shared/website/einrichten';
import type { Kategorien } from '@shared/website/rechte';
import { ctAlleSeiten } from '@ui/ct/verbindung';
import { gruppenAus } from '@shared/ct/gruppen';
import { modulPort } from '@ui/ct/modulPort';

export const EINRICHTEN_VERWEIGERT =
  'Einrichten darf nur, wer in ChurchTools bei der Erweiterung „Kategorien erstellen“ hat.';

export async function einrichten(
  modul: number,
  gruppe: { id: number; name: string },
): Promise<Kategorien> {
  const ids: number[] = [];
  for (const k of kategorienFuer(gruppe.id, gruppe.name)) {
    ids.push(await kategorieSicherstellen(modulPort, modul, k, EINRICHTEN_VERWEIGERT));
  }
  const [entwuerfe, veroeffentlicht] = ids;
  return { entwuerfe, veroeffentlicht };
}

/** Alle Gruppen, die man sehen darf – zur Wahl der Gruppe „Website“ (alle Seiten der Liste, nie abgeschnitten). */
export async function ladeGruppen(): Promise<{ id: number; name: string }[]> {
  return gruppenAus(await ctAlleSeiten<{ id?: unknown; name?: unknown }>('/groups'));
}
