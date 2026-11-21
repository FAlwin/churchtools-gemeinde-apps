// Test-Hilfe: Tabellen im echten BlockNote-Editor aufbauen, Cursor setzen, Tasten und Text eingeben – für die Tests der
// Tabellenzellen (W11 Aufzählung, W13 Zeilenkennzeichen). EINE Stelle statt einer Kopie je Testdatei.
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import { TextSelection } from 'prosemirror-state';
import { schema, TABELLEN, type ProtokollEditor } from './editorSchema';
import { einhaengen } from './editorTest.testutil';

export type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

/** Eine Tabelle: je Zeile die Texte ihrer Zellen. */
export const tabelle = (...zellen: string[][]): Teil => ({
  id: 't',
  type: 'table',
  content: {
    type: 'tableContent',
    rows: zellen.map((z) => ({ cells: z })),
  },
});

export function editorMit(dok: Teil[]): ProtokollEditor {
  return einhaengen(BlockNoteEditor.create({ schema, tables: TABELLEN, initialContent: dok }));
}

/** Setzt den Cursor in die Zelle mit diesem Text, `nach` Zeichen vom Anfang des Textstücks. */
export function cursorIn(e: ProtokollEditor, text: string, nach?: number): void {
  let pos = -1;
  e.prosemirrorState.doc.descendants((n, p) => {
    if (pos === -1 && n.isText && n.text?.includes(text)) pos = p;
    return true;
  });
  if (pos === -1) throw new Error(`Zelle mit „${text}“ nicht gefunden`);
  e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, pos + (nach ?? text.length))));
}

export function taste(e: ProtokollEditor, key: string, umschalt = false): void {
  e._tiptapEditor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey: umschalt, bubbles: true, cancelable: true }),
  );
}

export function tippen(e: ProtokollEditor, text: string): void {
  const v = e._tiptapEditor.view;
  for (const z of text) {
    const { from, to } = v.state.selection;
    if (
      !v.someProp('handleTextInput', (f) =>
        f(v, from, to, z, () => v.state.tr.insertText(z, from, to)),
      )
    )
      v.dispatch(v.state.tr.insertText(z, from, to));
  }
}

/** Der Text der Zellen als Zeile-für-Zeile-Liste, Zeilenumbrüche als `\n`. */
export function zellen(e: ProtokollEditor): string[][] {
  const t = e.document[0].content as unknown as {
    rows: { cells: { content: { text: string }[] }[] }[];
  };
  return t.rows.map((r) => r.cells.map((c) => c.content.map((s) => s.text).join('')));
}
