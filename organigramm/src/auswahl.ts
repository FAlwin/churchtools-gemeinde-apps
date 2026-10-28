/**
 * **Was jede Person im Gerät gemerkt bekommt** (localStorage): welche Gruppentypen ausgeblendet sind (O2) und welche
 * Ansicht des Baums sie zuletzt gewählt hat (O7b). Ohne Speicher (privates Fenster, gesperrt) gilt die Vorgabe; Lesen
 * und Schreiben scheitern nie nach außen.
 */
const TYPEN = 'organigramm-ausgeblendete-typen';
const ANSICHT = 'organigramm-ansicht';

function lesen(schluessel: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(schluessel) ?? 'null') as unknown;
  } catch {
    return null;
  }
}

function merken(schluessel: string, wert: unknown): void {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // Ohne Speicher bleibt die Wahl bis zum Neuladen – mehr nicht.
  }
}

export function leseAusgeblendet(): Set<number> {
  const roh = lesen(TYPEN);
  return new Set(Array.isArray(roh) ? roh.filter((x): x is number => Number.isInteger(x)) : []);
}

export function merkeAusgeblendet(typen: ReadonlySet<number>): void {
  merken(TYPEN, [...typen]);
}

/** Die Ansichten des Reiters Organigramm (O7b): Karten wie bisher und die Liste. */
export const BAUM_ANSICHTEN = ['karten', 'liste'] as const;
export type BaumAnsicht = (typeof BAUM_ANSICHTEN)[number];

/** Die zuletzt gewählte Ansicht – `null`, wenn noch keine gewählt ist (dann entscheidet die Bildschirmbreite). */
export function leseAnsicht(): BaumAnsicht | null {
  const roh = lesen(ANSICHT);
  return BAUM_ANSICHTEN.find((a) => a === roh) ?? null;
}

export function merkeAnsicht(ansicht: BaumAnsicht): void {
  merken(ANSICHT, ansicht);
}
