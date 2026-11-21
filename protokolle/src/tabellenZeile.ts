import { createExtension, getNodeById } from '@blocknote/core';
import { Plugin, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PmKnoten } from 'prosemirror-model';
import { artDesTextes, umschalten, type ZeilenArt } from '@shared/protokolle/tabellenZeile';
import type { ProtokollEditor } from './editorSchema';

/**
 * **Unterzeile und „nur zur Info“ im Editor** (W13, Alwin 21.11.2026) – die Regel steht in
 * `shared/protokolle/tabellenZeile.ts` (Text-Präfix „↳ “ / „ⓘ “ in der ersten Zelle der Zeile). Hier hängen die Bedienung
 * und die Darstellung daran:
 * - **Tab** am Anfang der ersten Zelle einer Zeile setzt „↳ “ (Unterzeile), **Umschalt+Tab** dort nimmt es weg. „Am Anfang“
 *   heißt: der Cursor steht vor dem eigentlichen Zelltext (auch hinter einem schon gesetzten Präfix) – so macht Umschalt+Tab
 *   gleich danach das Tab rückgängig. Überall sonst bleibt Tab, was es war: in die nächste Zelle (BlockNote,
 *   `TableExtension.ts`; dort antwortet Tab IMMER mit `true`, damit nichts versehentlich einrückt).
 * - Das Zeilenmenü der Tabelle bietet „Nur zur Info“ und „Als Unterzeile“ (`TabellenZeilenMenue.tsx`) – beides ruft
 *   `zeileUmschalten`.
 * - **Darstellung:** eine Dekoration am `tableRow` (Klasse) und eine am Zeichen selbst – CSS auf einen Text-Präfix gibt es
 *   nicht, ein Plugin schon (`DokumentEditor.scss`).
 */

/** Die Klassen, die das Plugin den Zeilen und Zeichen gibt – `DokumentEditor.scss` stylt sie. */
export const KLASSE = {
  unterZeile: 'protokoll-zeile-unter',
  infoZeile: 'protokoll-zeile-info',
  unterZeichen: 'protokoll-zeichen-unter',
  infoZeichen: 'protokoll-zeichen-info',
} as const;

/** Der Text einer Zelle (Zeilenumbrüche als `\n`) – Zeichen für Zeichen die Stellen des Dokuments. */
const zellText = (absatz: PmKnoten): string =>
  absatz.textBetween(0, absatz.content.size, undefined, '\n');

/** Der erste Absatz der ersten Zelle einer Zeile: wo sein Text im Dokument beginnt und was darin steht. */
export interface ErsteZelle {
  start: number;
  text: string;
}

/** Die erste Zelle der Zeile `zeile` in der Tabelle mit dieser Block-ID – `null`, wenn es sie nicht gibt. */
export function ersteZelleDerZeile(
  state: EditorState,
  blockId: string,
  zeile: number,
): ErsteZelle | null {
  const treffer = getNodeById(blockId, state.doc);
  const tabelle = treffer?.node.firstChild;
  if (!treffer || tabelle?.type.name !== 'table' || zeile < 0 || zeile >= tabelle.childCount)
    return null;
  // Block (offen) → Tabelle (offen) → die Zeilen davor → Zeile (offen) → Zelle (offen) → Absatz (offen)
  let pos = treffer.posBeforeNode + 1 + 1;
  for (let i = 0; i < zeile; i++) pos += tabelle.child(i).nodeSize;
  const absatz = tabelle.child(zeile).firstChild?.firstChild;
  if (!absatz) return null;
  return { start: pos + 1 + 1 + 1, text: zellText(absatz) };
}

/** Der Cursor steht in der ersten Zelle einer Zeile: dann ihr Text und der Cursor darin; sonst `null`. */
function ersteZelleMitCursor(state: EditorState): (ErsteZelle & { cursor: number }) | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const $p = selection.$from;
  if ($p.parent.type.name !== 'tableParagraph') return null;
  // Absatz (Tiefe d) → Zelle (d-1) → Zeile (d-2): die Zelle ist die erste, wenn sie das erste Kind der Zeile ist.
  if ($p.index($p.depth - 2) !== 0) return null;
  return { start: $p.start(), text: zellText($p.parent), cursor: $p.parentOffset };
}

/**
 * Das Präfix am Anfang des Zelltextes so ändern, dass der Text danach `neuerText` heißt – nur der Anfang wird ersetzt, der
 * Rest bleibt mit seinen Auszeichnungen. Gibt die Länge des neuen Präfixes zurück.
 */
