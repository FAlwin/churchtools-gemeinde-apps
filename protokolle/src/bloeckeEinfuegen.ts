import type { PartialBlock } from '@blocknote/core';
import { vorSchlusszeilen, type Block } from '@shared/protokolle/dokument';
import type { Einfuegung } from '@shared/protokolle/ki';
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

/**
 * **Mehrere Einfügungen auf einmal – in EINER Transaktion** (W12, `uebernahmePlanen`): Ein „Rückgängig“ macht die ganze
 * Übernahme aus „Mit KI füllen“ zurück. Je Einfügung:
 * - `nach`: hinter diesen Block (Geschwister) – gibt es ihn nicht mehr, wie ohne Ziel ans Ende;
 * - sonst `vor` wie bei `bloeckeEinfuegen` (auch ein eingerückter Block ist ein Ziel);
 * - danach `entfernen`: die ersetzten Zeilen. **Nur eine, die noch da ist und keine Unterblöcke hat** – `removeBlocks` nähme
 *   die Unterblöcke mit, und nie soll Text verloren gehen (auch dann nicht, wenn das Dokument seit dem Planen anders ist).
 */
export function einfuegungenAusfuehren(
  editor: ProtokollEditor,
  einfuegungen: readonly Einfuegung[],
): void {
  editor.transact(() => {
    for (const e of einfuegungen) {
      const hinter = e.nach !== undefined ? editor.getBlock(e.nach) : undefined;
      if (hinter) editor.insertBlocks(e.bloecke as Teil[], hinter, 'after');
      else bloeckeEinfuegen(editor, e.bloecke, e.vor);
      const weg = (e.entfernen ?? []).filter((id) => {
        const b = editor.getBlock(id);
        return b !== undefined && b.children.length === 0;
      });
      if (weg.length) editor.removeBlocks(weg);
    }
  });
}
