// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { schema, type ProtokollEditor } from './editorSchema';
import { einfuegungenAusfuehren } from './bloeckeEinfuegen';
import { einhaengen } from './editorTest.testutil';
import { ohneVerlauf } from './ohneVerlauf';

/**
 * `ohneVerlauf` gegen den echten BlockNote-Editor – der Ablauf aus TF-PROT-29 (23.11.2026): tippen, „Mit KI füllen“
 * übernimmt ein To-Do mit Vorab-Wahl (Wer/Bis), der Editor nimmt die Wahl danach von selbst heraus. Rückgängig muss dann
 * erst die Übernahme und danach das Getippte zurücknehmen.
 */

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const VORAB = JSON.stringify({ wer: [7], extern: '', bis: '2026-11-30' });
const todo: Block = {
  id: 'n1',
  type: 'aufgabe',
  props: { aufgabe: 't1', vorab: VORAB },
  content: [{ type: 'text', text: 'Eishalle anfragen', styles: {} }],
  children: [],
};

function ablauf(aufraeumen: (e: ProtokollEditor) => void) {
  const e = einhaengen(
    BlockNoteEditor.create({
      schema,
      initialContent: [
        { id: 'p', type: 'paragraph', content: 'Text' },
        { id: 'z1', type: 'bulletListItem', content: 'Eins' },
        { id: 'L', type: 'paragraph' },
      ] as Teil[],
    }),
  );
  e.updateBlock('p', { content: 'Text getippt' });
  const getippt = JSON.stringify(e.document);
  einfuegungenAusfuehren(e, [{ vor: 'z1', bloecke: [todo], entfernen: ['z1'] }]);
  aufraeumen(e);
  expect(e.getBlock('n1')?.props).toMatchObject({ vorab: '' });
  return { e, getippt };
}

describe('ohneVerlauf – Haushalt des Editors bleibt aus dem Rückgängig-Verlauf', () => {
  it('Vorab-Wahl herausnehmen: Rückgängig nimmt die KI-Übernahme zurück, dann das Getippte', () => {
    const { e, getippt } = ablauf((x) =>
      ohneVerlauf(x, () => x.updateBlock('n1', { props: { vorab: '' } })),
    );
    expect(e.undo()).toBe(true);
    expect(e.getBlock('n1')).toBeUndefined();
    expect(JSON.stringify(e.document)).toBe(getippt);
    expect(e.undo()).toBe(true);
    expect(JSON.stringify(e.getBlock('p')?.content)).toContain('"Text"');
    expect(JSON.stringify(e.getBlock('p')?.content)).not.toContain('getippt');
  });

  it('Gegenstück: im Verlauf nähme Rückgängig nur das Herausnehmen zurück (der Kreis aus TF-PROT-29)', () => {
    const { e } = ablauf((x) => x.updateBlock('n1', { props: { vorab: '' } }));
    expect(e.undo()).toBe(true);
    // Die Übernahme steht noch da – nur die Wahl ist zurück; der Block nähme sie sofort wieder heraus.
    expect(e.getBlock('n1')?.props).toMatchObject({ vorab: VORAB });
  });
});
