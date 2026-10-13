/**
 * **Termine zwischen ChurchTools und unseren Einstellungen** (A3, #486). ChurchTools rechnet in UTC
 * (`2026-11-14T08:30:00Z` = 9:30 Uhr in Deutschland, gemessen), unsere `TerminAngabe` in Ortszeit der
 * Gemeinde (`2026-11-14T09:30`) – so, wie es auf der Einladung steht. Hier wird umgerechnet, an EINER
 * Stelle, auch über die Zeitumstellung hinweg.
 *
 * Der Termin wird nicht mit der Gruppe verknüpft (A0 #4: Termin löschen löscht sonst die Anmeldungen).
 * Datum und Ort sind eine Kopie, `terminId` merkt sich die Herkunft.
 */
import type { TerminAngabe } from './formular';
import { ortszeitAus, utcAus } from '../ct/zeit';

/** Wo das öffentliche Formular liegt (GitHub Pages des Projekts, Bauplan §2) – für alle Gemeinden gleich. */
export const FORMULAR_ADRESSE = 'https://falwin.github.io/churchtools-gemeinde-apps/';

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
export function terminAusCt(t: CtTermin, zeitzone: string): TerminAngabe {
  const nurTag = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const beginn = nurTag(t.startDate) ? `${t.startDate}T00:00` : ortszeitAus(t.startDate, zeitzone);
  const ende = nurTag(t.endDate) ? `${t.endDate}T23:59` : ortszeitAus(t.endDate, zeitzone);
  const ort = [t.address?.name, t.address?.city]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
    .join(', ');
  return { beginn, ende: ende === beginn ? null : ende, ort, terminId: t.id };
}

/** Der Link zur Anmeldung, wie er in einem neu angelegten Termin steht: Formular + Instanz + Gruppe. */
export function anmeldeLink(ctBasis: string, gruppeId: number): string {
  return `${FORMULAR_ADRESSE}#${new URL(ctBasis).host}/${gruppeId}`;
}
