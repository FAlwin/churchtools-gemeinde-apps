import { createExtension } from '@blocknote/core';
import { punktEbene, stufeDerEbene, TIEFSTE_EBENE, type Block } from '@shared/protokolle/dokument';
import type { ProtokollEditor } from './editorSchema';

/**
 * **Einrücken und Ausrücken** (Bauplan K3b, Alwin 04.11.2026) – Tab/Umschalt+Tab und „Absatz ▾ → Einrücken/Ausrücken“
 * tun dasselbe:
 * - Ein **Tagesordnungspunkt** wird beim Einrücken zum **Unterpunkt** (4.1), ein Unterpunkt eine Ebene tiefer (4.1.1) –
 *   bis 4.1.1.1.1. Ausrücken geht den Weg zurück. Höchstens eine Ebene unter dem Punkt davor; der erste Punkt bleibt
 *   Punkt. Vorher hängte BlockNote einen eingerückten Punkt als Kind unter den Block davor: Er verlor seine Nummer, und
 *   was darunter stand, zählte plötzlich zum Punkt davor.
 * - **Alles andere** rückt ein wie bisher (Kind des Blocks davor) – seit K3b auch **mehrere markierte Zeilen** auf
 *   einmal. Vorher gab BlockNote Tab bei einer Markierung an seine eigene Formatleiste weiter, die wir gar nicht zeigen.
 * - In einer **Tabelle** bleibt Tab beim Springen zwischen den Zellen.
 */

/**
 * **Die neuen Ebenen der markierten Punkte** – nur, was sich ändert (Block-ID → Ebene). Gerechnet wird in der
 * Reihenfolge des Dokuments, damit mehrere markierte Punkte gemeinsam wandern (4.1 + 4.1.1 ausrücken → 5 + 5.1).
 */
export function ebenenNachRuecken(
  dokument: readonly Block[],
  markiert: ReadonlySet<string>,
  richtung: 1 | -1,
): Map<string, number> {
  const neu = new Map<string, number>();
  let davor: number | null = null;
  for (const b of dokument) {
    const ebene = punktEbene(b);
    if (ebene === null) continue;
    let jetzt = ebene;
    if (markiert.has(b.id)) {
      const ziel = ebene + richtung;
      const erlaubt =
        richtung < 0 ? ziel >= 0 : davor !== null && ziel <= davor + 1 && ziel <= TIEFSTE_EBENE;
      if (erlaubt) {
        neu.set(b.id, ziel);
        jetzt = ziel;
      }
    }
    davor = jetzt;
  }
  return neu;
}

type EditorBlock = ReturnType<ProtokollEditor['getTextCursorPosition']>['block'];

/** Die markierten Blöcke und die Punkte darunter – ein Punkt zählt nur auf oberster Ebene (wie in `ableiten`). */
function markierung(editor: ProtokollEditor): { bloecke: EditorBlock[]; punkte: Set<string> } {
  const bloecke = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
  const oben = new Set(editor.document.map((b) => b.id));
  const punkte = new Set(
    bloecke.filter((b) => oben.has(b.id) && punktEbene(b) !== null).map((b) => b.id),
  );
  return { bloecke, punkte };
}

const inTabelle = (bloecke: readonly EditorBlock[]): boolean =>
  bloecke.some((b) => b.type === 'table');

/** Geht Einrücken (`1`) bzw. Ausrücken (`-1`) hier? Für die Knöpfe unter „Absatz“. */
export function kannRuecken(editor: ProtokollEditor, richtung: 1 | -1): boolean {
  const { bloecke, punkte } = markierung(editor);
  if (inTabelle(bloecke)) return false;
  if (!punkte.size) return richtung > 0 ? editor.canNestBlock() : editor.canUnnestBlock();
  return (
    bloecke.length > punkte.size || ebenenNachRuecken(editor.document, punkte, richtung).size > 0
  );
}

function markieren(editor: ProtokollEditor, von: string, bis: string): void {
  if (von === bis) editor.setTextCursorPosition(von, 'end');
  else editor.setSelection(von, bis);
}

/**
 * **Einrücken (`1`) oder Ausrücken (`-1`)** – `false`, wenn Tab hier nicht uns gehört (Tabelle) oder BlockNote nichts
 * einrücken konnte; dann bleibt es beim Verhalten des Browsers.
 */
export function ruecken(editor: ProtokollEditor, richtung: 1 | -1): boolean {
  const { bloecke, punkte } = markierung(editor);
  if (inTabelle(bloecke)) return false;
  if (!punkte.size) {
    if (richtung > 0 ? !editor.canNestBlock() : !editor.canUnnestBlock()) return false;
    if (richtung > 0) editor.nestBlock();
    else editor.unnestBlock();
    return true;
  }

  const neu = ebenenNachRuecken(editor.document, punkte, richtung);
  editor.transact(() => {
    for (const [id, ebene] of neu)
      editor.updateBlock(id, {
        type: 'heading',
        props: { level: stufeDerEbene(ebene) },
      });
  });

  // Text in derselben Markierung rückt wie gewohnt – je zusammenhängendes Stück zwischen den Punkten.
  const stuecke: string[][] = [[]];
  for (const b of bloecke) {
    if (punkte.has(b.id)) stuecke.push([]);
    else stuecke[stuecke.length - 1].push(b.id);
  }
  const text = stuecke.filter((s) => s.length);
  if (!text.length) return true;
  for (const s of text) {
    markieren(editor, s[0], s[s.length - 1]);
    if (richtung > 0) editor.nestBlock();
    else editor.unnestBlock();
  }
  markieren(editor, bloecke[0].id, bloecke[bloecke.length - 1].id);
  return true;
}

/** Tab und Umschalt+Tab im Editor (hängt am Überschrift-Block, `editorSchema.ts`). */
export const einrueckenTasten = createExtension({
  key: 'protokoll-einruecken',
  keyboardShortcuts: {
    Tab: ({ editor }) => ruecken(editor as ProtokollEditor, 1),
    'Shift-Tab': ({ editor }) => ruecken(editor as ProtokollEditor, -1),
  },
});
