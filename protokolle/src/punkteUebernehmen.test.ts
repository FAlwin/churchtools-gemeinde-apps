// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { gliederung, punktVerschieben } from '@shared/protokolle/gliederung';
import { schema, type ProtokollEditor } from './editorSchema';
import { einhaengen } from './editorTest.testutil';
import { reihenfolgeUebernehmen } from './punkteUebernehmen';

/** Punkte ordnen im Editor (W7) – gegen den echten BlockNote-Editor mit unserem Schema und die echte Regel. */

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const h = (id: string, text: string, level = 1): Block => ({
  id,
  type: 'heading',
  props: { level },
  content: text,
});
const DOK: Block[] = [
  { id: 'vor', type: 'paragraph', content: 'Vorspann' },
  h('A', 'Andacht'),
  { id: 'a1', type: 'bulletListItem', content: 'Impuls' },
  h('B', 'Technik'),
  h('B1', 'Ton', 2),
  { id: 'todo', type: 'aufgabe', props: { aufgabe: 'aufgabe-9' }, content: 'Batterien kaufen' },
  h('B2', 'Bild', 2),
  { id: 'b2', type: 'beschluss', content: 'Beamer bleibt' },
  h('C', 'Ausblick'),
  { id: 'c1', type: 'termin', props: { datum: '2027-01-21' }, content: 'Treffen' },
];

const editorMit = () =>
  einhaengen(BlockNoteEditor.create({ schema, initialContent: DOK as Teil[] }));
const ids = (e: ProtokollEditor) => e.document.map((b) => b.id);
const reihenfolge = (e: ProtokollEditor, id: string, index: number): string[] => {
  const r = punktVerschieben(e.document as Block[], id, index);
  if (!r) throw new Error('kein Schritt');
  return r.bloecke.map((b) => b.id);
};

describe('reihenfolgeUebernehmen', () => {
  it('stellt um wie die Regel – Unterpunkte und Inhalt wandern mit, IDs und To-Do-Verbindung bleiben', () => {
    const e = editorMit();
    expect(reihenfolgeUebernehmen(e, reihenfolge(e, 'B', 0))).toBe(true);
    expect(ids(e)).toEqual(['vor', 'B', 'B1', 'todo', 'B2', 'b2', 'A', 'a1', 'C', 'c1']);
    expect(e.getBlock('todo')?.props).toMatchObject({ aufgabe: 'aufgabe-9' });
    expect(e.getBlock('b2')?.type).toBe('beschluss');
    expect(e.getBlock('B1')?.props).toMatchObject({ level: 2 });
    expect(gliederung(e.document as Block[]).map((k) => k.nummer)).toEqual(['1.', '2.', '3.']);
  });

  it('ein Schritt: einmal Rückgängig im Editor holt die ganze Umstellung zurück', () => {
    const e = editorMit();
    // Zwei Züge im Fenster, eine Übernahme.
    const erst = punktVerschieben(DOK, 'C', 0)!;
    const dann = punktVerschieben(erst.bloecke, 'B1', 1)!;
    expect(
      reihenfolgeUebernehmen(
        e,
        dann.bloecke.map((b) => b.id),
      ),
    ).toBe(true);
    expect(ids(e)).not.toEqual(DOK.map((b) => b.id));
    e.undo();
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
  });

  it('ein einziger Schritt im Editor – gezählt an den Änderungen am Dokument, nicht am Zeitfenster des Rückgängig-Verlaufs', () => {
    // Der Verlauf fasst schnelle Änderungen ohnehin zusammen (500 ms); ein Test nur mit `undo` bliebe auch bei zwei
    // getrennten Schritten grün.
    const e = editorMit();
    let aenderungen = 0;
    e._tiptapEditor.on('transaction', ({ transaction }) => {
      if (transaction.docChanged) aenderungen++;
    });
    reihenfolgeUebernehmen(e, reihenfolge(e, 'B', 0));
    expect(ids(e)).toEqual(['vor', 'B', 'B1', 'todo', 'B2', 'b2', 'A', 'a1', 'C', 'c1']);
    expect(aenderungen).toBe(1);
  });

  it('nur die Spanne der Änderung wird angefasst – Vorspann und Rest bleiben dieselben Blöcke', () => {
    const e = editorMit();
    const vorher = e.getBlock('vor');
    reihenfolgeUebernehmen(e, reihenfolge(e, 'C', 0));
    expect(e.getBlock('vor')).toBe(vorher);
    expect(ids(e)).toEqual(['vor', 'C', 'c1', 'A', 'a1', 'B', 'B1', 'todo', 'B2', 'b2']);
  });

  it('unverändert: nichts zu tun, kein Schritt im Verlauf', () => {
    const e = editorMit();
    expect(
      reihenfolgeUebernehmen(
        e,
        DOK.map((b) => b.id),
      ),
    ).toBe(true);
    e.undo();
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
  });

  it('hat sich das Dokument inzwischen verändert, wird nichts angewendet', () => {
    const e = editorMit();
    const plan = reihenfolge(e, 'B', 0);
    e.removeBlocks(['a1']);
    const vorher = ids(e);
    expect(reihenfolgeUebernehmen(e, plan)).toBe(false);
    expect(ids(e)).toEqual(vorher);
    expect(reihenfolgeUebernehmen(e, ['x', 'y'])).toBe(false);
  });
});
