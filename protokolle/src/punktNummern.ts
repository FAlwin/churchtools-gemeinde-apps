import { createExtension } from '@blocknote/core';
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { ableiten, punktNummer, type Block } from '@shared/protokolle/dokument';

/**
 * **Die Nummern im Editor** (Bauplan K3b) – `4.` vor dem Tagesordnungspunkt, `4.1` … `4.1.1.1.1` vor dem Unterpunkt.
 * Bis K3a zählte hier ein CSS-Zähler neben `ableiten` her; mit Unterpunkten (Ebene höchstens eine unter der davor,
 * Stufe 3 = „Überschrift“ ohne Nummer) hätte er eine zweite, abweichende Zählung gebraucht. Darum liest der Editor
 * dieselbe Ableitung wie Lese-Ansicht, Bereiche und Suche und schreibt die Nummer als `data-nummer` und als Variable
 * `--punkt-nummer` an den Block (`DokumentEditor.scss` zeigt sie).
 */

type Doc = EditorState['doc'];

/** Die oberste Ebene des Editor-Dokuments, so knapp wie `ableiten` sie für die Nummern braucht – mit Lage im Text. */
function obersteEbene(doc: Doc): {
  bloecke: Block[];
  lage: Map<string, { von: number; bis: number }>;
} {
  const bloecke: Block[] = [];
  const lage = new Map<string, { von: number; bis: number }>();
  const gruppe = doc.firstChild;
  // Dokument → Blockgruppe (Inhalt ab 1) → Blockhülle (`offset`) → Blockinhalt (eine Stelle weiter).
  gruppe?.forEach((huelle, offset) => {
    const inhalt = huelle.firstChild;
    const id: unknown = huelle.attrs.id;
    if (!inhalt || typeof id !== 'string') return;
    bloecke.push({ id, type: inhalt.type.name, props: { level: inhalt.attrs.level as unknown } });
    const von = 1 + offset + 1;
    lage.set(id, { von, bis: von + inhalt.nodeSize });
  });
  return { bloecke, lage };
}

function nummern(doc: Doc): DecorationSet {
  const { bloecke, lage } = obersteEbene(doc);
  const deko = ableiten(bloecke).punkte.flatMap((p) => {
    const l = lage.get(p.blockId);
    const nr = punktNummer(p);
    // `attr()` liest im CSS nur am Element selbst – die Überschrift liegt eine Ebene tiefer, darum zusätzlich als
    // Variable, die sie erbt (Nummern sind nur Ziffern und Punkte).
    return l
      ? [Decoration.node(l.von, l.bis, { 'data-nummer': nr, style: `--punkt-nummer: "${nr}"` })]
      : [];
  });
  return DecorationSet.create(doc, deko);
}

const SCHLUESSEL = new PluginKey<DecorationSet>('protokoll-punkt-nummern');

/** Hängt am Überschrift-Block (`editorSchema.ts`). */
export const punktNummern = createExtension({
  key: 'protokoll-punkt-nummern',
  prosemirrorPlugins: [
    new Plugin<DecorationSet>({
      key: SCHLUESSEL,
      state: {
        init: (_, s) => nummern(s.doc),
        apply: (tr, alt) => (tr.docChanged ? nummern(tr.doc) : alt),
      },
      props: { decorations: (s) => SCHLUESSEL.getState(s) },
    }),
  ],
});
