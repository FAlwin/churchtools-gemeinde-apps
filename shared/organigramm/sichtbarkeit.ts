/**
 * **Was das Organigramm zeigt – für alle** (Bauplan O7b-7, Entwurf `o7b-6-7-v1.html`, entschieden 29.10.2026):
 * Gruppen-Admins blenden Gruppentypen und einzelne Gruppen für alle aus, im Reiter, in der Präsentation und in der PDF.
 * Eine ausgeblendete Gruppe (oder ein Typ) nimmt alles mit, was darunter hängt. Seit 30.10.2026 der einzige Weg – die
 * Typ-Schildchen je Gerät sind weg. In ChurchTools selbst ändert sich nichts.
 *
 * Gespeichert wird nur, WAS ausgeblendet ist (IDs); Gruppen und Typen, die es nicht mehr gibt, stören nicht.
 */
export const SICHT_ART = { art: 'organigramm-sichtbar', fassung: 1 };

export interface Sichtbarkeit {
  /** Für alle ausgeblendete Gruppentypen. */
  typen: number[];
  /** Für alle ausgeblendete Gruppen – samt ihren Untergruppen. */
  gruppen: number[];
}

export const ALLES_SICHTBAR: Sichtbarkeit = { typen: [], gruppen: [] };

const ids = (x: unknown): number[] | null =>
  Array.isArray(x) && x.every((n) => Number.isInteger(n) && (n as number) > 0)
    ? [...new Set(x as number[])].sort((a, b) => a - b)
    : null;

/** Ein gespeicherter Wert – `null`, wenn er nicht dieses Format hat. */
export function sichtbarkeitAus(roh: unknown): Sichtbarkeit | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  const typen = ids(r.typen);
  const gruppen = ids(r.gruppen);
  return typen && gruppen ? { typen, gruppen } : null;
}

/** Ist überhaupt etwas für alle ausgeblendet? */
export const etwasAusgeblendet = (s: Sichtbarkeit) => s.typen.length > 0 || s.gruppen.length > 0;
