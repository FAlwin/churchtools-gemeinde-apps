/**
 * **Die Einrichtung des Gruppenwechsels im Speicher der Erweiterung** (Bauplan O9-2, O9-F5): EIN Wert in der Kategorie
 * „Gruppenwechsel“. Das Format steht in `@shared/organigramm/gruppenwechselEinrichtung`. Geschrieben wird sie erst von
 * „Einrichten“ (O9-5); bis dahin legt ihn in der Test-Instanz ein Skript an.
 *
 * Lesen dürfen alle mit dem Reiter, ändern nur Admins – das schützt ChurchTools über die Rechte der Kategorie (setzt
 * Alwin). Ohne Kategorie oder ohne Leserecht gibt es den Reiter nicht – außer für „Berechtigungen verwalten“: Sie sehen „noch nicht eingerichtet“.
 */
import {
  einrichtungAus,
  GW_ART,
  type Einrichtung,
} from '@shared/organigramm/gruppenwechselEinrichtung';
import type { SpeicherGrund } from '@shared/ct/versionierterWert';
import { dokumentGenau } from './speicher';

export const GW_KATEGORIE = {
  kuerzel: 'gruppenwechsel',
  name: 'Gruppenwechsel',
  beschreibung:
    'Angelegt von der Erweiterung „Organigramm“ – lesen: alle mit dem Reiter „Kinder & Jugend“; ändern: Admins.',
};

/**
 * Was beim Lesen der Einrichtung herauskommt (O9-5c) – vier Fälle, die nie ineinander übergehen dürfen:
 * - `da`: eingerichtet,
 * - `keine`: Es gibt keine (Kategorie fehlt oder ohne Wert) – nur hier darf „Einrichten“ angeboten werden,
 * - `unlesbar`: Ein Wert steht da, ist aber nicht in diesem Format (andere Fassung, beschädigt) – NIE wie „keine“
 *   behandeln: Neu einrichten würde ihn überschreiben,
 * - `fehler`: gerade nicht lesbar (vorübergehend, abgemeldet, kein Recht) – vorübergehend ist nicht „nicht eingerichtet“.
 */
export type EinrichtungLesen =
  | { art: 'da'; einrichtung: Einrichtung }
  | { art: 'keine' }
  | { art: 'unlesbar' }
  | { art: 'fehler'; grund: SpeicherGrund };

export async function ladeEinrichtung(): Promise<EinrichtungLesen> {
  const r = await dokumentGenau(GW_KATEGORIE.kuerzel, GW_ART, einrichtungAus);
  return r.art === 'da' ? { art: 'da', einrichtung: r.daten.inhalt } : r;
}
