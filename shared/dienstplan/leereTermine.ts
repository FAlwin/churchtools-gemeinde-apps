/**
 * **Termine ohne sichtbaren Platz** (Jugend-Fund, 27.11.2026).
 *
 * Gemessen am 27.11.2026 in der Test-Instanz: Wer eine Dienstgruppe nicht sehen darf (Dienstkategorie nicht „für alle
 * sichtbar“, `viewAll: false`), bekommt ein Event von `/events?include=eventServices` trotzdem – aber mit
 * `eventServices: []`; eigene Einträge kämen mit. Liegt das Event im öffentlichen Gemeindekalender, sähen alle den
 * Termin: als „Als Nächstes“, als leere Spalte in Planen, in Dienste und Verfügbarkeit.
 *
 * **Regel:** Ein Termin, für den ChurchTools keinen einzigen gültigen Platz liefert, wird nicht gezeigt – außer für
 * Menschen, die alle Dienstgruppen sehen (`siehtAlleDienstgruppen`): Für sie ist ein leerer Termin wirklich leer, und
 * dort lassen sich in Planen Dienste einschalten. Ein ungültiger Platz (`isValid: false`) zählt wie überall nicht.
 */
import type { RohTermin } from './termine';

/** Hat der Termin mindestens einen gültigen Platz? */
export function hatSichtbarenPlatz(t: Pick<RohTermin, 'eventServices'>): boolean {
  return (t.eventServices ?? []).some((p) => p.isValid !== false);
}

/**
 * Die Termine, die man sehen darf: mit Platz – oder alle, wenn man alle Dienstgruppen sieht.
 * Nur für Zeiträume (Liste, Matrix, Verfügbarkeit); ein einzelner, per Link geöffneter Termin bleibt wie er ist.
 */
export function ohneLeereTermine<T extends Pick<RohTermin, 'eventServices'>>(
  roh: readonly T[],
  siehtAlle: boolean,
): T[] {
  return siehtAlle ? [...roh] : roh.filter(hatSichtbarenPlatz);
}
