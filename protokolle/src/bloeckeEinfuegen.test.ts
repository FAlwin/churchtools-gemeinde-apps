// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { schema, type ProtokollEditor } from './editorSchema';
import { bloeckeEinfuegen } from './bloeckeEinfuegen';
import { einhaengen } from './editorTest.testutil';

/** Einfügen ins Protokoll (Vorschläge, „Mit KI füllen“) – gegen den echten BlockNote-Editor mit unserem Schema. */

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const A: Block = { id: 'A', type: 'heading', props: { level: 1 }, content: 'Andacht' };
const B: Block = { id: 'B', type: 'heading', props: { level: 1 }, content: 'Verschiedenes' };
const leer = (id: string): Block => ({ id, type: 'paragraph', content: [] });
const neu: Block = { id: 'N', type: 'heading', props: { level: 1 }, content: 'Parkplatz' };

const editorMit = (dok: Block[]) =>
  einhaengen(BlockNoteEditor.create({ schema, initialContent: dok as Teil[] }));
const ids = (e: ProtokollEditor) => e.document.map((b) => b.id);

describe('bloeckeEinfuegen', () => {
  it('ohne Ziel: vor die leere Schlusszeile, nicht dahinter', () => {
    const e = editorMit([A, B, leer('L')]);
    bloeckeEinfuegen(e, [neu], null);
    expect(ids(e)).toEqual(['A', 'B', 'N', 'L']);
  });
  it('mehrere leere Zeilen am Schluss: vor die erste', () => {
    const e = editorMit([A, B, leer('L1'), leer('L2')]);
    bloeckeEinfuegen(e, [neu], null);
    expect(ids(e)).toEqual(['A', 'B', 'N', 'L1', 'L2']);
  });
  it('endet mit Inhalt: hinter den letzten Block', () => {
    const e = editorMit([A, B]);
    bloeckeEinfuegen(e, [neu], null);
    expect(ids(e).slice(0, 3)).toEqual(['A', 'B', 'N']);
  });
  it('mit Ziel: davor', () => {
    const e = editorMit([A, B, leer('L')]);
    bloeckeEinfuegen(e, [neu], 'B');
    expect(ids(e)).toEqual(['A', 'N', 'B', 'L']);
  });
  it('Ziel gibt es nicht mehr: wie ohne Ziel (vor die Schlusszeile)', () => {
    const e = editorMit([A, B, leer('L')]);
    bloeckeEinfuegen(e, [neu], 'weg');
    expect(ids(e)).toEqual(['A', 'B', 'N', 'L']);
  });
});
