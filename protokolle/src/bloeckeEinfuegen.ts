import type { PartialBlock } from '@blocknote/core';
import { vorSchlusszeilen, type Block } from '@shared/protokolle/dokument';
import type { ProtokollEditor, schema } from './editorSchema';

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

/**
 * **Blöcke ins Protokoll einfügen** (`EditorGriff.einfuegen` – übernommene Vorschläge S5-4, „Mit KI füllen“ S8-2): vor
 * den Block `vor` (oberste Ebene). Ohne Ziel – oder wenn es den Block nicht mehr gibt – ans Ende, und zwar **vor die
 * leere(n) Schlusszeile(n)** (`vorSchlusszeilen`, Fund aus TF-PROT-12): sonst stünde eine Leerzeile davor.
 */
export function bloeckeEinfuegen(
  editor: ProtokollEditor,
  bloecke: readonly Block[],
  vor: string | null,
): void {
  const schluss = vorSchlusszeilen(editor.document);
  const ziel =
    (vor !== null ? editor.getBlock(vor) : undefined) ??
    (schluss !== null ? editor.getBlock(schluss) : undefined);
  if (ziel) editor.insertBlocks(bloecke as Teil[], ziel, 'before');
  else editor.insertBlocks(bloecke as Teil[], editor.document[editor.document.length - 1], 'after');
}
