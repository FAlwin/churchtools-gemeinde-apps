/**
 * **Die freie Antwort** (Etappe F3, Klick-Runde 9 am 16.11.2026, Entwurf `f3-freie-antwort-v1`) – die letzte Antwort
 * einer Auswahl mit eigener Beschriftung („Andere Gemeinde“, vorbelegt „Sonstiges“) und, je nach Frage, einem
 * Textfeld. Die EINE Stelle für die Regeln dazu – ohne Werte aus `formular.ts` und `bedingungen.ts`, die beide
 * hierher schauen (sonst entstünde ein Ring).
 *
 * - Gewählt wird sie wie jede Antwort: Der Wert der Frage ist ihre Beschriftung (bei Mehrfachauswahl ein Eintrag der
 *   Liste). In ChurchTools ist sie eine normale Antwort der Auswahl.
 * - Der eingetippte Text steht in den Antworten unter `<Feld-ID>.frei` und in ChurchTools in einer zweiten Spalte
 *   („Frage (Beschriftung)“, `ctZusatzSpalten`) – unter demselben Schlüssel in `ctFelder`.
 * - Angezeigt wird in der Erweiterung nur der Text, wie eine eigene Antwort („FeG Siegburg“); ohne Text die
 *   Beschriftung (Alwin, 16.11.2026).
 */
import type { Antwort, Feld } from './formular';

/** Die Beschriftung, mit der die freie Antwort beginnt. */
export const FREI_STANDARD = 'Sonstiges';

/** Fragetypen mit freier Antwort (Klick-Runde 9: auch Ja / Nein). */
const MIT_FREI = new Set<Feld['typ']>(['radio', 'select', 'multi', 'janein']);

/** Kann diese Frage eine freie Antwort haben? */
export function kannFrei(x: Feld): boolean {
  return MIT_FREI.has(x.typ);
}

/** Wo der Text steht – in den Antworten und in `ctFelder` (die zweite Spalte). */
export function freiSchluessel(feldId: string): string {
  return `${feldId}.frei`;
}

/** Hat die Frage eine freie Antwort (bei einem Typ, der sie kennt)? Dann ihre Beschriftung. */
export function freiName(x: Feld): string | null {
  return x.frei && kannFrei(x) ? x.frei.name : null;
}

/** Hat die freie Antwort ein Textfeld („klappt auf“ oder „steht immer da“)? Nur dann gibt es die zweite Spalte. */
export function freiMitText(x: Feld): boolean {
  return freiName(x) !== null && x.frei?.textfeld !== 'ohne';
}

/** Ist die freie Antwort gewählt? `w` = der Wert der Frage (Text oder, bei Mehrfachauswahl, Liste). */
export function freiGewaehlt(x: Feld, w: Antwort): boolean {
  const name = freiName(x);
  if (name === null) return false;
  return Array.isArray(w) ? w.includes(name) : w === name;
}

/** Der eingetippte Text – `''`, wenn keiner da ist. */
export function freiText(alle: Record<string, Antwort>, feldId: string): string {
  const t = alle[freiSchluessel(feldId)];
  return typeof t === 'string' ? t.trim() : '';
}

/**
 * **Wie eine gewählte Antwort angezeigt wird** – die freie mit Text als dieser Text, sonst die Antwort selbst. Die EINE
 * Stelle für Tabelle, Druckliste und „Anmeldung ansehen“.
 */
export function freiAnzeige(x: Feld, antwort: string, text: string | null | undefined): string {
  return antwort === freiName(x) && freiMitText(x) && text?.trim() ? text.trim() : antwort;
}
