import type { ProtokollEditor } from './editorSchema';

/**
 * **Welche Blöcke im Text einen Griff haben** (W7, Alwin 18.11.2026) – nur noch **Tabellen**.
 *
 * Tagesordnungspunkte und Unterpunkte stellt man im Fenster „Punkte ordnen“ um; das Ziehen im Text „landete falsch, war
 * hakelig, ließ offen, was passiert“. Zuerst verloren nur Überschriften ihren Griff; nach v1.0.5 wollte Alwin auch „+“ und
 * Griff an Listen, To-Dos und Beschlüssen weg („Mach die bitte weg. Das Verschieben der Punkte nur noch über Punkte
 * ordnen“). **Tabellen behalten ihn** (Alwin, Klick-Runde 18.11.2026): Nur sein Menü schaltet Kopfzeile und Kopfspalte.
 * Einfügen geht über „Einfügen ▾“ und „/“, Löschen mit Entf/Rücktaste.
 */
export function hatGriff(art: string | undefined): boolean {
  return art === 'table';
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
