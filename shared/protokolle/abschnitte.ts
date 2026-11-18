/**
 * **Abschnitte im Protokoll** (Bauplan S4-3b, Entwurf 7; seit W7 nur noch für „Punkte ordnen“) – die Regel ohne Editor,
 * getestet. Gerechnet wird in einer Liste von Geschwistern (die oberste Ebene des Dokuments); eingerückte Unterblöcke
 * wandern mit ihrem Block ohnehin mit. Bis W7 zog man Abschnitte am Griff im Text und schob sie im Griff-Menü; das
 * Fenster „Punkte ordnen“ (`gliederung.ts`) baut auf denselben Funktionen auf.
 *
 * Entschieden 28.10.2026 (Alwin):
 * - Eine **Überschrift nimmt ihren Abschnitt mit** – alles bis zur nächsten Überschrift gleicher oder höherer Stufe
 *   (Tagesordnungspunkt bis zum nächsten Tagesordnungspunkt; Unterpunkte und „Überschrift“ nach derselben Regel).
 *   Seit K3b zählt der Rang, nicht die gespeicherte Stufe: Punkt › Unterpunkt 4.1 › … › 4.1.1.1.1 › „Überschrift“ –
 *   eine „Überschrift“ (Stufe 3) zerschneidet also nie einen Unterpunkt 4.1.1 (Stufe 4).
 * - **Abgelegt wird nur an Abschnittsgrenzen**, ein anderer Punkt wird nie zerschnitten.
 *
 * Stellen sind Einfügestellen in der Geschwisterliste: `p` heißt „vor dem Block an Index `p`“, `length` = ans Ende.
 */
import { punktEbene, TIEFSTE_EBENE, type Block } from './dokument';

/** Rang einer Überschrift (1 = Tagesordnungspunkt, 2–5 = Unterpunkt, 6 = „Überschrift“), sonst `null`. */
export function ueberschriftStufe(b: Block | undefined): number | null {
  if (b?.type !== 'heading') return null;
  const ebene = punktEbene(b);
  return ebene === null ? TIEFSTE_EBENE + 2 : ebene + 1;
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
