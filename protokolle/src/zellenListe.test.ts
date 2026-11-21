// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import { TextSelection } from 'prosemirror-state';
import { schema, TABELLEN, type ProtokollEditor } from './editorSchema';
import { einhaengen } from './editorTest.testutil';

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const tabelle = (...zellen: string[][]): Teil => ({
  id: 't',
  type: 'table',
  content: {
    type: 'tableContent',
    rows: zellen.map((z) => ({ cells: z })),
  },
} as Teil);

function editorMit(dok: Teil[]): ProtokollEditor {
  return einhaengen(BlockNoteEditor.create({ schema, tables: TABELLEN, initialContent: dok }));
}

/** Setzt den Cursor in die Zelle mit diesem Text, `nach` Zeichen vom Anfang des Textstücks. */
function cursorIn(e: ProtokollEditor, text: string, nach?: number): void {
  let pos = -1;
  e.prosemirrorState.doc.descendants((n, p) => {
    if (pos === -1 && n.isText && n.text?.includes(text)) pos = p;
    return true;
  });
  if (pos === -1) throw new Error(`Zelle mit „${text}“ nicht gefunden`);
  e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, pos + (nach ?? text.length))));
}

function taste(e: ProtokollEditor, key: string, umschalt = false): void {
  e._tiptapEditor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey: umschalt, bubbles: true, cancelable: true }),
  );
}

function tippen(e: ProtokollEditor, text: string): void {
  const v = e._tiptapEditor.view;
  for (const z of text) {
    const { from, to } = v.state.selection;
    if (!v.someProp('handleTextInput', (f) => f(v, from, to, z))) v.dispatch(v.state.tr.insertText(z, from, to));
  }
}

/** Der Text der Zellen als Zeile-für-Zeile-Liste, Zeilenumbrüche als `\n`. */
function zellen(e: ProtokollEditor): string[][] {
  const t = e.document[0].content as unknown as {
    rows: { cells: { content: { text: string }[] }[] }[];
  };
  return t.rows.map((r) => r.cells.map((c) => c.content.map((s) => s.text).join('')));
}

describe('Tabellenzellen: Enter und Umschalt+Enter heute', () => {
  it('Enter springt in die Zelle darunter, Umschalt+Enter macht einen Zeilenumbruch', () => {
    const e = editorMit([tabelle(['Anna', 'B'], ['Cora', 'D'])]);
    cursorIn(e, 'Anna', 2);
    taste(e, 'Enter');
    expect(e.prosemirrorState.selection.$head.parent.textContent).toBe('Cora');
    cursorIn(e, 'Anna', 2);
    taste(e, 'Enter', true);
    expect(zellen(e)[0][0]).toBe('An\nna');
  });
});

describe('Text-Aufzählung in Zellen (Editor)', () => {
  const leer = (): ProtokollEditor => editorMit([tabelle(['A', 'B'], ['C', 'D'])]);
  const ansEnde = (e: ProtokollEditor, text: string): void => cursorIn(e, text);

  it('„- “ und „* “ am Zellanfang werden „• “', () => {
    for (const z of ['-', '*']) {
      const e = leer();
      cursorIn(e, 'A', 0);
      tippen(e, `${z} Brot`);
      expect(zellen(e)[0][0]).toBe('• BrotA');
    }
  });

  it('„- “ mitten im Satz bleibt, wie getippt', () => {
    const e = leer();
    ansEnde(e, 'A');
    tippen(e, ' - B');
    expect(zellen(e)[0][0]).toBe('A - B');
  });

  it('„- “ nach einem Zeilenumbruch wird „• “', () => {
    const e = leer();
    ansEnde(e, 'A');
    taste(e, 'Enter', true);
    tippen(e, '- eins');
    expect(zellen(e)[0][0]).toBe('A\n• eins');
  });

  it('„1. “ bleibt „1. “', () => {
    const e = leer();
    cursorIn(e, 'A', 0);
    tippen(e, '1. x');
    expect(zellen(e)[0][0]).toBe('1. xA');
  });

  it('Enter hinter „• Text“ setzt in derselben Zelle „• “ fort', () => {
    const e = editorMit([tabelle(['• eins', 'B'], ['C', 'D'])]);
    ansEnde(e, '• eins');
    taste(e, 'Enter');
    expect(zellen(e)[0][0]).toBe('• eins\n• ');
    tippen(e, 'zwei');
    expect(zellen(e)[0][0]).toBe('• eins\n• zwei');
    expect(zellen(e)[1][0]).toBe('C');
  });

  it('Enter hinter „2. Text“ setzt „3. “ fort, bei „9.“ wird es „10. “', () => {
    const e = editorMit([tabelle(['1. a\n9. b', 'B'])]);
    ansEnde(e, '1. a');
    cursorIn(e, '1. a', 4);
    taste(e, 'Enter');
    expect(zellen(e)[0][0]).toBe('1. a\n2. \n9. b');
    const f = editorMit([tabelle(['9. b', 'B'])]);
    ansEnde(f, '9. b');
    taste(f, 'Enter');
    expect(zellen(f)[0][0]).toBe('9. b\n10. ');
  });

  it('Enter mitten in der Zeile teilt sie: der Rest kommt hinter die neue Marke', () => {
    const e = editorMit([tabelle(['• eins zwei', 'B'])]);
    cursorIn(e, '• eins zwei', '• eins'.length);
    taste(e, 'Enter');
    expect(zellen(e)[0][0]).toBe('• eins\n•  zwei');
  });

  it('Enter auf leerer Aufzählungszeile nimmt die Marke weg und beendet die Aufzählung', () => {
    const e = editorMit([tabelle(['• eins\n• ', 'B'], ['C', 'D'])]);
    ansEnde(e, '• eins');
    // Cursor ans Ende der Zelle (hinter „• “)
    const ende = e.prosemirrorState.selection.$head.end();
    e.transact((tr) => tr.setSelection(TextSelection.create(tr.doc, ende)));
    taste(e, 'Enter');
    expect(zellen(e)[0][0]).toBe('• eins\n');
    // Danach gilt wieder das übliche Verhalten: Enter springt in die Zelle darunter.
    taste(e, 'Enter');
    expect(e.prosemirrorState.selection.$head.parent.textContent).toBe('C');
  });

  it('Außerhalb von Aufzählungszeilen bleibt Enter, wie es war', () => {
    const e = leer();
    ansEnde(e, 'A');
    taste(e, 'Enter');
    expect(e.prosemirrorState.selection.$head.parent.textContent).toBe('C');
    expect(zellen(e)[0][0]).toBe('A');
  });

  it('Der Cursor in der Marke („•| Text“) lässt Enter unverändert', () => {
    const e = editorMit([tabelle(['• eins', 'B'], ['C', 'D'])]);
    cursorIn(e, '• eins', 1);
    taste(e, 'Enter');
    expect(e.prosemirrorState.selection.$head.parent.textContent).toBe('C');
    expect(zellen(e)[0][0]).toBe('• eins');
  });

  it('Zelle farbig füllen: das Schema kennt den Hintergrund, nicht die Schriftfarbe', () => {
    const e = editorMit([tabelle(['A', 'B'])]);
    expect(e.settings.tables.cellBackgroundColor).toBe(true);
    expect(e.settings.tables.cellTextColor).toBeFalsy();
  });
});
