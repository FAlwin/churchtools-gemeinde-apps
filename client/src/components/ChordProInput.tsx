import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Compartment, EditorState, RangeSetBuilder, StateField } from '@codemirror/state';
import { EditorView, Decoration, ViewPlugin, WidgetType, keymap } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import {
  history,
  historyKeymap,
  defaultKeymap,
  undo,
  redo,
  undoDepth,
  redoDepth,
} from '@codemirror/commands';
import styles from './ChordProInput.module.scss';
import {
  abschnittsKopf,
  flowEintraege,
  flowName,
  parseChordPro,
  parseMetadata,
  teileImFlow,
} from '../utils/chordpro';

/** Imperative Schnittstelle für Toolbar-Aktionen (Einfügen / Rückgängig / Wiederholen). */
export interface ChordProHandle {
  /** Fügt Text an der Cursorposition ein. `block` = auf eigener Zeile; `caretBack` = Cursor n Zeichen vor das Ende. */
  insert: (text: string, opts?: { block?: boolean; caretBack?: number }) => void;
  /** Hängt `suffix` an den zuletzt gesetzten Akkord an (steht der Cursor direkt hinter `[…]`,
   *  wird der Zusatz VOR das `]` eingefügt, z. B. `[C]` + "m7" → `[Cm7]`). Sonst ohne Wirkung. */
  appendChord: (suffix: string) => void;
  /** Ersetzt `from`–`to` durch `insert` – wie eine Eingabe (Rückgängig), ohne den Cursor zu stehlen (L2: Ablauf-Kärtchen). */
  aendern: (from: number, to: number, insert: string) => void;
  undo: () => void;
  redo: () => void;
}

const chordMark = Decoration.mark({ class: 'cm-cp-chord' });
const dirMark = Decoration.mark({ class: 'cm-cp-dir' });
const dirValMark = Decoration.mark({ class: 'cm-cp-dir-val' });

/** Färbt Akkorde [X] und Direktiven {…} ein (regex-basiert über die sichtbaren Bereiche).
 *  Direktiven mit Wert (z. B. `{title: Treu}`) werden aufgeteilt: das Label `{title:` bleibt
 *  dezent teal, der eigentliche Wert (Titel/Artist/…) wird kräftig und gut lesbar dargestellt. */
function buildDeco(view: EditorView): DecorationSet {
  const marks: { from: number; to: number; deco: Decoration }[] = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let m: RegExpExecArray | null;
    const chordRe = /\[[^\]\n]*\]/g;
    while ((m = chordRe.exec(text)))
      marks.push({ from: from + m.index, to: from + m.index + m[0].length, deco: chordMark });
    const dirRe = /\{[^}\n]*\}/g;
    while ((m = dirRe.exec(text))) {
      const start = from + m.index;
      const end = start + m[0].length;
      const colon = m[0].indexOf(':');
      // Direktive mit Wert → Label + Wert getrennt einfärben; sonst ganze Direktive teal.
      if (colon !== -1 && start + colon + 1 < end - 1) {
        marks.push({ from: start, to: start + colon + 1, deco: dirMark }); // `{title:`
        marks.push({ from: start + colon + 1, to: end - 1, deco: dirValMark }); // ` Treu`
        marks.push({ from: end - 1, to: end, deco: dirMark }); // `}`
      } else {
        marks.push({ from: start, to: end, deco: dirMark });
      }
    }
  }
  marks.sort((a, b) => a.from - b.from);
  const builder = new RangeSetBuilder<Decoration>();
  for (const mk of marks) builder.add(mk.from, mk.to, mk.deco);
  return builder.finish();
}

const highlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDeco(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = buildDeco(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

/**
 * **Die `{flow: …}`-Zeile ist im Text unsichtbar** (Lied-Editor L2, 22.10.2026): Den Ablauf bearbeitet man
 * über die Kärtchen; im Text stünde sie nur doppelt. Sie bleibt im ChordPro (gespeichert wird Zeichen für
 * Zeichen); der Cursor springt über sie hinweg.
 */
const FLOW_ZEILE = /^\s*\{flow[:\s][^}]*\}\s*$/i;
function flowAusblenden(state: EditorState): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    if (!FLOW_ZEILE.test(line.text)) continue;
    // Samt Zeilenende, sonst bliebe eine leere Zeile stehen (am Textende das davor).
    if (n < state.doc.lines) b.add(line.from, line.to + 1, Decoration.replace({ block: true }));
    else if (n > 1) b.add(line.from - 1, line.to, Decoration.replace({ block: true }));
    else b.add(line.from, line.to, Decoration.replace({}));
  }
  return b.finish();
}
const flowFeld = StateField.define<DecorationSet>({
  create: (st) => flowAusblenden(st),
  update: (deko, tr) => (tr.docChanged ? flowAusblenden(tr.state) : deko),
  provide: (f) => [
    EditorView.decorations.from(f),
    EditorView.atomicRanges.of((v) => v.state.field(f)),
  ],
});