function praefixSetzen(tr: Transaction, z: ErsteZelle, neuerText: string): number {
  const alt = artDesTextes(z.text).laenge;
  const vorsatz = neuerText.slice(0, artDesTextes(neuerText).laenge);
  if (vorsatz) tr.insertText(vorsatz, z.start, z.start + alt);
  else tr.delete(z.start, z.start + alt);
  return vorsatz.length;
}

/**
 * **Eines der beiden Kennzeichen an der Zeile umschalten** (Zeilenmenü) – `true`, wenn es danach gesetzt ist. `zeile` ist
 * die Zeile der Tabelle mit dieser Block-ID; ein Rückgängig macht genau das zurück.
 */
export function zeileUmschalten(
  editor: ProtokollEditor,
  blockId: string,
  zeile: number,
  welches: keyof ZeilenArt,
): boolean {
  const z = ersteZelleDerZeile(editor.prosemirrorState, blockId, zeile);
  if (!z) return false;
  const neu = umschalten(z.text, welches);
  editor.transact((tr) => {
    praefixSetzen(tr, z, neu);
  });
  return artDesTextes(neu).art[welches];
}

/** Tab (`1`) bzw. Umschalt+Tab (`-1`) am Anfang der ersten Zelle – `true`, wenn die Taste hier uns gehörte. */
export function tabAmZeilenanfang(editor: ProtokollEditor, richtung: 1 | -1): boolean {
  const z = ersteZelleMitCursor(editor.prosemirrorState);
  if (!z) return false;
  const { art, laenge } = artDesTextes(z.text);
  if (z.cursor > laenge) return false;
  // Eine leere erste Zelle: Dort landet Tab beim Springen durch die Tabelle (BlockNote setzt den Cursor leer in die Zelle) –
  // das Springen bleibt, wie es war. Die Zeile einrücken geht dann übers Zeilenmenü.
  if (richtung > 0 && !z.text) return false;
  // Tab auf einer schon eingerückten Zeile und Umschalt+Tab auf einer nicht eingerückten springen wie bisher zur Zelle.
  if (richtung > 0 ? art.unter : !art.unter) return false;
  const neu = umschalten(z.text, 'unter');
  editor.transact((tr) => {
    const laengeNeu = praefixSetzen(tr, z, neu);
    tr.setSelection(TextSelection.create(tr.doc, z.start + laengeNeu));
  });
  return true;
}

/** Die Dekorationen aller Tabellenzeilen mit Kennzeichen: Klasse an der Zeile, Klasse an jedem Zeichen. */
export function zeilenDekoration(doc: PmKnoten): DecorationSet {
  const liste: Decoration[] = [];
  doc.descendants((knoten, pos) => {
    if (knoten.type.name !== 'tableRow') return true;
    const absatz = knoten.firstChild?.firstChild;
    if (!absatz) return false;
    const { art } = artDesTextes(zellText(absatz));
    if (!art.unter && !art.info) return false;
    const klassen = [art.unter ? KLASSE.unterZeile : '', art.info ? KLASSE.infoZeile : ''];
    liste.push(
      Decoration.node(pos, pos + knoten.nodeSize, { class: klassen.filter(Boolean).join(' ') }),
    );
    // Absatz-Anfang: Zeile (offen) + Zelle (offen) + Absatz (offen) = pos + 3; jedes Zeichen zählt eine Stelle. Das
    // Leerzeichen dahinter gehört zur Dekoration: `white-space: nowrap` hält Zeichen und Leerzeichen zusammen, damit in einer
    // schmalen Zelle nicht „↳“ allein in einer Zeile steht.
    let stelle = pos + 3;
    if (art.unter) {
      liste.push(Decoration.inline(stelle, stelle + 2, { class: KLASSE.unterZeichen }));
      stelle += 2;
    }
    if (art.info) liste.push(Decoration.inline(stelle, stelle + 2, { class: KLASSE.infoZeichen }));
    return false;
  });
  return DecorationSet.create(doc, liste);
}

/** Tab, Umschalt+Tab und die Darstellung der Kennzeichen (hängt am Überschrift-Block, `editorSchema.ts`). */
export const tabellenZeile = createExtension({
  key: 'protokoll-tabellen-zeile',
  keyboardShortcuts: {
    Tab: ({ editor }) => tabAmZeilenanfang(editor as ProtokollEditor, 1),
    'Shift-Tab': ({ editor }) => tabAmZeilenanfang(editor as ProtokollEditor, -1),
  },
  prosemirrorPlugins: [
    new Plugin({
      state: {
        init: (_, state) => zeilenDekoration(state.doc),
        apply: (tr, alt) => (tr.docChanged ? zeilenDekoration(tr.doc) : alt),
      },
      props: {
        decorations(state) {
          return this.getState(state);
        },
      },
    }),
  ],
});
