/**
 * **Termine zwischen ChurchTools und unseren Einstellungen** (A3, #486). ChurchTools rechnet in UTC
 * (`2026-11-14T08:30:00Z` = 9:30 Uhr in Deutschland, gemessen), unsere `TerminAngabe` in Ortszeit der
 * Gemeinde (`2026-11-14T09:30`) – so, wie es auf der Einladung steht. Hier wird umgerechnet, an EINER
 * Stelle, auch über die Zeitumstellung hinweg.
 *
 * Der Termin wird nicht mit der Gruppe verknüpft (A0 #4: Termin löschen löscht sonst die Anmeldungen).
 * Datum und Ort sind eine Kopie, `terminId` merkt sich die Herkunft.
 */
import type { OeffentlicheEinstellungen, TerminAngabe } from './formular';
import { datumText } from '../ct/datum';
import { ortszeitAus, utcAus } from '../ct/zeit';

// Die Umrechnung UTC ↔ Ortszeit steht für alle Apps in `shared/ct/zeit.ts` (Dienstplaner E3-2).
export { ortszeitAus, utcAus };

/** Was wir von einem ChurchTools-Termin brauchen (`base` aus `/calendars/appointments`, gemessen). */
export interface CtTermin {
  id: number;
  title?: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  address?: { name?: string | null; city?: string | null } | null;
}

/** Ein ChurchTools-Termin als Kopie für unsere Einstellungen. Ganztägig: von 0:00 bis 23:59. */
export function terminAusCt(
  t: CtTermin,
  zeitzone: string,
  kalenderId?: number | null,
): TerminAngabe {
  const nurTag = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const beginn = nurTag(t.startDate) ? `${t.startDate}T00:00` : ortszeitAus(t.startDate, zeitzone);
  const ende = nurTag(t.endDate) ? `${t.endDate}T23:59` : ortszeitAus(t.endDate, zeitzone);
  const ort = [t.address?.name, t.address?.city]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(', ');
  return {
    beginn,
    ende: ende === beginn ? null : ende,
    ort,
    terminId: t.id,
    ...(kalenderId ? { kalenderId } : {}),
  };
}

/**
 * **Der Link zur Anmeldung**: Formular-Seite der Gemeinde + Instanz + Gruppe. Die Formular-Seite legt jede Gemeinde
 * selbst auf ihren Webspace (Alwin, 14.10.2026: „Voraussetzung für diese Extension – auf keinen Fall soll unsere
 * Domain da sichtbar werden“); die Adresse steht in den Einstellungen der Gemeinde (`formularAdresseAus`).
 */
export function anmeldeLink(formularAdresse: string, ctBasis: string, gruppeId: number): string {
  return `${formularAdresse}#${new URL(ctBasis).host}/${gruppeId}`;
}

/**
 * **Termin in einer Zeile** – „Sa, 21.11.2026 · Gemeindehaus“ (mehrtägig mit „–“), sonst „Termin folgt“. So steht er im
 * Formular und auf dem Aushang (A8-4).
 */
export function terminZeile(e: Pick<OeffentlicheEinstellungen, 'termin'>): string {
  const t = e.termin;
  return t
    ? `${datumText(t.beginn.slice(0, 10))}${t.ende && t.ende.slice(0, 10) !== t.beginn.slice(0, 10) ? ` – ${datumText(t.ende.slice(0, 10))}` : ''}${t.ort ? ` · ${t.ort}` : ''}`
    : 'Termin folgt';
}
