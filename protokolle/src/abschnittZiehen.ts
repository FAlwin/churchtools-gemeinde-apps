import type { Block } from '@shared/protokolle/dokument';
import {
  ablegeStelle,
  abschnittEnde,
  nachbarStelle,
  ueberschriftStufe,
} from '@shared/protokolle/abschnitte';
import type { ProtokollEditor } from './editorSchema';

/**
 * **Abschnitte im Editor verschieben** (Bauplan S4-3b) – die Regel `@shared/protokolle/abschnitte` am BlockNote-Editor.
 *
 * - **Ziehen:** Beginnt man am Griff einer Überschrift zu ziehen, merkt sich `abschnittZiehenBeginnt` die Überschrift und
 *   markiert ihren Abschnitt – so zeigt BlockNote beim Ziehen den ganzen Abschnitt. Beim Loslassen übernimmt
 *   `abschnittAblegen` (statt BlockNote): Die Stelle rückt an die nächste Abschnittsgrenze (`ablegeStelle`).
 * - **„Nach oben“ / „Nach unten“** im Griff-Menü: `abschnittSchieben` (`nachbarStelle`) – der Weg am Handy.
 *
 * Verschoben wird in einem Schritt (`transact`): einmal „Rückgängig“ holt alles zurück. Die Blöcke behalten ihre IDs –
 * auch Aufgaben, deren To-Dos daran hängen.
 */

type Richtung = 'hoch' | 'runter';

/** Die Geschwister eines Blocks: die oberste Ebene oder die Unterpunkte seines Elternblocks. */
function geschwister(editor: ProtokollEditor, id: string): Block[] {
  const eltern = editor.getParentBlock(id);
  return eltern ? eltern.children : editor.document;
}

/** Den Abschnitt der Überschrift `id` an `stelle` setzen (Einfügestelle in der alten Zählung). */
function abschnittSetzen(
  editor: ProtokollEditor,
  g: readonly Block[],
  start: number,
  stelle: number,
): void {
  const ende = abschnittEnde(g, start);
  const teil = g.slice(start, ende);
  type Teil = Parameters<ProtokollEditor['insertBlocks']>[0];
  editor.transact(() => {
    editor.removeBlocks(teil.map((b) => b.id));
    if (stelle < g.length) editor.insertBlocks(teil as Teil, g[stelle].id, 'before');
    else editor.insertBlocks(teil as Teil, g[g.length - 1].id, 'after');
  });
  editor.setTextCursorPosition(teil[0].id, 'start');
}

/** Gibt es in diese Richtung einen Abschnitt derselben Stufe? (Sonst fehlt der Eintrag im Griff-Menü.) */
export function kannSchieben(editor: ProtokollEditor, id: string, richtung: Richtung): boolean {
  const g = geschwister(editor, id);
  return (
    nachbarStelle(
      g,
      g.findIndex((b) => b.id === id),
      richtung,
    ) !== null
  );
}

/** „Nach oben“ / „Nach unten“: um einen ganzen Abschnitt derselben Stufe. `false`, wenn es nicht geht. */
export function abschnittSchieben(
  editor: ProtokollEditor,
  id: string,
  richtung: Richtung,
): boolean {
  const g = geschwister(editor, id);
  const start = g.findIndex((b) => b.id === id);
  const stelle = nachbarStelle(g, start, richtung);
  if (stelle === null) return false;
  abschnittSetzen(editor, g, start, stelle);
  return true;
}

/** Welche Überschrift gerade gezogen wird – je Editor. */
const ziehend = new WeakMap<ProtokollEditor, string>();

/**
 * Am Griff beginnt jemand zu ziehen. Bei einer Überschrift: merken und den Abschnitt markieren, damit BlockNote ihn als
 * Ganzes zeigt (es zieht alle markierten Blöcke). Markiert wird bis zum letzten Block mit Text – ein fester Punkt am Ende
 * fehlt dann nur im Bild, verschoben wird er trotzdem.
 */
export function abschnittZiehenBeginnt(editor: ProtokollEditor, id: string): void {
  ziehend.delete(editor);
  const g = geschwister(editor, id);
  const start = g.findIndex((b) => b.id === id);
  if (ueberschriftStufe(g[start]) === null) return;
  ziehend.set(editor, id);
  const teil = g.slice(start, abschnittEnde(g, start));
  const letzter = [...teil].reverse().find((b) => Array.isArray(b.content));
  if (!letzter || letzter.id === id) return;
  try {
    editor.setSelection(id, letzter.id);
  } catch {
    // Nur fürs Bild beim Ziehen – ohne Markierung zieht BlockNote die Überschrift allein, abgelegt wird trotzdem alles.
  }
}

/**
 * Die Markierung fürs Bild beim Ziehen wieder aufheben – vor dem Verschieben, damit „Rückgängig“ sie nicht zurückholt
 * (beim Durchklicken 28.10.2026 gefunden: Zog man danach einen Block darin, zog BlockNote die ganze, kaum sichtbare
 * Markierung mit).
 */
function markierungAufheben(editor: ProtokollEditor, id: string): void {
  try {
    editor.setTextCursorPosition(id, 'start');
  } catch {
    // Den Block gibt es nicht mehr – dann gibt es auch nichts aufzuheben.
  }
}

/** Das Ziehen ist vorbei. Abgebrochen (ohne Loslassen im Blatt): nur die Markierung aufheben. */
export function abschnittZiehenEndet(editor: ProtokollEditor): void {
  const id = ziehend.get(editor);
  ziehend.delete(editor);
  if (id) markierungAufheben(editor, id);
}

/**
 * **Loslassen** an der Höhe `y` (Bildschirm): `true`, wenn ein Abschnitt gezogen wurde – dann hat diese Funktion ihn
 * gesetzt (oder bewusst stehen lassen), und BlockNote darf nichts mehr tun. Die Stelle ergibt sich aus der Höhe: vor dem
 * ersten Geschwister, dessen Mitte unter `y` liegt. `rechteck` liefert die Lage eines Blocks auf dem Bildschirm.
 */
export function abschnittAblegen(
  editor: ProtokollEditor,
  y: number,
  rechteck: (id: string) => { top: number; bottom: number } | null,
): boolean {
  const id = ziehend.get(editor);
  if (!id) return false;
  ziehend.delete(editor);
  markierungAufheben(editor, id);
  const g = geschwister(editor, id);
  const start = g.findIndex((b) => b.id === id);
  if (start < 0) return true;
  let ziel = 0;
  for (const b of g) {
    const r = rechteck(b.id);
    if (!r || (r.top + r.bottom) / 2 >= y) break;
    ziel++;
  }
  const stelle = ablegeStelle(g, start, ziel);
  if (stelle !== null) abschnittSetzen(editor, g, start, stelle);
  return true;
}
