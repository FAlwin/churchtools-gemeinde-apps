/**
 * **Welche Gruppentypen ausgeblendet sind** – pro Gerät gemerkt (localStorage). Ohne Speicher (privates Fenster,
 * gesperrt) gilt einfach „alles zeigen“; Lesen und Schreiben scheitern nie nach außen.
 */
const SCHLUESSEL = 'organigramm-ausgeblendete-typen';

export function leseAusgeblendet(): Set<number> {
  try {
    const roh: unknown = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '[]');
    return new Set(Array.isArray(roh) ? roh.filter((x): x is number => Number.isInteger(x)) : []);
  } catch {
    return new Set();
  }
}

export function merkeAusgeblendet(typen: ReadonlySet<number>): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify([...typen]));
  } catch {
    // Ohne Speicher bleibt die Wahl bis zum Neuladen – mehr nicht.
  }
}
