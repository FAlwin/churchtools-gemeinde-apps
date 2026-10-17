/**
 * Vorlauf vor dem Beginn der Veranstaltung (#423) – die zwei Regeln, die Ansicht und Bearbeiten-Liste
 * teilen.
 *
 * ChurchTools kennt keinen Vorlauf pro Punkt, sondern eine **Grenze** am Ablauf: Alles davor läuft vor
 * dem Beginn (Soundcheck, Gebet) und wird rückwärts gerechnet. Der Server liefert sie als `vorBeginn`
 * je Punkt; die Vorlauf-Punkte stehen immer oben am Stück.
 */
import type { AgendaItem } from '@shared/types/index';

// `beginnStelle` (wo die Linie „Beginn“ steht) liegt seit E6-1a in `@shared/ct/ablaufZeile` – der Dienstplaner braucht
// sie auch.

/**
 * Der Vorlauf nach dem Umsortieren – so, wie ChurchTools ihn danach rechnen wird.
 *
 * Die Grenze ist in ChurchTools eine **Platznummer** (gemessen 05.10.2026): Umsortieren lässt sie
 * stehen, ein über die Grenze geschobener Punkt wechselt die Seite. Die Liste übernimmt das sofort,
 * statt die Linie mit dem verschobenen Punkt wandern zu lassen und nach dem Neuladen umzuspringen.
 */
export function vorlaufNachUmsortieren(
  vorher: readonly AgendaItem[],
  nachher: AgendaItem[],
): AgendaItem[] {
  const anzahl = vorher.filter((i) => i.vorBeginn).length;
  return nachher.map((item, i) => {
    const vorBeginn = i < anzahl;
    return item.vorBeginn === vorBeginn ? item : { ...item, vorBeginn };
  });
}
