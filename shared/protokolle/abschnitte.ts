/**
 * **Abschnitte im Protokoll verschieben** (Bauplan S4-3b, Entwurf 7) – die Regel ohne Editor, getestet. Gerechnet wird
 * in einer Liste von Geschwistern (die oberste Ebene des Dokuments oder die Unterpunkte eines Blocks); eingerückte
 * Unterpunkte wandern mit ihrem Block ohnehin mit.
 *
 * Entschieden 28.10.2026 (Alwin):
 * - Eine **Überschrift nimmt ihren Abschnitt mit** – alles bis zur nächsten Überschrift gleicher oder höherer Stufe
 *   (Überschrift 1 = Tagesordnungspunkt bis zum nächsten Tagesordnungspunkt; 2 und 3 nach derselben Regel).
 * - **Abgelegt wird nur an Abschnittsgrenzen:** Fällt ein Abschnitt mitten in einen anderen, rückt er an die nächste
 *   Grenze – ein anderer Punkt wird nie zerschnitten.
 * - **„Nach oben“ / „Nach unten“** springt um einen ganzen Abschnitt derselben Stufe, nie über die übergeordnete
 *   Überschrift hinaus.
 *
 * Stellen sind Einfügestellen in der Geschwisterliste: `p` heißt „vor dem Block an Index `p`“, `length` = ans Ende.
 */
import type { Block } from './dokument';

/** Stufe einer Überschrift (1–3), sonst `null`. */
export function ueberschriftStufe(b: Block | undefined): number | null {
  if (b?.type !== 'heading') return null;
  const n = Number(b.props?.level ?? 1);
  return Number.isFinite(n) ? n : 1;
}

/** Ende (ausschließlich) des Abschnitts ab Index `start` – ohne Überschrift ist es nur der Block selbst. */
export function abschnittEnde(geschwister: readonly Block[], start: number): number {
  const stufe = ueberschriftStufe(geschwister[start]);
  if (stufe === null) return start + 1;
  let i = start + 1;
  while (i < geschwister.length) {
    const s = ueberschriftStufe(geschwister[i]);
    if (s !== null && s <= stufe) break;
    i++;
  }
  return i;
}

/**
 * **Wohin ein gezogener Abschnitt fällt.** `ziel` ist die Stelle, an der losgelassen wurde; sie rückt an die nächste
 * Grenze – vor eine Überschrift gleicher oder höherer Stufe oder ans Ende (bei gleichem Abstand nach oben). `null`: Der
 * Abschnitt bleibt, wo er ist (losgelassen auf sich selbst oder an seinen eigenen Rändern), oder es ist keine Überschrift.
 */
export function ablegeStelle(
  geschwister: readonly Block[],
  start: number,
  ziel: number,
): number | null {
  const stufe = ueberschriftStufe(geschwister[start]);
  if (stufe === null) return null;
  const ende = abschnittEnde(geschwister, start);
  let beste: number | null = null;
  for (let p = 0; p <= geschwister.length; p++) {
    const s = p === geschwister.length ? 0 : ueberschriftStufe(geschwister[p]);
    if (s === null || s > stufe) continue;
    if (beste === null || Math.abs(p - ziel) < Math.abs(beste - ziel)) beste = p;
  }
  // Die nächste Grenze ist der eigene Rand – auch immer dann, wenn auf dem Abschnitt selbst losgelassen wurde (in ihm
  // gibt es keine Grenze): nichts bewegt sich.
  return beste === null || beste === start || beste === ende ? null : beste;
}

/**
 * **Wohin „Nach oben“ / „Nach unten“ führt** – vor den vorigen bzw. hinter den nächsten Abschnitt derselben Stufe.
 * `null`, wenn es keinen gibt (oben die übergeordnete Überschrift oder nur Text davor, unten Ende oder übergeordnete).
 */
export function nachbarStelle(
  geschwister: readonly Block[],
  start: number,
  richtung: 'hoch' | 'runter',
): number | null {
  const stufe = ueberschriftStufe(geschwister[start]);
  if (stufe === null) return null;
  if (richtung === 'hoch') {
    for (let j = start - 1; j >= 0; j--) {
      const s = ueberschriftStufe(geschwister[j]);
      if (s === null || s > stufe) continue;
      return s === stufe ? j : null;
    }
    return null;
  }
  const ende = abschnittEnde(geschwister, start);
  return ueberschriftStufe(geschwister[ende]) === stufe ? abschnittEnde(geschwister, ende) : null;
}

/** Die Geschwister mit dem Abschnitt ab `start` an der Stelle `stelle` (wie oben, in der alten Zählung). */
export function abschnittVerschoben<T extends Block>(
  geschwister: readonly T[],
  start: number,
  stelle: number,
): T[] {
  const ende = abschnittEnde(geschwister, start);
  const teil = geschwister.slice(start, ende);
  const rest = [...geschwister.slice(0, start), ...geschwister.slice(ende)];
  const ziel = stelle > start ? stelle - teil.length : stelle;
  return [...rest.slice(0, ziel), ...teil, ...rest.slice(ziel)];
}
