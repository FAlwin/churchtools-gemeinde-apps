import {
  BlockNoteSchema,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  type BlockNoteEditor,
} from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { BLOCK } from '@shared/protokolle/dokument';
import { AufgabeBlock, BeschlussBlock, TerminBlock, VerweisBlock } from './EditorBloecke';

/**
 * **Was im Protokoll-Editor stehen kann** (Bauplan S4-1, BlockNote 0.56): Text, Überschrift 1–3 (Stufe 1 = Tagesordnungs-
 * punkt), Aufzählung, Nummerierung, Checkliste, Zitat, Trennlinie – und unsere eigenen Blöcke aus `BLOCK`.
 *
 * Bewusst **nicht** dabei: Bilder, Videos, Dateien, Code, Tabellen. Die Lese-Ansicht und das PDF zeigen sie nicht, und
 * was der Editor annimmt, aber keine Ansicht zeigt, wäre still verschwunden. (Tabellen aus Word kommen als Text an.)
 *
 * Die eigenen Blöcke halten in S4-1 nur ihre Daten fest (`props` wie in `@shared/protokolle/dokument`), damit ein
 * Protokoll mit Aufgaben, Beschlüssen, Terminen und festen Punkten beim Speichern nichts verliert. Bearbeiten mit Wer/Bis,
 * Datum und Liste der offenen To-Dos kommt in S4-2 und S4-3.
 */

const aufgabeBlock = createReactBlockSpec(
  { type: BLOCK.aufgabe, propSchema: { aufgabe: { default: '' } }, content: 'inline' },
  { render: AufgabeBlock },
);

const beschlussBlock = createReactBlockSpec(
  { type: BLOCK.beschluss, propSchema: {}, content: 'inline' },
  { render: BeschlussBlock },
);

const terminBlock = createReactBlockSpec(
  { type: BLOCK.termin, propSchema: { datum: { default: '' } }, content: 'inline' },
  { render: TerminBlock },
);

const verweisBlock = createReactBlockSpec(
  { type: BLOCK.verweis, propSchema: { art: { default: 'offene-aufgaben' } }, content: 'none' },
  { render: VerweisBlock },
);

const { paragraph, bulletListItem, numberedListItem, checkListItem, quote, divider } =
  defaultBlockSpecs;

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph,
    heading: createHeadingBlockSpec({ levels: [1, 2, 3], allowToggleHeadings: false }),
    bulletListItem,
    numberedListItem,
    checkListItem,
    quote,
    divider,
    [BLOCK.aufgabe]: aufgabeBlock(),
    [BLOCK.beschluss]: beschlussBlock(),
    [BLOCK.termin]: terminBlock(),
    [BLOCK.verweis]: verweisBlock(),
  },
});

export type ProtokollEditor = BlockNoteEditor<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

/** Die Blockarten, die der Editor kennt – für `fremdeTypen` (nichts öffnen, was er beim Speichern verlöre). */
export const EDITOR_TYPEN: ReadonlySet<string> = new Set(Object.keys(schema.blockSpecs));
