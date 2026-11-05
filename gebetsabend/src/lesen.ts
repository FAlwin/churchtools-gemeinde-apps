/**
 * **Was die Zuhörer-Seite aus ChurchTools liest** (Bauplan Gebetsabend G2): den Zugang (mit „läuft seit“), die
 * Einstellungen und den nächsten Termin. Die Regeln stehen in `@shared/gebetsabend/`; hier wird nur gelesen.
 *
 * Fehler werden **geworfen**, nicht zu „keine Übertragung“ gemacht – vorübergehend ist nicht leer. Wer nachfragt
 * (alle 20 s), behält bei einem Fehler den letzten Stand (`Zuhoeren.tsx`), statt einen laufenden Player zu schließen.
 */
import { isoTag } from '@shared/ct/zeit';
import { einstellungenLesen, zugangLesen } from '@shared/gebetsabend/ablage';
import type { Zugang } from '@shared/gebetsabend/zugang';
import type { Einstellungen } from '@shared/gebetsabend/einstellungen';
import {
  naechsterTermin,
  TAGE_VORAUS,
  terminPfad,
  type GebetsTermin,
  type TerminRoh,
} from '@shared/gebetsabend/termin';
import { ctDaten } from '@ui/ct/verbindung';
import { leseFehler, port } from './speicher';

/** Der Zugang aus der Kategorie „Zugang“ – `null`, wenn (noch) keiner gespeichert ist. */
export async function ladeZugang(modul: number, kategorie: number): Promise<Zugang | null> {
  const l = await zugangLesen(port, modul, kategorie);
  if (!l.ok) throw leseFehler(l.grund);
  return l.stand.inhalt;
}

/** Die Einstellungen – ohne gespeicherte die Vorgabe (`einstellungenAus`). */
export async function ladeEinstellungen(modul: number, kategorie: number): Promise<Einstellungen> {
  const l = await einstellungenLesen(port, modul, kategorie);
  if (!l.ok) throw leseFehler(l.grund);
  return l.stand.inhalt;
}

/** Der nächste Gebetsabend – `null` ohne Kalender oder ohne passenden Termin in den nächsten Wochen. */
export async function ladeTermin(
  e: Einstellungen,
  jetzt = new Date(),
): Promise<GebetsTermin | null> {
  if (e.kalender === null) return null;
  const bis = new Date(jetzt.getTime() + TAGE_VORAUS * 86_400_000);
  const roh =
    (await ctDaten<TerminRoh[] | null>(terminPfad(e.kalender, isoTag(jetzt), isoTag(bis)))) ?? [];
  return naechsterTermin(roh, e.suchwort, jetzt);
}
