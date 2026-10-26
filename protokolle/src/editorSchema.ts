import {
  BlockNoteSchema,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  type BlockNoteEditor,
} from '@blocknote/core';
import { createExtension } from '@blocknote/core';
import { createReactBlockSpec } from '@blocknote/react';
import { BLOCK } from '@shared/protokolle/dokument';
import { aufgabenIdsVergeben } from '@shared/protokolle/aufgaben';
import { AufgabeBlock, BeschlussBlock, TerminBlock, VerweisBlock } from './EditorBloecke';

/**
 * **Was im Protokoll-Editor stehen kann** (Bauplan S4-1, BlockNote 0.56): Text, Überschrift 1–3 (Stufe 1 = Tagesordnungs-
 * punkt), Aufzählung, Nummerierung, Checkliste, Zitat, Trennlinie – und unsere eigenen Blöcke aus `BLOCK`.
 *
 * Bewusst **nicht** dabei: Bilder, Videos, Dateien, Code, Tabellen. Die Lese-Ansicht und das PDF zeigen sie nicht, und
 * was der Editor annimmt, aber keine Ansicht zeigt, wäre still verschwunden. (Tabellen aus Word kommen als Text an.)
 *
 * Die eigenen Blöcke tragen ihre Daten in `props` wie in `@shared/protokolle/dokument`; Aufgabe und Termin werden seit
 * S4-2 bedient (`EditorBloecke.tsx`), die festen Punkte (Verweis) seit S4-3a. **„[] “ + Leertaste macht eine Aufgabe**
 * (Alwin 24.10.2026, wie Entwurf 7) – die Regel läuft vor der von BlockNotes Checkliste, die Checkliste gibt es weiter
 * über Textart und „/“-Menü.
 */

const aufgabeKuerzel = createExtension({
  key: 'protokoll-aufgabe-kuerzel',
  runsBefore: ['check-list-item-shortcuts'],
  inputRules: [{ find: /^\s?\[\s*\]\s$/, replace: () => ({ type: BLOCK.aufgabe, props: {} }) }],
});

const aufgabeBlock = createReactBlockSpec(
  { type: BLOCK.aufgabe, propSchema: { aufgabe: { default: '' } }, content: 'inline' },
  { render: AufgabeBlock },
  [aufgabeKuerzel],
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
  {
    type: BLOCK.verweis,
    // `fest`: was der Punkt bei der Freigabe zeigte (JSON, `festePunkteFesthalten`) – leer = live (S4-3a).
    propSchema: { art: { default: 'offene-aufgaben' }, fest: { default: '' } },
    content: 'none',
  },
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

/**
 * **Aufgaben-IDs im Editor setzen** (S4-2, Regel `aufgabenIdsVergeben`): neue, kopierte oder aus einer anderen Sitzung
 * eingefügte Aufgaben bekommen eine eigene ID – so gibt es das To-Do schon, wenn jemand gleich „Wer?“ wählt.
 * **Nicht im Rückgängig-Verlauf** (beim Durchklicken 24.10.2026 gefunden): sonst nähme „Rückgängig“ die ID wieder weg,
 * die Aufgabe bekäme eine neue, und ihr To-Do (mit Wer/Bis/Status) wäre als gelöscht vermerkt. `true`, wenn gesetzt wurde.
 */
export function aufgabenIdsSetzen(
  editor: ProtokollEditor,
  fremd: (id: string) => boolean,
  neueId: () => string = () => crypto.randomUUID(),
): boolean {
  const ids = aufgabenIdsVergeben(editor.document, fremd, neueId);
  if (!ids.length) return false;
  editor.transact((tr) => {
    tr.setMeta('addToHistory', false);
    for (const x of ids) editor.updateBlock(x.blockId, { props: { aufgabe: x.aufgabe } });
  });
  return true;
}
