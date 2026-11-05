// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { schema, TABELLEN, type ProtokollEditor } from './editorSchema';
import { einhaengen } from './editorTest.testutil';
import { ebenenNachRuecken, kannRuecken, ruecken } from './einruecken';

/**
 * **Einrücken und Ausrücken** (K3b, Entwurf `k3b-v1`): die Regel ohne Editor und mit dem echten Editor – Tab wird wie
 * im Browser gedrückt, damit auch geprüft ist, dass unsere Tasten vor denen von BlockNote greifen.
 */

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const h = (id: string, level = 1): Block => ({
  id,
  type: 'heading',
  props: { level },
  content: [{ type: 'text', text: id, styles: {} }],
});
const p = (id: string): Block => ({
  id,
  type: 'paragraph',
  content: [{ type: 'text', text: id, styles: {} }],
});

function editorMit(dok: readonly Block[]): ProtokollEditor {
  return einhaengen(
    BlockNoteEditor.create({ schema, tables: TABELLEN, initialContent: dok as Teil[] }),
  );
}

function taste(e: ProtokollEditor, umschalt = false): void {
  e._tiptapEditor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: umschalt,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** Oberste Ebene: ID, Stufe (bei Überschriften) und eingerückte Kinder. */
const bild = (e: ProtokollEditor) =>
  e.document.map((b) => ({
    id: b.id,
    ...(b.type === 'heading' ? { stufe: b.props.level } : {}),
    ...(b.children.length ? { kinder: b.children.map((k) => k.id) } : {}),
  }));

describe('ebenenNachRuecken (die Regel)', () => {
  const D = [h('A'), h('B'), h('B1', 2), h('C')];

  it('Punkt → Unterpunkt; der erste Punkt bleibt Punkt', () => {
    expect([...ebenenNachRuecken(D, new Set(['B']), 1)]).toEqual([['B', 1]]);
    expect(ebenenNachRuecken(D, new Set(['A']), 1).size).toBe(0);
  });

  it('höchstens eine Ebene unter dem Punkt davor', () => {
    // C steht nach B1 (Ebene 1) → darf 1 werden, nicht 2 in einem Schritt; B1 nach B (0) darf nicht auf 2.
    expect([...ebenenNachRuecken(D, new Set(['C']), 1)]).toEqual([['C', 1]]);
    expect(ebenenNachRuecken(D, new Set(['B1']), 1).size).toBe(0);
    const tiefer = [h('A'), h('A1', 2), h('A2', 2)];
    expect([...ebenenNachRuecken(tiefer, new Set(['A2']), 1)]).toEqual([['A2', 2]]);
  });

  it('nicht tiefer als 4.1.1.1.1', () => {
    const tief = [h('A'), h('1', 2), h('2', 4), h('3', 5), h('4', 6), h('5', 6)];
    expect(ebenenNachRuecken(tief, new Set(['5']), 1).size).toBe(0);
  });

  it('mehrere markierte Punkte wandern gemeinsam: 1.1 + 1.1.1 ausrücken → 2 + 2.1', () => {
    const d = [h('A'), h('A1', 2), h('A1a', 4)];
    expect([...ebenenNachRuecken(d, new Set(['A1', 'A1a']), -1)]).toEqual([
      ['A1', 0],
      ['A1a', 1],
    ]);
  });

  it('ein Punkt lässt sich nicht weiter ausrücken', () => {
    expect(ebenenNachRuecken(D, new Set(['B']), -1).size).toBe(0);
  });
});

describe('Tab im Editor (K3b)', () => {
  it('Tab auf einem Punkt macht ihn zum Unterpunkt – er bleibt auf oberster Ebene (vorher: Kind des Blocks davor)', () => {
    const e = editorMit([h('A'), p('a'), h('B'), p('b')]);
    e.setTextCursorPosition('B', 'end');
    taste(e);
    expect(bild(e)).toEqual([
      { id: 'A', stufe: 1 },
      { id: 'a' },
      { id: 'B', stufe: 2 },
      { id: 'b' },
    ]);
  });

  it('Tab auf dem ersten Punkt tut nichts', () => {
    const e = editorMit([p('vor'), h('A'), p('a')]);
    e.setTextCursorPosition('A', 'end');
    taste(e);
    expect(bild(e)).toEqual([{ id: 'vor' }, { id: 'A', stufe: 1 }, { id: 'a' }]);
    expect(kannRuecken(e, 1)).toBe(false);
  });

  it('zweimal Tab: 2.2 → 2.1.1 (Stufe 4); Umschalt+Tab zurück bis zum Punkt', () => {
    const e = editorMit([h('A'), h('B'), h('B1', 2), h('C')]);
    e.setTextCursorPosition('C', 'end');
    taste(e);
    taste(e);
    expect(e.getBlock('C')?.props).toMatchObject({ level: 4 });
    taste(e, true);
    taste(e, true);
    expect(e.getBlock('C')?.props).toMatchObject({ level: 1 });
    expect(e.document.map((b) => b.id)).toEqual(['A', 'B', 'B1', 'C']);
  });

  it('mehrere markierte Zeilen rücken gemeinsam ein und wieder aus', () => {
    const e = editorMit([h('A'), p('x'), p('y'), p('z')]);
    e.setSelection('y', 'z');
    taste(e);
    expect(bild(e)).toEqual([
      { id: 'A', stufe: 1 },
      { id: 'x', kinder: ['y', 'z'] },
    ]);
    e.setSelection('y', 'z');
    taste(e, true);
    expect(bild(e)).toEqual([{ id: 'A', stufe: 1 }, { id: 'x' }, { id: 'y' }, { id: 'z' }]);
  });

  it('Punkt und Text zusammen markiert: der Punkt wird Unterpunkt, der Text rückt ein', () => {
    const e = editorMit([h('A'), p('a'), h('B'), p('b')]);
    e.setSelection('B', 'b');
    taste(e);
    expect(bild(e)).toEqual([
      { id: 'A', stufe: 1 },
      { id: 'a' },
      { id: 'B', stufe: 2, kinder: ['b'] },
    ]);
  });

  it('einzelne Textzeile rückt wie bisher ein (Kind der Zeile davor)', () => {
    const e = editorMit([h('A'), p('x'), p('y')]);
    e.setTextCursorPosition('y', 'end');
    taste(e);
    expect(bild(e)).toEqual([
      { id: 'A', stufe: 1 },
      { id: 'x', kinder: ['y'] },
    ]);
  });

  it('in einer Tabelle gehört Tab nicht uns', () => {
    const e = editorMit([
      h('A'),
      {
        id: 't',
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [{ cells: ['eins', 'zwei'] }],
        },
      },
    ]);
    e.setTextCursorPosition('t', 'start');
    expect(ruecken(e, 1)).toBe(false);
    expect(kannRuecken(e, 1)).toBe(false);
  });
});
