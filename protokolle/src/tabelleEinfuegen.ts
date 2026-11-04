import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core';
import type { ProtokollEditor } from './editorSchema';

/** Drei Spalten, eine Kopfzeile und zwei Zeilen darunter – Zeilen und Spalten kommen über die Griffe an der Tabelle dazu. */
const SPALTEN = 3;
const ZEILEN = 3;

/**
 * **Eine Tabelle einfügen** (K3a) – EINE Stelle für Leiste („Einfügen ▾“) und „/“-Menü. BlockNotes eigener
 * „/“-Eintrag fügt eine Tabelle ohne Kopfzeile ein; er steht deshalb nicht im Menü.
 *
 * Wie bei „/“: Eine leere Zeile wird zur Tabelle, sonst kommt sie dahinter. Steht man in einem Block ohne Text (fester
 * Punkt, Trennlinie), kommt sie ebenfalls dahinter – BlockNotes Hilfsfunktion würfe dort einen Fehler.
 */
export function tabelleEinfuegen(editor: ProtokollEditor): void {
  const tabelle = {
    type: 'table' as const,
    content: {
      type: 'tableContent' as const,
      headerRows: 1,
      rows: Array.from({ length: ZEILEN }, () => ({
        cells: Array.from({ length: SPALTEN }, () => ''),
      })),
    },
  };
  const hier = editor.getTextCursorPosition().block;
  if (hier.content === undefined) {
    const [neu] = editor.insertBlocks([tabelle], hier, 'after');
    editor.setTextCursorPosition(neu, 'start');
  } else {
    insertOrUpdateBlockForSlashMenu(editor, tabelle);
  }
  editor.focus();
}