// ── Darstellung wie Entwurf B (Lied-Editor L3, 22.10.2026) ──
// Akkorde als Kärtchen, Teil-Anfänge als Band, `----` als Linie. Der Text bleibt ChordPro Zeichen für
// Zeichen; Kärtchen und Bänder sind `atomicRanges` (der Cursor springt darüber, Rücktaste löscht sie ganz –
// gemessen in L0: Chromium und Mac-Safari; das echte iPad prüft Alwin vor dem Merge).
class AkkordWidget extends WidgetType {
  constructor(readonly name: string) {
    super();
  }
  eq(o: AkkordWidget) {
    return o.name === this.name;
  }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-cp-akkord';
    s.textContent = this.name;
    return s;
  }
}
class BandWidget extends WidgetType {
  constructor(
    readonly name: string,
    readonly zusatz: string,
  ) {
    super();
  }
  eq(o: BandWidget) {
    return o.name === this.name && o.zusatz === this.zusatz;
  }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-cp-band-zeile';
    const band = document.createElement('span');
    band.className = 'cm-cp-band';
    band.textContent = this.name;
    s.append(band);
    if (this.zusatz) {
      const z = document.createElement('span');
      z.className = 'cm-cp-band-zusatz';
      z.textContent = this.zusatz;
      s.append(z);
    }
    return s;
  }
}
class HaltWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-cp-halt';
    s.textContent = 'Pedal hält hier';
    return s;
  }
}

/** Wie oft jeder Teil im Ablauf steht – nach derselben Regel wie das Blatt (`teileImFlow`); ohne Ablauf `null`. */
function ablaufZaehlung(text: string): Map<string, number> | null {
  const flow = parseMetadata(text).flow;
  if (flowEintraege(flow).length === 0) return null;
  const n = new Map<string, number>();
  for (const t of teileImFlow(parseChordPro(text), flow).teile) {
    const k = flowName(t.label);
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return n;
}

function darstellungDeko(state: EditorState): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const zaehlung = ablaufZaehlung(state.doc.toString());
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    const kopf = abschnittsKopf(line.text);
    if (kopf && line.length > 0) {
      const n = zaehlung?.get(flowName(kopf.label)) ?? 0;
      const zusatz = !zaehlung ? '' : n === 0 ? 'nicht im Ablauf' : `${n}× im Ablauf`;
      b.add(line.from, line.to, Decoration.replace({ widget: new BandWidget(kopf.label, zusatz) }));
      continue;
    }
    if (/^\s*-{4,}\s*$/.test(line.text)) {
      b.add(line.from, line.to, Decoration.replace({ widget: new HaltWidget() }));
      continue;
    }
    const re = /\[([^\]\n]*)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line.text)))
      b.add(
        line.from + m.index,
        line.from + m.index + m[0].length,
        Decoration.replace({ widget: new AkkordWidget(m[1]) }),
      );
  }
  return b.finish();
}
const darstellungFeld = StateField.define<DecorationSet>({
  create: (st) => darstellungDeko(st),
  update: (deko, tr) => (tr.docChanged ? darstellungDeko(tr.state) : deko),
  provide: (f) => [
    EditorView.decorations.from(f),
    EditorView.atomicRanges.of((v) => v.state.field(f)),
  ],
});
/** Umschaltbar: freundliche Darstellung oder der rohe ChordPro-Text („ChordPro-Text“-Schalter). */
const darstellung = new Compartment();

