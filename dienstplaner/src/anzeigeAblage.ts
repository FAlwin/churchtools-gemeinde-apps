import { ablagePort } from '@ui/ct/ablagePort';
import type { Abgleich } from '@ui/ct/useAblageSpiegel';
import { erstellePersonenAblage, type AblagePort } from '@shared/ct/personenAblage';

/** Der Spiegel im Gerät – je Person (geteiltes iPad). */
export const anzeigeSchluessel = (person: number) => `dienstplaner.anzeige.${person}`;

/** Die Datei der Person in ChurchTools – das Präfix trennt sie von den Dateien der Musik-App und der Protokolle. */
export const ANZEIGE_PRAEFIX = 'dienstplaner_';
export const ANZEIGE_DATEI = 'dienstplaner_anzeige.json';

/** Der Weg nach ChurchTools über den Anschluss `port` (im Browser `ablagePort`; Tests geben einen nachgestellten). */
export function anzeigeAbgleich(port: AblagePort): Abgleich {
  const ablage = erstellePersonenAblage({ praefix: ANZEIGE_PRAEFIX, datenName: ANZEIGE_DATEI });
  return (lokal) => ablage.mischeEin(port, lokal);
}
export const inChurchTools = anzeigeAbgleich(ablagePort);
