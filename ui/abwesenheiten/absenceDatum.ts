import type { Absence, AbsenceEvent } from '@shared/types/index';
import { decktTermin } from '@shared/absences/index';
import { wochentagKurz } from '@shared/ct/wochen';
import { heuteImKalender, uhrText } from '@shared/ct/zeit';

/**
 * Datums-Helfer für die Verfügbarkeit (#177). Alles rein und ohne Zeitzone: Die Tage kommen als
 * `YYYY-MM-DD` aus ChurchTools und werden als solche verglichen – ein `new Date('2026-10-04')` wäre
 * UTC-Mitternacht und in Deutschland der Vorabend.
 */

/**
 * Die Abwesenheit, die **diesen Termin** abdeckt – ein Eintrag mit Uhrzeit zuerst: Er gehört genau zu diesem Termin
 * (ein Haken trägt sein Zeitfenster ein), und „Haken weg“ soll ihn treffen, nicht den ganztägigen Urlaub daneben. Bis
 * zum 04.11.2026 entschied das Kennzeichen „[Musikteam]“ (eigene zuerst); das gibt es nicht mehr (Dienstplaner E7-2).
 *
 * Bis zum 22.09.2026 fragte die Seite nach dem **Tag**. Damit hingen zwei Termine am selben Tag
 * zusammen, und Alwin konnte sich nicht für den Vormittag abmelden und für den Nachmittag zusagen.
 * Welche Abwesenheit einen Termin abdeckt, entscheidet jetzt `decktTermin` (in `@shared/absences`,
 * weil der Server dieselbe Regel für die Doppel-Erkennung braucht).
 */
export function abwesenheitFuerTermin(alle: Absence[], ev: AbsenceEvent): Absence | undefined {
  return (
    alle.find((a) => !!a.startTime && decktTermin(a, ev)) ?? alle.find((a) => decktTermin(a, ev))
  );
}

/**
 * `2026-10-04` → „So, 04.10." – ohne Jahr, wenn es das laufende ist.
 *
 * Den Wochentag rechnet `wochentagKurz` aus `./wochen` – dort steht das eine UTC-Parsen von
 * `YYYY-MM-DD`. Hier stand bis zum 18.09.2026 eine zweite Fassung samt eigener Wochentagsliste
 * (gefunden bei der Dopplungs-Suche im `/festhalten`). Tag, Monat und Jahr kommen als Text direkt
 * aus dem ISO-String – zweistellig sind sie dort schon.
 */
export function tagKurz(iso: string, heute = new Date()): string {
  const jahr = iso.slice(0, 4) === heuteImKalender(heute).slice(0, 4) ? '' : iso.slice(0, 4);
  return `${wochentagKurz(iso)}, ${iso.slice(8, 10)}.${iso.slice(5, 7)}.${jahr}`;
}

/** `2026-10-04` → „Sonntag" – für die Unterzeile einer Terminzeile (UTC-Parsen wie überall hier). */
export function wochentagLang(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    timeZone: 'UTC',
  });
}

/** Zeitraum lesbar: ein Tag → „So, 04.10."; mehrere → „Sa, 03.10. – So, 11.10.". */
export function zeitraumKurz(
  a: Pick<Absence, 'startDate' | 'endDate'>,
  heute = new Date(),
): string {
  return a.startDate === a.endDate
    ? tagKurz(a.startDate, heute)
    : `${tagKurz(a.startDate, heute)} – ${tagKurz(a.endDate, heute)}`;
}

/** Uhrzeit aus einem ISO-Zeitpunkt in der Uhr der Gemeinde – „10:00" (#847; vorher die des Geräts). */
export function uhrzeit(isoZeitpunkt: string): string {
  return uhrText(isoZeitpunkt);
}

/**
 * Das Zeitfenster lesbar – „10:00 – 11:30" – oder `null` bei ganztägig (22.09.2026).
 *
 * Ohne diese Zeile sähen zwei Einträge am selben Tag in der Liste „Einträge" gleich aus; seit ein
 * Haken das Zeitfenster des Termins einträgt, kann genau das vorkommen.
 */
export function zeitfensterKurz(a: Pick<Absence, 'startTime' | 'endTime'>): string | null {
  if (!a.startTime || !a.endTime) return null;
  const von = uhrzeit(a.startTime);
  const bis = uhrzeit(a.endTime);
  return von && bis ? `${von} – ${bis}` : null;
}
