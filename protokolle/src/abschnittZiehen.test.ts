// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { schema, type ProtokollEditor } from './editorSchema';
import {
  abschnittAblegen,
  abschnittSchieben,
  abschnittZiehenBeginnt,
  abschnittZiehenEndet,
  kannSchieben,
} from './abschnittZiehen';
import { einhaengen } from './editorTest.testutil';

/** Abschnitte verschieben (S4-3b) – gegen den echten BlockNote-Editor mit unserem Schema. */

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const DOK: Block[] = [
  { id: 'A', type: 'heading', props: { level: 1 }, content: 'Andacht' },
  { id: 'a1', type: 'paragraph', content: 'Römer 12' },
  { id: 'B', type: 'heading', props: { level: 1 }, content: 'Offene To-Dos' },
  { id: 'bv', type: 'verweis', props: { art: 'offene-aufgaben' } },
  { id: 'b1', type: 'aufgabe', props: { aufgabe: 'todo-1' }, content: 'Beamer' },
  { id: 'C', type: 'heading', props: { level: 1 }, content: 'Verschiedenes' },
  { id: 'c1', type: 'paragraph', content: 'Ende' },
];

const editorMit = () =>
  einhaengen(BlockNoteEditor.create({ schema, initialContent: DOK as Teil[] }));
const ids = (e: ProtokollEditor) => e.document.map((b) => b.id);

/** Lage auf dem „Bildschirm“: jeder Block 10 Einheiten hoch, in Reihenfolge. */
const lage = (e: ProtokollEditor) => (id: string) => {
  const i = e.document.findIndex((b) => b.id === id);
  return i < 0 ? null : { top: i * 10, bottom: i * 10 + 10 };
};

describe('Nach oben / Nach unten', () => {
  it('springt um einen ganzen Abschnitt – mit festem Punkt und Aufgabe, IDs bleiben', () => {
    const e = editorMit();
    expect(abschnittSchieben(e, 'B', 'runter')).toBe(true);
    expect(ids(e)).toEqual(['A', 'a1', 'C', 'c1', 'B', 'bv', 'b1']);
    expect(e.getBlock('b1')?.props).toMatchObject({ aufgabe: 'todo-1' });
    expect(abschnittSchieben(e, 'B', 'hoch')).toBe(true);
    expect(ids(e)).toEqual(ids(editorMit()));
  });

  it('nicht über den Anfang oder das Ende hinaus – dann fehlt der Eintrag', () => {
    const e = editorMit();
    expect(kannSchieben(e, 'A', 'hoch')).toBe(false);
    expect(kannSchieben(e, 'C', 'runter')).toBe(false);
    expect(kannSchieben(e, 'B', 'hoch')).toBe(true);
    expect(abschnittSchieben(e, 'A', 'hoch')).toBe(false);
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
  });

  it('ein Schritt – einmal Rückgängig holt alles zurück', () => {
    const e = editorMit();
    abschnittSchieben(e, 'C', 'hoch');
    expect(ids(e)).toEqual(['A', 'a1', 'C', 'c1', 'B', 'bv', 'b1']);
    e.undo();
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
  });
});

describe('Ziehen und Loslassen', () => {
  it('mitten in einen Abschnitt: an die nächste Grenze, der andere bleibt ganz', () => {
    const e = editorMit();
    abschnittZiehenBeginnt(e, 'C');
    // losgelassen auf der Höhe von „bv“ (Index 3, Mitte bei 35) – in „Offene To-Dos“
    expect(abschnittAblegen(e, 34, lage(e))).toBe(true);
    expect(ids(e)).toEqual(['A', 'a1', 'C', 'c1', 'B', 'bv', 'b1']);
  });

  it('keine Überschrift: BlockNote legt ab wie bisher (nicht übernommen)', () => {
    const e = editorMit();
    abschnittZiehenBeginnt(e, 'b1');
    expect(abschnittAblegen(e, 5, lage(e))).toBe(false);
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
  });

  it('nach dem Loslassen keine Markierung mehr – auch nicht nach Rückgängig', () => {
    const e = editorMit();
    abschnittZiehenBeginnt(e, 'B');
    expect(e.getSelection()?.blocks.map((b) => b.id)).toEqual(['B', 'bv', 'b1']);
    abschnittAblegen(e, 69, lage(e));
    expect(ids(e)).toEqual(['A', 'a1', 'C', 'c1', 'B', 'bv', 'b1']);
    e.undo();
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
    expect(e.getSelection()).toBeUndefined();
  });

  it('abgebrochen (nicht im Blatt losgelassen): Markierung weg, nichts verschoben, nichts gemerkt', () => {
    const e = editorMit();
    abschnittZiehenBeginnt(e, 'B');
    abschnittZiehenEndet(e);
    expect(e.getSelection()).toBeUndefined();
    expect(abschnittAblegen(e, 69, lage(e))).toBe(false);
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
  });
});
