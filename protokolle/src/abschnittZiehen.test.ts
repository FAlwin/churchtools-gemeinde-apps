// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { schema, type ProtokollEditor } from './editorSchema';
import {
  abschnittAblegen,
  abschnittLinie,
  abschnittSchieben,
  abschnittZiehenBeginnt,
  abschnittZiehenEndet,
  blockGrenze,
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

describe('Linie beim Ziehen (K1: „Punkt ziehen landet falsch“)', () => {
  it('kein Abschnitt gezogen: BlockNotes eigene Linie', () => {
    const e = editorMit();
    expect(abschnittLinie(e, 34, lage(e))).toBe('frei');
    abschnittZiehenBeginnt(e, 'b1');
    expect(abschnittLinie(e, 34, lage(e))).toBe('frei');
  });

  it('über dem eigenen Abschnitt oder an seinen Rändern: keine Linie (es bewegt sich nichts)', () => {
    const e = editorMit();
    abschnittZiehenBeginnt(e, 'B');
    for (const y of [24, 34, 44, 50]) expect(abschnittLinie(e, y, lage(e))).toBe('keine');
  });

  it('an einer Grenze bzw. ganz am Ende', () => {
    const e = editorMit();
    abschnittZiehenBeginnt(e, 'C');
    expect(abschnittLinie(e, 3, lage(e))).toEqual({ vor: 'A' });
    expect(abschnittLinie(e, 34, lage(e))).toEqual({ vor: 'B' });
    abschnittZiehenEndet(e);
    abschnittZiehenBeginnt(e, 'A');
    expect(abschnittLinie(e, 69, lage(e))).toEqual({ nach: 'c1' });
  });

  it('wo die Linie steht, landet der Abschnitt – für jede Höhe', () => {
    for (const start of ['A', 'B', 'C']) {
      for (let y = 0; y <= 70; y += 3) {
        const e = editorMit();
        abschnittZiehenBeginnt(e, start);
        const linie = abschnittLinie(e, y, lage(e));
        const teil = ids(e)
          .slice(ids(e).indexOf(start))
          .slice(0, start === 'B' ? 3 : 2);
        abschnittAblegen(e, y, lage(e));
        const nach = ids(e);
        if (linie === 'keine') expect(nach, `${start} bei ${y}`).toEqual(DOK.map((b) => b.id));
        else if (linie !== 'frei' && 'vor' in linie)
          expect(nach[nach.indexOf(linie.vor) - 1], `${start} bei ${y}`).toBe(teil.at(-1));
        else if (linie !== 'frei')
          expect(nach.slice(-teil.length), `${start} bei ${y}`).toEqual(teil);
      }
    }
  });
});

describe('blockGrenze (wo BlockNote die Linie zeichnet)', () => {
  it('vor einem Block steht er direkt dahinter, hinter einem Block direkt davor – auch beim letzten', () => {
    const e = editorMit();
    const doc = e.prosemirrorState.doc;
    for (const id of ['A', 'B', 'C', 'c1']) {
      expect(doc.resolve(blockGrenze(doc, id, 'vor')!).nodeAfter?.attrs.id).toBe(id);
      expect(doc.resolve(blockGrenze(doc, id, 'nach')!).nodeBefore?.attrs.id).toBe(id);
    }
    expect(blockGrenze(doc, 'gibt-es-nicht', 'vor')).toBeNull();
  });
});
