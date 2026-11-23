/** Was `ohneVerlauf` vom Editor braucht – der echte BlockNote-Editor passt, Tests geben einen Nachbau. */
export interface VerlaufsfreierEditor {
  transact(aendern: (tr: { setMeta(schluessel: string, wert: unknown): unknown }) => void): unknown;
}

/**
 * **Eine Änderung, die NICHT im Rückgängig-Verlauf landet** – für das, was der Editor von selbst erledigt: Aufgaben-IDs
 * vergeben (S4-2, `aufgabenIdsSetzen`) und die übernommene Vorab-Wahl aus dem Block nehmen (K1, `AufgabeBlock`).
 *
 * Läge so etwas im Verlauf, nähme „Rückgängig“ es zurück – und der Editor setzte es sofort wieder, als neuen Schritt.
 * Rückgängig dreht sich dann im Kreis und kommt nie an frühere Eingaben heran. So beim Handtest TF-PROT-29 am 23.11.2026:
 * Nach „Mit KI füllen“ mit einem To-Do (Wer/Bis kommen als Vorab-Wahl) ging gar nichts mehr zurück, auch nicht vorher
 * Getipptes. Die Aufgaben-IDs hatten die Regel seit dem 24.10.2026, die Vorab-Wahl nicht – darum EINE Stelle.
 */
export function ohneVerlauf(editor: VerlaufsfreierEditor, aendern: () => void): void {
  editor.transact((tr) => {
    tr.setMeta('addToHistory', false);
    aendern();
  });
}
