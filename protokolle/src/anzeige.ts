/**
 * **Wie Zeiten in den Protokollen erscheinen** (S3-2) – auf den gemeinsamen Datumsbausteinen
 * (`@shared/ct/datum`, `@shared/ct/zeit`), nicht nachgerechnet.
 */
import { datumText, kachel } from '@shared/ct/datum';
import { ortszeitAus } from '@shared/ct/zeit';
import type { VerweisArt } from '@shared/protokolle/dokument';

/** „Mi, 14.10.2026 · 19:00 Uhr“ in der Zeitzone der Gemeinde. */
export function wannLang(beginn: string, zeitzone: string): string {
  const lokal = ortszeitAus(beginn, zeitzone);
  return `${datumText(lokal.slice(0, 10))} · ${lokal.slice(11, 16)} Uhr`;
}

/** „19:00 Uhr“ */
export function uhrzeit(beginn: string, zeitzone: string): string {
  return `${ortszeitAus(beginn, zeitzone).slice(11, 16)} Uhr`;
}

/** Tag und Monat für die Datumskachel – am Ortstag, nicht am UTC-Tag. */
export function kachelVon(beginn: string, zeitzone: string): { tag: string; monat: string } {
  return kachel(ortszeitAus(beginn, zeitzone).slice(0, 10));
}

/**
 * **Die festen Punkte** – Titel des Tagesordnungspunkts und was er tut. Die eine Stelle für Vorlagen-Fenster,
 * Werkzeugleiste und „/“-Menü (S2-3, S4-3a).
 */
export const FESTE_PUNKTE: Record<VerweisArt, { titel: string; hinweis: string }> = {
  'offene-aufgaben': {
    titel: 'Offene To-Dos',
    hinweis: 'Füllt sich selbst mit den offenen To-Dos der Gruppe.',
  },
  'letztes-protokoll': {
    titel: 'Protokoll der letzten Sitzung',
    hinweis: 'Zeigt das letzte Protokoll der Gruppe.',
  },
};

/** Was ein fester Punkt sagt, wenn er nichts anzeigen kann (ohne Sitzung dahinter) – Lese-Ansicht und Editor. */
export const VERWEIS_TEXT: Record<string, string> = {
  'offene-aufgaben': 'Hier stehen die offenen To-Dos der Gruppe.',
  'letztes-protokoll': 'Hier steht das Protokoll der letzten Sitzung.',
};
