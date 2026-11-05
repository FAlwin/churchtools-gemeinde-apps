// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { schema, TABELLEN, type ProtokollEditor } from './editorSchema';
import { einhaengen } from './editorTest.testutil';

/** **Nummern im Editor** (K3b): dieselbe Zählung wie `ableiten`, als `data-nummer` am Block – auch nach Änderungen. */

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

/** Text und Nummer jeder Überschrift im Editor, in der Reihenfolge des Blatts. */
const nummern = (e: ProtokollEditor) =>
  [...e._tiptapEditor.view.dom.querySelectorAll<HTMLElement>('[data-content-type="heading"]')].map(
    (el) => {
      // Was zu sehen ist, kommt über die Variable (CSS `content: var(--punkt-nummer)`) – die muss zur Nummer passen.
      const variable = el.style.getPropertyValue('--punkt-nummer');
      expect(variable).toBe(el.dataset.nummer === undefined ? '' : `"${el.dataset.nummer}"`);
      return [el.textContent, el.dataset.nummer ?? null];
    },
  );

describe('Nummern im Editor (K3b)', () => {
  it('Punkt „1.“, Unterpunkte „1.1“ / „1.1.1“, „Überschrift“ und eingerückte Überschrift ohne Nummer', () => {
    const e = editorMit([
      h('A'),
      h('A1', 2),
      h('A1a', 4),
      h('Ue', 3),
      { ...p('x'), children: [h('innen')] },
      h('B'),
    ]);
    expect(nummern(e)).toEqual([
      ['A', '1.'],
      ['A1', '1.1'],
      ['A1a', '1.1.1'],
      ['Ue', null],
      ['innen', null],
      ['B', '2.'],
    ]);
  });

  it('zählt nach einer Änderung neu', () => {
    const e = editorMit([h('A'), h('B'), h('C')]);
    e.updateBlock('B', { props: { level: 2 } });
    expect(nummern(e)).toEqual([
      ['A', '1.'],
      ['B', '1.1'],
      ['C', '2.'],
    ]);
  });
});
