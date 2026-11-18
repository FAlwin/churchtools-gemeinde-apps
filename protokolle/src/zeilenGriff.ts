import type { ProtokollEditor } from './editorSchema';

/**
 * **Welche Blöcke im Text einen Griff haben** (W7, Alwin 18.11.2026) – und was er zieht.
 *
 * Tagesordnungspunkte und Unterpunkte stellt man im Fenster „Punkte ordnen“ um; das Ziehen im Text „landete falsch, war
 * hakelig, ließ offen, was passiert“. Darum hat eine **Überschrift gar keinen Griff**. Ein Griff ohne Ziehen und mit einem
 * Menü nur aus „Löschen“ (das Entf/Rücktaste auch kann) wäre ein Knopf, der aussieht wie der alte und nicht tut, was er
 * verspricht – genau das „Hakelige“. Normaler Text hat ohnehin keinen (Alwin 22.10.2026); Listen, Zitate, Tabellen und
 * die eigenen Blöcke behalten Griff und Menü.
 */
export function hatGriff(art: string | undefined): boolean {
  return !!art && art !== 'paragraph' && art !== 'heading';
}

/**
 * **Wenn die Markierung eine Überschrift enthält, zieht der Griff nur seine eigene Zeile.** BlockNote zieht beim Ziehen am
 * Griff eines Blocks innerhalb einer Mehrfach-Markierung die GANZE Markierung – war darin eine Überschrift, wäre sie so
 * doch im Text verschoben worden. Darum wird die Markierung vor dem Ziehen auf die Zeile am Griff verengt. Eine Markierung
 * ohne Überschrift bleibt (mehrere Listenzeilen zieht man weiter gemeinsam).
 */
export function nurDieseZeile(editor: ProtokollEditor, id: string): void {
  const markiert = editor.getSelection()?.blocks;
  if (!markiert?.some((b) => b.type === 'heading')) return;
  try {
    editor.setTextCursorPosition(id, 'start');
  } catch {
    // Den Block gibt es nicht mehr – dann zieht BlockNote ohnehin nichts.
  }
}
