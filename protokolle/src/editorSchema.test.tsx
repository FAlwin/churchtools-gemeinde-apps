// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import { ableiten, fremdeTypen, type Block } from '@shared/protokolle/dokument';
import { dokumentAusTeilen, teileBauen } from '@shared/protokolle/speicher';
import { STANDARD_VORLAGEN, startDokument } from '@shared/protokolle/vorlagen';
import { EDITOR_TYPEN, schema } from './editorSchema';
import { ProtokollAnsicht } from './ProtokollAnsicht';

/**
 * **Tests gegen den Erzeuger** (Bauplan S1/S4-1): Was der Editor aus einem Protokoll macht, muss die Ableitung,
 * der Speicher und die Lese-Ansicht verstehen – geprüft mit dem echten BlockNote-Editor und unserem Schema, nicht
 * mit handgeschriebenen Literalen.
 */
type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const editorMit = (dok: readonly Block[]) =>
  BlockNoteEditor.create({ schema, initialContent: dok as Teil[] });

const PROTOKOLL: Block[] = [
  { id: 'p1', type: 'heading', props: { level: 1 }, content: 'Andacht' },
  { id: 'x1', type: 'paragraph', content: 'Römer 12' },
  { id: 'p2', type: 'heading', props: { level: 1 }, content: 'Gemeindeleben' },
  {
    id: 'l1',
    type: 'bulletListItem',
    content: 'Haupt',
    children: [
      {
        id: 'l2',
        type: 'numberedListItem',
        content: 'Unter',
        children: [{ id: 'l3', type: 'bulletListItem', content: 'ganz tief' }],
      },
    ],
  },
  { id: 'b1', type: 'beschluss', content: 'Ab November monatlich' },
  { id: 'a1', type: 'aufgabe', props: { aufgabe: 'todo-1' }, content: 'Termine eintragen' },
  { id: 't1', type: 'termin', props: { datum: '2026-12-24' }, content: 'Heiligabend' },
  { id: 'v1', type: 'verweis', props: { art: 'letztes-protokoll' } },
  { id: 'q1', type: 'quote', content: 'Zitat' },
  { id: 'd1', type: 'divider' },
];

describe('Editor-Schema gegen Ableitung, Speicher und Ansicht', () => {
  it('eigene Blöcke behalten ihre Daten – die Ableitung findet alles wieder', () => {
    const doc = editorMit(PROTOKOLL).document as Block[];
    expect(ableiten(doc)).toEqual(ableiten(PROTOKOLL));
    const a = ableiten(doc);
    expect(a.aufgaben[0].aufgabe).toBe('todo-1');
    expect(a.termine[0].datum).toBe('2026-12-24');
    expect(doc.find((b) => b.id === 'v1')?.props?.art).toBe('letztes-protokoll');
  });

  it('gespeichert, neu geladen und wieder im Editor: unverändert', () => {
    const doc = editorMit(PROTOKOLL).document as Block[];
    const { stand, werte } = teileBauen(doc, 's1');
    const zurueck = dokumentAusTeilen(
      { sitzung: 's1', stand },
      werte.map((w) => JSON.parse(w)),
    );
    expect(zurueck).toEqual(doc);
    expect(editorMit(zurueck!).document).toEqual(doc);
  });

  it('der Editor kennt jede Blockart, die er selbst und die Vorlagen erzeugen', () => {
    const doc = editorMit(PROTOKOLL).document as Block[];
    expect(fremdeTypen(doc, EDITOR_TYPEN)).toEqual([]);
    let n = 0;
    for (const v of STANDARD_VORLAGEN)
      expect(
        fremdeTypen(
          startDokument(v, () => `v${n++}`),
          EDITOR_TYPEN,
        ),
      ).toEqual([]);
  });

  it('Markieren im Editor erscheint in der Lese-Ansicht als Markierung', () => {
    const e = editorMit([{ id: 'm', type: 'paragraph', content: 'ganz wichtig' }]);
    e.setTextCursorPosition('m', 'start');
    e.updateBlock('m', {
      content: [{ type: 'text', text: 'ganz wichtig', styles: { backgroundColor: 'yellow' } }],
    });
    render(<ProtokollAnsicht dokument={e.document as Block[]} />);
    expect(screen.getByText('ganz wichtig').closest('mark')).not.toBeNull();
  });
});
