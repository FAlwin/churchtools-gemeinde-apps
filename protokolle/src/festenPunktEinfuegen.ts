import type { IconName } from '@ui/icons/icons';
import type { VerweisArt } from '@shared/protokolle/dokument';
import { FESTE_PUNKTE } from './anzeige';
import type { ProtokollEditor } from './editorSchema';

/** Feste Punkte (S4-3a) – Knöpfe in der Leiste, Einträge im „/“-Menü. */
export const FESTE: readonly { art: VerweisArt; icon: IconName }[] = [
  { art: 'offene-aufgaben', icon: 'todo-liste' },
  { art: 'letztes-protokoll', icon: 'dokument' },
];

/**
 * **Einen festen Punkt einfügen** (S4-3a): Tagesordnungspunkt mit seinem Titel, darunter der Punkt und eine leere Zeile
 * für Notizen. Er kommt hinter den Block auf oberster Ebene, in dem man steht – ein Tagesordnungspunkt ist nie
 * eingerückt. Steht man in einer leeren Zeile (etwa nach „/“), tritt er an ihre Stelle.
 */
export function festenPunktEinfuegen(editor: ProtokollEditor, art: VerweisArt): void {
  let hier = editor.getTextCursorPosition().block;
  for (let p = editor.getParentBlock(hier); p; p = editor.getParentBlock(hier)) hier = p;
  const neu = [
    {
      type: 'heading' as const,
      props: { level: 1 as const },
      content: FESTE_PUNKTE[art].titel,
    },
    { type: 'verweis' as const, props: { art } },
    { type: 'paragraph' as const },
  ];
  const leer =
    hier.type === 'paragraph' &&
    !hier.children.length &&
    (!Array.isArray(hier.content) || hier.content.length === 0);
  const bloecke = leer
    ? editor.replaceBlocks([hier], neu).insertedBlocks
    : editor.insertBlocks(neu, hier, 'after');
  editor.setTextCursorPosition(bloecke[2], 'start');
  editor.focus();
}
