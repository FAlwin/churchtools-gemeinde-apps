// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { schema, type ProtokollEditor } from './editorSchema';
import { einhaengen } from './editorTest.testutil';
import { hatGriff, nurDieseZeile } from './zeilenGriff';

/** Griff im Text (W7): Überschriften haben keinen, und der Griff einer Zeile zieht keine Überschrift mit. */

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const DOK: Block[] = [
  { id: 'H', type: 'heading', props: { level: 1 }, content: 'Punkt' },
  { id: 'l1', type: 'bulletListItem', content: 'Eins' },
  { id: 'l2', type: 'bulletListItem', content: 'Zwei' },
  { id: 'l3', type: 'bulletListItem', content: 'Drei' },
];
const editorMit = (): ProtokollEditor =>
  einhaengen(BlockNoteEditor.create({ schema, initialContent: DOK as Teil[] }));
const markiert = (e: ProtokollEditor) => e.getSelection()?.blocks.map((b) => b.id);

describe('hatGriff', () => {
  it('Überschriften und normaler Text: kein Griff – Listen, Zitat, Tabelle und eigene Blöcke: einer', () => {
    for (const art of ['heading', 'paragraph', undefined]) expect(hatGriff(art)).toBe(false);
    for (const art of [
      'bulletListItem',
      'numberedListItem',
      'quote',
      'table',
      'divider',
      'aufgabe',
      'beschluss',
      'termin',
      'verweis',
    ])
      expect(hatGriff(art)).toBe(true);
  });

  it('jede Überschrift-Stufe gleich: der Block heißt immer „heading“', () => {
    const e = einhaengen(
      BlockNoteEditor.create({
        schema,
        initialContent: [1, 2, 3, 4, 5, 6].map((level) => ({
          id: `h${level}`,
          type: 'heading',
          props: { level },
          content: 'x',
        })),
      }),
    );
    expect(e.document.every((b) => !hatGriff(b.type))).toBe(true);
  });
});

describe('nurDieseZeile', () => {
  it('Markierung mit Überschrift: schrumpft auf die Zeile am Griff', () => {
    const e = editorMit();
    e.setSelection('H', 'l2');
    expect(markiert(e)).toEqual(['H', 'l1', 'l2']);
    nurDieseZeile(e, 'l1');
    expect(markiert(e)).toBeUndefined();
    expect(e.getTextCursorPosition().block.id).toBe('l1');
    expect(e.document.map((b) => b.id)).toEqual(['H', 'l1', 'l2', 'l3']);
  });

  it('Markierung nur aus Listenzeilen: bleibt – sie ziehen gemeinsam', () => {
    const e = editorMit();
    e.setSelection('l1', 'l3');
    nurDieseZeile(e, 'l2');
    expect(markiert(e)).toEqual(['l1', 'l2', 'l3']);
  });

  it('einen Block, den es nicht gibt, übersteht es ohne Fehler', () => {
    const e = editorMit();
    e.setSelection('H', 'l2');
    expect(() => nurDieseZeile(e, 'weg')).not.toThrow();
  });
});
