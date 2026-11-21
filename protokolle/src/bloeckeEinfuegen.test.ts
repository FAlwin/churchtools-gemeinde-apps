// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { schema, type ProtokollEditor } from './editorSchema';
import { bloeckeEinfuegen, einfuegungenAusfuehren } from './bloeckeEinfuegen';
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

describe('einfuegungenAusfuehren (W12 – Ersetzen in EINER Transaktion)', () => {
  const li = (id: string, t: string, children: Block[] = []): Block => ({
    id,
    type: 'bulletListItem',
    content: [{ type: 'text', text: t, styles: {} }],
    children,
  });
  const baustein = (id: string, t: string): Block => ({
    id,
    type: 'beschluss',
    content: [{ type: 'text', text: t, styles: {} }],
    children: [],
  });
  // Gliederung als Text: Einrückung durch „>“.
  const form = (bs: readonly { id: string; children: readonly unknown[] }[], tiefe = 0): string[] =>
    bs.flatMap((b) => [
      `${'>'.repeat(tiefe)}${b.id}`,
      ...form(b.children as { id: string; children: unknown[] }[], tiefe + 1),
    ]);
  const dok = (): Block[] => [
    A,
    li('z1', 'Eins'),
    li('z2', 'Zwei', [li('z3', 'Drei')]),
    B,
    leer('L'),
  ];

  it('ersetzen: Baustein an der Stelle der Zeile, Zeile weg – auch eingerückt, auf gleicher Ebene', () => {
    const e = editorMit(dok());
    einfuegungenAusfuehren(e, [{ vor: 'z3', bloecke: [baustein('n1', 'Neu')], entfernen: ['z3'] }]);
    expect(form(e.document)).toEqual(['A', 'z1', 'z2', '>n1', 'B', 'L']);
  });

  it('ersetzen oberste Ebene und nach einer Zeile', () => {
    const e = editorMit(dok());
    einfuegungenAusfuehren(e, [
      { vor: 'z1', bloecke: [baustein('n1', 'Neu')], entfernen: ['z1'] },
      { vor: null, nach: 'z3', bloecke: [baustein('n2', 'Danach')] },
    ]);
    expect(form(e.document)).toEqual(['A', 'n1', 'z2', '>z3', '>n2', 'B', 'L']);
  });

  it('eine Zeile mit Unterblöcken wird nie entfernt – auch wenn der Plan es verlangt', () => {
    const e = editorMit(dok());
    einfuegungenAusfuehren(e, [{ vor: 'z2', bloecke: [baustein('n1', 'Neu')], entfernen: ['z2'] }]);
    expect(form(e.document)).toEqual(['A', 'z1', 'n1', 'z2', '>z3', 'B', 'L']);
  });

  it('Block für „nach“ oder „entfernen“ fehlt: ans Ende (vor die Schlusszeile), nichts wird angefasst', () => {
    const e = editorMit(dok());
    einfuegungenAusfuehren(e, [
      { vor: null, nach: 'weg', bloecke: [baustein('n1', 'Neu')], entfernen: ['auch-weg'] },
    ]);
    expect(form(e.document)).toEqual(['A', 'z1', 'z2', '>z3', 'B', 'n1', 'L']);
  });

  it('ein einziges Rückgängig macht die ganze Übernahme rückgängig', () => {
    const e = editorMit(dok());
    const vorher = JSON.stringify(e.document);
    einfuegungenAusfuehren(e, [
      { vor: 'z1', bloecke: [baustein('n1', 'Neu')], entfernen: ['z1'] },
      { vor: null, nach: 'z3', bloecke: [baustein('n2', 'Danach')] },
      { vor: null, bloecke: [baustein('n3', 'Ende')] },
    ]);
    expect(JSON.stringify(e.document)).not.toBe(vorher);
    e.undo();
    expect(JSON.stringify(e.document)).toBe(vorher);
  });
});
