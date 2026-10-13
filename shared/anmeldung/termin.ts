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

/** Wo das öffentliche Formular liegt (GitHub Pages des Projekts, Bauplan §2) – für alle Gemeinden gleich. */
export const FORMULAR_ADRESSE = 'https://falwin.github.io/churchtools-gemeinde-apps/';

function wanduhr(ms: number, zeitzone: string): number[] {
  const teile = new Intl.DateTimeFormat('en-US', {
    timeZone: zeitzone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(ms));
  const wert = (t: string) => Number(teile.find((p) => p.type === t)?.value);
  return [wert('year'), wert('month'), wert('day'), wert('hour'), wert('minute')];
}

const zwei = (n: number) => String(n).padStart(2, '0');

/** UTC-Zeitpunkt aus ChurchTools → Ortszeit `YYYY-MM-DDTHH:mm`. */
export function ortszeitAus(iso: string, zeitzone: string): string {
  const [j, m, t, h, mi] = wanduhr(Date.parse(iso), zeitzone);
  return `${j}-${zwei(m)}-${zwei(t)}T${zwei(h)}:${zwei(mi)}`;
}

/**
 * Ortszeit `YYYY-MM-DDTHH:mm` → UTC für ChurchTools (`…Z`). Der Abstand zur UTC wird am Zeitpunkt selbst
 * bestimmt (zweimal, damit ein Tag mit Zeitumstellung stimmt).
 */
export function utcAus(lokal: string, zeitzone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(lokal);
  if (!m) throw new Error(`Zeit „${lokal}“ hat nicht die Form JJJJ-MM-TTTHH:MM.`);
  const soll = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const abstand = (ms: number) => {
    const [j, mo, t, h, mi] = wanduhr(ms, zeitzone);
    return Date.UTC(j, mo - 1, t, h, mi) - ms;
  };
  let utc = soll - abstand(soll);
  utc = soll - abstand(utc);
  return new Date(utc).toISOString().replace('.000Z', 'Z');
}

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
