import type { DefaultReactSuggestionItem } from '@blocknote/react';
import { BLOCK } from '@shared/protokolle/dokument';
import { Icon } from '@ui/icons/icons';
import type { ProtokollEditor } from './editorSchema';
import type { ReiheKontextWert } from './themenreiheKontext';

/**
 * **Eine Reihe einfügen** (Baustein „Reihe“): Leiste („Einfügen“) und „/“-Menü öffnen **zuerst das Fenster** „Neue Reihe“ –
 * der Block entsteht erst, wenn die Reihe gespeichert ist (`ReiheKontextWert.neu`). So bleibt nichts Leeres im Dokument
 * zurück, wenn man das Fenster schließt, und der Selbstspeicher sieht nie einen Block ohne Reihe. Eingefügt wird **neu**,
 * nicht per Typwechsel: Der Block hat keinen Text (`content: 'none'`), ein Umwandeln verlöre den Absatz.
 */

/** Den Block hinter die Stelle setzen, an der man stand (`hier` = ihre Block-ID); eine leere Zeile tritt er an. */
export function reiheEinfuegen(
  editor: ProtokollEditor,
  reiheId: string,
  hier: string | null,
): void {
  const ziel =
    (hier ? editor.getBlock(hier) : undefined) ??
    editor.getTextCursorPosition().block ??
    editor.document[editor.document.length - 1];
  const neu = [
    { type: BLOCK.themenreihe, props: { reihe: reiheId } },
    { type: 'paragraph' as const },
  ] as const;
  const leer =
    ziel.type === 'paragraph' &&
    !ziel.children.length &&
    (!Array.isArray(ziel.content) || ziel.content.length === 0);
  const bloecke = leer
    ? editor.replaceBlocks([ziel], [...neu]).insertedBlocks
    : editor.insertBlocks([...neu], ziel, 'after');
  editor.setTextCursorPosition(bloecke[1], 'start');
  editor.focus();
}

/** „Reihe“ aus Leiste und „/“-Menü: nur, wo man bauen darf; öffnet das Fenster, der Block folgt nach dem Speichern. */
export function reiheAnbieten(editor: ProtokollEditor, k: ReiheKontextWert | null): void {
  if (!k?.darfBauen) return;
  const hier = editor.getTextCursorPosition().block.id;
  k.neu((id) => reiheEinfuegen(editor, id, hier));
}

/** Der Eintrag im „/“-Menü – leer, wo man keine Reihe bauen darf. */
export function reiheImMenue(
  editor: ProtokollEditor,
  k: ReiheKontextWert | null,
): DefaultReactSuggestionItem[] {
  if (!k?.darfBauen) return [];
  return [
    {
      title: 'Reihe',
      subtext: 'Themenreihe planen und in die Infos der Events übertragen',
      aliases: ['reihe', 'themenreihe', 'predigtreihe', 'serie', 'events'],
      group: 'Protokoll',
      icon: <Icon name="liste" size={18} />,
      onItemClick: () => reiheAnbieten(editor, k),
    },
  ];
}
