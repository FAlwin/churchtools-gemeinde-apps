/**
 * **Die Website im Speicher der Erweiterung** – die dünne Hülle der Oberfläche um `@shared/website/speicher` (dort stehen
 * Aufbau, Lesen und die Reihenfolge beim Schreiben). Hier nur: der Anschluss dieser Erweiterung (`modulPort`) und die
 * Kategorie „Entwürfe“. Gelesen und geschrieben wird in W3a-1 nur dort; „Veröffentlicht“ folgt mit der Freigabe (W3b).
 */
import { modulPort } from '@ui/ct/modulPort';
import {
  menueSpeichern,
  seiteLoeschen,
  seiteSpeichern,
  websiteLesen,
  type SpeicherOrt,
  type WebsiteStand,
} from '@shared/website/speicher';
import type { Menue, Seite } from '@shared/website/modell';

export interface EntwurfsOrt {
  modul: number;
  /** Die Kategorie „Entwürfe“. */
  kategorie: number;
}

const ort = (o: EntwurfsOrt): SpeicherOrt => ({ p: modulPort, ...o });

export const ladeWebsite = (o: EntwurfsOrt): Promise<WebsiteStand> =>
  websiteLesen(modulPort, o.modul, o.kategorie);
export const speichereSeite = (o: EntwurfsOrt, seite: Seite) => seiteSpeichern(ort(o), seite);
export const loescheSeite = (o: EntwurfsOrt, id: string) => seiteLoeschen(ort(o), id);
export const speichereMenue = (o: EntwurfsOrt, menue: Menue) => menueSpeichern(ort(o), menue);
