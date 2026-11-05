/**
 * **Was die Zuhörer-Seite aus ChurchTools liest** (Bauplan Gebetsabend G2): den Zugang (mit „läuft seit“), die
 * Einstellungen und den nächsten Termin. Die Regeln stehen in `@shared/gebetsabend/`; hier wird nur gelesen.
 *
 * Fehler werden **geworfen**, nicht zu „keine Übertragung“ gemacht – vorübergehend ist nicht leer. Wer nachfragt
 * (alle 20 s), behält bei einem Fehler den letzten Stand (`Zuhoeren.tsx`), statt einen laufenden Player zu schließen.
 */
import { inhaltAus, werteLesen } from '@shared/ct/modulDaten';
import { isoTag } from '@shared/ct/zeit';
import { zugangAus, ZUGANG_ART, ZUGANG_FASSUNG, type Zugang } from '@shared/gebetsabend/zugang';
import {
  einstellungenAus,
  EINSTELLUNGEN_ART,
  EINSTELLUNGEN_FASSUNG,
  STANDARD_EINSTELLUNGEN,
  type Einstellungen,
} from '@shared/gebetsabend/einstellungen';
import {
  naechsterTermin,
  TAGE_VORAUS,
  terminPfad,
  type GebetsTermin,
  type TerminRoh,
} from '@shared/gebetsabend/termin';
import { modulPort } from '@ui/ct/modulPort';
import { ctDaten } from '@ui/ct/verbindung';

/** Der Zugang aus der Kategorie „Zugang“ – `null`, wenn (noch) keiner gespeichert ist. Der erste gültige Wert zählt. */
export async function ladeZugang(modul: number, kategorie: number): Promise<Zugang | null> {
  for (const w of await werteLesen(modulPort, modul, kategorie)) {
    const z = zugangAus(inhaltAus(w, ZUGANG_ART, ZUGANG_FASSUNG));
    if (z) return z;
  }
  return null;
}

export async function ladeEinstellungen(modul: number, kategorie: number): Promise<Einstellungen> {
  for (const w of await werteLesen(modulPort, modul, kategorie)) {
    const roh = inhaltAus(w, EINSTELLUNGEN_ART, EINSTELLUNGEN_FASSUNG);
    if (roh) return einstellungenAus(roh);
  }
  return STANDARD_EINSTELLUNGEN;
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
