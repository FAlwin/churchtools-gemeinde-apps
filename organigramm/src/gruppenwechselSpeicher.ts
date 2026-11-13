/**
 * **Die Einrichtung des Gruppenwechsels im Speicher der Erweiterung** (Bauplan O9-2, O9-F5): EIN Wert in der Kategorie
 * „Gruppenwechsel“. Das Format steht in `@shared/organigramm/gruppenwechselEinrichtung`. Geschrieben wird sie erst von
 * „Einrichten“ (O9-5); bis dahin legt ihn in der Test-Instanz ein Skript an.
 *
 * Lesen dürfen alle mit dem Reiter, ändern nur Admins – das schützt ChurchTools über die Rechte der Kategorie (setzt
 * Alwin). Ohne Kategorie oder ohne Leserecht gibt es den Reiter nicht.
 */
import {
  einrichtungAus,
  GW_ART,
  type Einrichtung,
} from '@shared/organigramm/gruppenwechselEinrichtung';
import type { LeseErgebnis } from '@shared/ct/versionierterWert';
import { dokumentAusKategorie } from './speicher';

export const GW_KATEGORIE = {
  kuerzel: 'gruppenwechsel',
  name: 'Gruppenwechsel',
  beschreibung:
    'Angelegt von der Erweiterung „Organigramm“ – lesen: alle mit dem Reiter „Kinder & Jugend“; ändern: Admins.',
};

export function ladeEinrichtung(): Promise<LeseErgebnis<Einrichtung>> {
  return dokumentAusKategorie(GW_KATEGORIE.kuerzel, GW_ART, einrichtungAus);
}