// Moderner, „un-typewriter"-Look: proportionale App-Schrift (ChordPro-Akkorde stehen inline in
// [..], daher ist kein Monospace zum Ausrichten nötig), großzügige Zeilenhöhe, und Akkorde als
// dezente farbige Chips – dadurch wirkt der Text ruhig UND die Struktur springt sofort ins Auge.
const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--surface2)', color: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--ui)',
    // Ziffern/Buchstaben in Akkorden gleich breit halten → Chips wirken ruhig.
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-content': {
    padding: '18px 18px 32px',
    fontSize: '16px',
    lineHeight: '1.95',
    caretColor: 'var(--blue)',
  },
  // Akkorde [C] als kompakter Chip mit zartem Hintergrund.
  '.cm-cp-chord': {
    color: 'var(--blue-ink)',
    fontWeight: '800',
    backgroundColor: 'var(--blue-soft)',
    borderRadius: 'var(--r-ctrl)',
    padding: '1px 4px',
    margin: '0 1px',
  },
  // Direktiven-Label {title: dezent, Wert kräftig lesbar.
  '.cm-cp-dir': { color: 'var(--cp-dir)', fontWeight: '700' },
  '.cm-cp-dir-val': { color: 'var(--text)', fontWeight: '800' },
  // L3: Akkord-Kärtchen, Band je Teil, Pedal-Halt.
  '.cm-cp-akkord': {
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 2px',
    borderRadius: 'var(--r-ctrl)',
    background: 'var(--blue-tile)',
    color: 'var(--blue-tile-text)',
    fontWeight: '700',
    fontSize: '13px',
    lineHeight: '22px',
  },
  '.cm-cp-band-zeile': { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  '.cm-cp-band': {
    padding: '0 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-ctrl)',
    background: 'var(--section)',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    lineHeight: '24px',
  },
  '.cm-cp-band-zusatz': { fontSize: '12px', color: 'var(--text2)' },
  '.cm-cp-halt': { fontSize: '12px', color: 'var(--text2)' },
  '.cm-cursor': { borderLeftColor: 'var(--blue)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--blue-soft)',
  },
});

interface ChordProInputProps {
  initialText: string;
  onChange: (text: string) => void;
  onHistory?: (canUndo: boolean, canRedo: boolean) => void;
  /** Den rohen ChordPro-Text zeigen statt Kärtchen und Bändern (L3). */
  roh?: boolean;
}

/** ChordPro-Eingabe auf Basis von CodeMirror: Syntax-Farben, echtes Rückgängig/Wiederholen,
 *  saubere Einfügung an der Cursorposition. */
export const ChordProInput = forwardRef<ChordProHandle, ChordProInputProps>(function ChordProInput(
  { initialText, onChange, onHistory, roh = false },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const view = new EditorView({
      state: EditorState.create({
        doc: initialText,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          highlighter,
          darstellung.of(roh ? [] : darstellungFeld),
          flowFeld,
          theme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString());
            if (u.docChanged || u.selectionSet)
              onHistory?.(undoDepth(u.state) > 0, redoDepth(u.state) > 0);
          }),
        ],
      }),
      parent: hostRef.current as HTMLElement,
    });
    viewRef.current = view;
    onHistory?.(false, false);
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Umschalten zwischen Kärtchen und rohem Text – ohne den Editor neu zu bauen (Verlauf, Cursor bleiben).
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: darstellung.reconfigure(roh ? [] : darstellungFeld),
    });
  }, [roh]);

  useImperativeHandle(ref, () => ({
    insert(text, opts) {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      let ins = text;
      if (opts?.block) {
        const before = sel.from > 0 ? view.state.doc.sliceString(sel.from - 1, sel.from) : '\n';
        if (before !== '\n') ins = '\n' + ins;
        if (!ins.endsWith('\n')) ins = ins + '\n';
      }
      const caret = sel.from + ins.length - (opts?.caretBack ?? 0);
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: ins },
        selection: { anchor: caret },
      });
      view.focus();
    },
    appendChord(suffix) {
      const view = viewRef.current;
      if (!view || !suffix) return;
      const sel = view.state.selection.main;
      if (sel.from !== sel.to || sel.from === 0) return; // Auswahl/Anfang → nichts anhängen
      const doc = view.state.doc;
      const line = doc.lineAt(sel.from);
      const before = doc.sliceString(line.from, sel.from);
      if (!before.endsWith(']')) return; // Cursor steht nicht direkt hinter einem Akkord
      const open = before.lastIndexOf('[');
      if (open === -1) return;
      const inner = before.slice(open + 1, -1); // Inhalt zwischen [ und ]
      if (inner.includes('[') || inner.includes(']')) return; // kein sauberes [..]
      const insertPos = sel.from - 1; // direkt vor das ]
      view.dispatch({
        changes: { from: insertPos, insert: suffix },
        selection: { anchor: sel.from + suffix.length },
      });
      view.focus();
    },
    aendern(from, to, insert) {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ changes: { from, to, insert }, userEvent: 'input.ablauf' });
    },
    undo() {
      const v = viewRef.current;
      if (v) {
        undo(v);
        v.focus();
      }
    },
    redo() {
      const v = viewRef.current;
      if (v) {
        redo(v);
        v.focus();
      }
    },
  }));

  return <div ref={hostRef} className={styles.host} />;
});
