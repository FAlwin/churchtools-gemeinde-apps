/**
 * **Anfrage oder direkt – die Vorgabe je Dienst** (Wunsch 2, Scheibe P2m, Entwurf `e9-p2-modus.html`, Variante G4):
 * Ob ein **neuer** Entwurf als Anfrage oder gleich „direkt“ (ohne Rückfrage als zugesagt) entsteht, legt man je Dienst
 * fest – gemerkt je Gerät (`planenAnsicht.ts`, Feld `direktDienste`). Nur Rechnen; die Oberfläche steht in
 * `VorgabeFach.tsx` und am Dienstnamen der Matrix.
 *
 * Es ist **keine neue Regel für Entwürfe**: `Entwurf.modus` gibt es seit E4-4, das Entwurfs-Fach schaltet ihn um. Neu ist
 * nur, womit ein neuer Entwurf beginnt. Bestehende Entwürfe bleiben, wie sie sind.
 */
import type { Entwurf } from './entwuerfe';

export type Modus = Entwurf['modus'];

/** Womit ein neuer Entwurf an diesem Dienst beginnt – ohne Eintrag die Anfrage (der Normalfall). */
export const modusFuerDienst = (direktDienste: readonly number[], dienstId: number): Modus =>
  direktDienste.includes(dienstId) ? 'direkt' : 'anfrage';

/** Die Vorgabe eines Dienstes setzen – die Liste hält nur die direkten Dienste, ohne Doppelte. */
export function vorgabeSetzen(
  direktDienste: readonly number[],
  dienstId: number,
  modus: Modus,
): number[] {
  const ohne = direktDienste.filter((id) => id !== dienstId);
  return modus === 'direkt' ? [...ohne, dienstId] : ohne;
}

/** Dieselbe Vorgabe für alle genannten Dienste („Für alle Dienste übernehmen“). */
export function vorgabeFuerAlle(
  direktDienste: readonly number[],
  dienstIds: readonly number[],
  modus: Modus,
): number[] {
  const ohne = direktDienste.filter((id) => !dienstIds.includes(id));
  return modus === 'direkt' ? [...ohne, ...new Set(dienstIds)] : ohne;
}

/** „Anfrage“ bzw. „direkt“ – das Wort für Tooltips, Fenster und Meldungen (**eine** Schreibweise). */
export const modusWort = (modus: Modus): string => (modus === 'direkt' ? 'direkt' : 'Anfrage');

/** Tooltip und Name des Symbols am Dienstnamen: „Neue Einteilungen für Ton: Anfrage – ändern“. */
export const vorgabeText = (dienst: string, modus: Modus): string =>
  `Neue Einteilungen für ${dienst}: ${modusWort(modus)} – ändern`;
