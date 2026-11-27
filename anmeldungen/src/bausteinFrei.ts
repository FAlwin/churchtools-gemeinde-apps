import type { Feldtyp } from '@shared/anmeldung/formular';

/**
 * **Bausteine, die noch nicht für alle da sind** (F6a, Entwicklung in Scheiben): „Liste mit Zeilen“ lässt sich anlegen,
 * bearbeiten und in der Vorschau ansehen – abschicken kann das Formular sie aber erst mit F6b. Bis dahin gibt es sie nur
 * in der Entwicklung (Demo, `npm run dev`), nicht in der gebauten Erweiterung (Test-ZIP, Release). Mit F6b fällt der
 * Eintrag hier weg. Die EINE Stelle für Kachel und Fragetyp-Wahl.
 */
const NOCH_NICHT_FREI = new Set<Feldtyp>(['liste']);

export function bausteinFrei(typ: Feldtyp, entwicklung: boolean = import.meta.env.DEV): boolean {
  return entwicklung || !NOCH_NICHT_FREI.has(typ);
}
