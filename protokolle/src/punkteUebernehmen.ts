import type { Block } from '@shared/protokolle/dokument';
import type { ProtokollEditor } from './editorSchema';

/**
 * **„Punkte ordnen“ im Editor übernehmen** (Bauplan W7) – die neue Reihenfolge der obersten Blöcke, die das Fenster
 * (`PunkteOrdnen.tsx`, Regel `@shared/protokolle/gliederung`) ausgerechnet hat, kommt ins Dokument.
 *
 * - **Ein Schritt:** alles in einem `transact` – ein Strg+Z im Editor holt die ganze Umstellung zurück, nicht jeden Zug
 *   im Fenster einzeln.
 * - **Blöcke behalten ihre IDs** (To-Dos hängen mit `props.aufgabe` an ihrer Aufgabe): Die verschobenen Blöcke werden
 *   als die Blöcke des Dokuments wieder eingesetzt, nicht neu gebaut.
 * - **Nur, was sich ändert:** Angefasst wird die Spanne vom ersten bis zum letzten Block, der seinen Platz wechselt –
 *   Text davor und dahinter bleibt unberührt.
 * - **Nur auf dem Stand, von dem das Fenster ausging:** Hat sich das Dokument inzwischen anders verändert (andere
 *   Blöcke als vorher), wird nichts angewendet (`false`) – eine veraltete Reihenfolge darf nicht Text überschreiben.
 */
export function reihenfolgeUebernehmen(
  editor: ProtokollEditor,
  reihenfolge: readonly string[],
): boolean {
  const alt: Block[] = editor.document;
  const gleicheBloecke =
    alt.length === reihenfolge.length &&
    new Set(reihenfolge).size === reihenfolge.length &&
    alt.every((b) => reihenfolge.includes(b.id));
  if (!gleicheBloecke) return false;

  let von = 0;
  while (von < alt.length && alt[von].id === reihenfolge[von]) von++;
  if (von === alt.length) return true; // nichts zu tun
  let bis = alt.length - 1;
  while (alt[bis].id === reihenfolge[bis]) bis--;

  type Teil = Parameters<ProtokollEditor['insertBlocks']>[0];
  const entfernen = alt.slice(von, bis + 1);
  const einsetzen = reihenfolge
    .slice(von, bis + 1)
    .map((id) => alt.find((b) => b.id === id)!) as unknown as Teil;
  editor.transact(() => {
    editor.replaceBlocks(entfernen, einsetzen);
  });
  return true;
}
