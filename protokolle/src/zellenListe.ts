import { createExtension } from '@blocknote/core';
import { Plugin, TextSelection, type EditorState } from 'prosemirror-state';
import {
  enterInZelle,
  wirdZuPunkt,
  zeileVorCursor,
  ZELLEN_PUNKT,
} from '@shared/protokolle/zellenListe';
import type { ProtokollEditor } from './editorSchema';

/**
 * **Aufzählungen in Tabellenzellen** (W11, Alwin 21.11.2026) – die Tasten zur Regel in `shared/protokolle/zellenListe.ts`:
 * - „- “ oder „* “ am Zeilenanfang einer Zelle (Zellanfang oder nach einem Zeilenumbruch) wird „• “. „1. “ bleibt, wie getippt.
 * - **Enter** in einer Zeile mit „• “ bzw. „N. “: neuer Zeilenumbruch in DERSELBEN Zelle, davor „• “ bzw. „N+1. “.
 *   Auf einer leeren Aufzählungszeile nimmt Enter die Marke weg und beendet die Aufzählung.
 *
 * Gemessen (BlockNote 0.56, `TableExtension.ts`): Enter springt sonst in die Zelle darunter, Umschalt+Enter fügt einen
 * Zeilenumbruch ein (`hardBreak`; im gespeicherten Inhalt ein `\n` im Text). Außerhalb einer Aufzählungszeile bleibt
 * beides unverändert – unsere Regel gibt dort `false` zurück und BlockNote macht, was es immer tat.
 */

type Zelle = { start: number; text: string; cursor: number };

/** Die Zelle, in der der leere Cursor steht – mit Text (Zeilenumbrüche als `\n`) und Cursor darin; sonst `null`. */
function zelleAm(state: EditorState): Zelle | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const $p = selection.$from;
  if ($p.parent.type.name !== 'tableParagraph') return null;
  // Jedes Zeichen und jeder Umbruch zählt eine Stelle – darum stimmt der Index im Text mit der Lage im Dokument überein.
  const text = $p.parent.textBetween(0, $p.parent.content.size, undefined, '\n');
  return { start: $p.start(), text, cursor: $p.parentOffset };
}

/** Eine Zeile der Zelle: von `von` bis `bis` (Index im Text). */
function zeileAm({ text, cursor }: Zelle): { von: number; bis: number } {
  const von = text.lastIndexOf('\n', cursor - 1) + 1;
  const ende = text.indexOf('\n', cursor);
  return { von, bis: ende === -1 ? text.length : ende };
}

/** Enter in einer Zelle – `true`, wenn die Aufzählung die Taste übernommen hat. */
export function enterInAufzaehlung(editor: ProtokollEditor): boolean {
  const zelle = zelleAm(editor.prosemirrorState);
  if (!zelle) return false;
  const { von, bis } = zeileAm(zelle);
  const tat = enterInZelle(zelle.text.slice(von, bis), zelle.text.slice(von, zelle.cursor));
  if (tat.tun === 'nichts') return false;
  editor.transact((tr) => {
    const pos = zelle.start + zelle.cursor;
    if (tat.tun === 'beenden') {
      tr.delete(zelle.start + von, zelle.start + von + tat.laenge);
      return;
    }
    const umbruch = tr.doc.type.schema.nodes.hardBreak.create();
    tr.insert(pos, umbruch);
    tr.insertText(tat.vorsatz, pos + umbruch.nodeSize);
    tr.setSelection(TextSelection.create(tr.doc, pos + umbruch.nodeSize + tat.vorsatz.length));
  });
  return true;
}

/** Die Tasten der Text-Aufzählung in Zellen (hängt am Überschrift-Block, `editorSchema.ts`). */
export const zellenListe = createExtension({
  key: 'protokoll-zellen-liste',
  keyboardShortcuts: {
    Enter: ({ editor }) => enterInAufzaehlung(editor as ProtokollEditor),
  },
  prosemirrorPlugins: [
    new Plugin({
      props: {
        handleTextInput(view, from, to, text) {
          if (text !== ' ' || from !== to) return false;
          const zelle = zelleAm(view.state);
          if (!zelle) return false;
          const { von } = zeileAm(zelle);
          if (!wirdZuPunkt(zeileVorCursor(zelle.text.slice(0, zelle.cursor)))) return false;
          // „-“ bzw. „*“ (ein Zeichen vor dem Cursor) und das Leerzeichen werden zu „• “.
          view.dispatch(view.state.tr.insertText(`${ZELLEN_PUNKT} `, zelle.start + von, to));
          return true;
        },
      },
    }),
  ],
});
