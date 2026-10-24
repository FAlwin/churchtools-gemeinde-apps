import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  Compartment,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from '@codemirror/state';
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
  AKKORD_KLAMMER,
  ENDE_ZEILE,
  abschnittsKopf,
  flowEintraege,
  flowName,
  parseChordPro,
  parseMetadata,
  teileImFlow,
} from '../utils/chordpro';
import { LIEDINFO_ZEILE, TONART_ZEILE } from '@shared/ct/liedinfo';

/** Imperative Schnittstelle für Toolbar-Aktionen (Einfügen / Rückgängig / Wiederholen). */
export interface ChordProHandle {
  /**
   * Fügt Text an der Cursorposition ein. `block` = auf eigener Zeile; `caretBack` = Cursor n Zeichen vor das Ende;
   * `amZeilenende` = hinter der Zeile, in der der Cursor steht, statt sie zu teilen (neuer Teil, L6).
   */
  insert: (
    text: string,
    opts?: { block?: boolean; caretBack?: number; amZeilenende?: boolean },
  ) => void;
  /** Ersetzt `from`–`to` durch `insert` – wie eine Eingabe (Rückgängig), ohne den Cursor zu stehlen (L2: Ablauf-Kärtchen, L5-2: Akkord-Menü). */
  aendern: (from: number, to: number, insert: string) => void;
  undo: () => void;
  redo: () => void;
  /** Das angetippte Kärtchen hervorheben (L5-2) – `null` nimmt die Markierung weg. */
  markieren: (bereich: { von: number; bis: number } | null) => void;
  /** Wo auf dem Bildschirm die Stelle `pos` steht (L5-2: Menü am verschobenen Kärtchen) – `null`, wenn unsichtbar. */
  stelle: (pos: number) => { x: number; y: number; oben: number } | null;
}

/** Ein angetipptes Akkord-Kärtchen (L5-2): Stelle im Text samt Klammern und Platz auf dem Bildschirm. */
export interface AkkordAntippen {
  von: number;
  bis: number;
  name: string;
  x: number;
  /** Unterkante und Oberkante des Kärtchens – das Menü steht darunter, ist dort kein Platz, darüber. */
  y: number;
  oben: number;
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
/** Ganze Zeilen unsichtbar machen (Flow-Zeile, L2; Liedinfo-Kopfzeilen, L4) – der Cursor springt darüber. */
function zeilenAusblenden(state: EditorState, muster: RegExp): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    if (!muster.test(line.text)) continue;
    // Samt Zeilenende, sonst bliebe eine leere Zeile stehen (am Textende das davor).
    if (n < state.doc.lines) b.add(line.from, line.to + 1, Decoration.replace({ block: true }));
    else if (n > 1) b.add(line.from - 1, line.to, Decoration.replace({ block: true }));
    else b.add(line.from, line.to, Decoration.replace({}));
  }
  return b.finish();
}
function ausblendFeld(muster: RegExp) {
  return StateField.define<DecorationSet>({
    create: (st) => zeilenAusblenden(st, muster),
    update: (deko, tr) => (tr.docChanged ? zeilenAusblenden(tr.state, muster) : deko),
    provide: (f) => [
      EditorView.decorations.from(f),
      EditorView.atomicRanges.of((v) => v.state.field(f)),
    ],
  });
}
const flowFeld = ausblendFeld(FLOW_ZEILE);
/**
 * **Liedinfo-Kopfzeilen** (`{title}`, `{artist}` … – L4): Die Liedinfo zeigt sie, beim Speichern wandern sie nach
 * ChurchTools. Im Text stünden sie doppelt; im „ChordPro-Text“ bleiben sie sichtbar. Dieselbe Grammatik wie das
 * Entfernen (`LIEDINFO_ZEILE`). Seit L6 auch `{key}` (`TONART_ZEILE`) – sie bleibt in der Datei, Kopf und
 * Akkord-Leiste nennen die Tonart aber schon (Alwin, 24.10.2026).
 */
const kopfFeld = ausblendFeld(
  new RegExp(`(?:${LIEDINFO_ZEILE.source})|(?:${TONART_ZEILE.source})`, 'i'),
);
const kopf = new Compartment();

// ── Darstellung wie Entwurf B (Lied-Editor L3, 22.10.2026) ──
// Akkorde als Kärtchen, Teil-Anfänge als Band, `----` als Linie. Der Text bleibt ChordPro Zeichen für
// Zeichen; Kärtchen und Bänder sind `atomicRanges` (der Cursor springt darüber, Rücktaste löscht sie ganz –
// gemessen in L0: Chromium und Mac-Safari; das echte iPad prüft Alwin vor dem Merge).
class AkkordWidget extends WidgetType {
  constructor(
    readonly name: string,
    readonly aktiv = false,
  ) {
    super();
  }
  eq(o: AkkordWidget) {
    return o.name === this.name && o.aktiv === this.aktiv;
  }
  // Den Tipp aufs Kärtchen an den Editor durchreichen (L5-2: Menü) – ohne das schluckt CodeMirror ihn.
  ignoreEvent(e: Event) {
    return e.type !== 'mousedown';
  }
  toDOM() {
    const s = document.createElement('span');
    s.className = this.aktiv ? 'cm-cp-akkord cm-cp-aktiv' : 'cm-cp-akkord';
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

/**
 * L5-2: das angetippte Kärtchen (sein Menü ist offen) – es wird umrahmt. Eine Markierung um das Kärtchen zeichnet
 * CodeMirror nicht (ersetzte Bereiche verdecken sie, gemessen 23.10.2026); deshalb weiß das Kärtchen es selbst.
 */
const aktivSetzen = StateEffect.define<{ von: number; bis: number } | null>();
const aktivFeld = StateField.define<{ von: number; bis: number } | null>({
  create: () => null,
  update(wert, tr) {
    for (const e of tr.effects) if (e.is(aktivSetzen)) return e.value;
    return wert && tr.docChanged
      ? { von: tr.changes.mapPos(wert.von, 1), bis: tr.changes.mapPos(wert.bis, -1) }
      : wert;
  },
});

function darstellungDeko(state: EditorState): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const aktiv = state.field(aktivFeld, false);
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
    const re = new RegExp(AKKORD_KLAMMER, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(line.text)))
      b.add(
        line.from + m.index,
        line.from + m.index + m[0].length,
        Decoration.replace({
          widget: new AkkordWidget(m[1], aktiv?.von === line.from + m.index),
        }),
      );
  }
  return b.finish();
}
const darstellungFeld = StateField.define<DecorationSet>({
  create: (st) => darstellungDeko(st),
  update: (deko, tr) =>
    tr.docChanged || tr.effects.some((e) => e.is(aktivSetzen)) ? darstellungDeko(tr.state) : deko,
  provide: (f) => [
    EditorView.decorations.from(f),
    EditorView.atomicRanges.of((v) => v.state.field(f)),
  ],
});
/**
 * **Ende-Marken `{end_of_…}`** (L6): Das Band markiert den Anfang eines Teils, das Ende ergibt sich aus dem nächsten
 * Band – im Text unsichtbar, im „ChordPro-Text“ sichtbar (Alwin, 24.10.2026). Dieselbe Regel wie das Blatt.
 */
const endeFeld = ausblendFeld(ENDE_ZEILE);
/** Umschaltbar: freundliche Darstellung (samt ausgeblendeter Ende-Marken) oder der rohe ChordPro-Text. */
const darstellung = new Compartment();
const freundlich = [darstellungFeld, endeFeld];

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
  '.cm-cp-akkord.cm-cp-aktiv': {
    outline: '2px solid var(--blue)',
    outlineOffset: '1px',
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
  /** Ein Akkord-Kärtchen wurde angetippt (L5-2) – der Cursor bleibt, wo er war. */
  onAkkord?: (a: AkkordAntippen) => void;
  /** Der Text bekommt oder verliert den Fokus (Schreibansicht bei offener Tastatur). */
  onFokus?: (fokus: boolean) => void;
  /** Liedinfo-Kopfzeilen ausblenden – die Liedinfo zeigt sie (L4). Im rohen Text bleiben sie sichtbar. */
  kopfAusblenden?: boolean;
}

/** ChordPro-Eingabe auf Basis von CodeMirror: Syntax-Farben, echtes Rückgängig/Wiederholen,
 *  saubere Einfügung an der Cursorposition. */
export const ChordProInput = forwardRef<ChordProHandle, ChordProInputProps>(function ChordProInput(
  { initialText, onChange, onHistory, roh = false, onAkkord, onFokus, kopfAusblenden = false },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Der Editor wird nur einmal gebaut – der Rückruf kommt deshalb über einen Ref an die jeweils neueste Fassung.
  const onAkkordRef = useRef(onAkkord);
  onAkkordRef.current = onAkkord;
  const onFokusRef = useRef(onFokus);
  onFokusRef.current = onFokus;

  useEffect(() => {
    const view = new EditorView({
      state: EditorState.create({
        doc: initialText,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          highlighter,
          // Vor der Darstellung: Sie liest beim Neuzeichnen, welches Kärtchen angetippt ist.
          aktivFeld,
          darstellung.of(roh ? [] : freundlich),
          flowFeld,
          kopf.of(kopfAusblenden && !roh ? kopfFeld : []),
          theme,
          EditorView.lineWrapping,
          EditorView.domEventHandlers({
            // Tipp auf ein Kärtchen: Menü statt Cursor (sonst landet der Cursor davor oder dahinter).
            mousedown(e, v) {
              const el = (e.target as HTMLElement | null)?.closest?.('.cm-cp-akkord');
              if (!el || !onAkkordRef.current) return false;
              // Bereich und Name genau so, wie die Darstellung das Kärtchen gesetzt hat – kein eigenes Muster.
              const pos = v.posAtDOM(el);
              const treffer: { von: number; bis: number; name: string }[] = [];
              v.state.field(darstellungFeld, false)?.between(pos, pos + 1, (von, bis, deko) => {
                const w = (deko.spec as { widget?: unknown }).widget;
                if (w instanceof AkkordWidget && von === pos)
                  treffer.push({ von, bis, name: w.name });
              });
              if (!treffer[0]) return false;
              e.preventDefault();
              const r = el.getBoundingClientRect();
              onAkkordRef.current({ ...treffer[0], x: r.left, y: r.bottom, oben: r.top });
              return true;
            },
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString());
            if (u.focusChanged) onFokusRef.current?.(u.view.hasFocus);
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
      effects: [
        darstellung.reconfigure(roh ? [] : freundlich),
        kopf.reconfigure(kopfAusblenden && !roh ? kopfFeld : []),
      ],
    });
  }, [roh, kopfAusblenden]);

  useImperativeHandle(ref, () => ({
    insert(text, opts) {
      const view = viewRef.current;
      if (!view) return;
      const auswahl = view.state.selection.main;
      // Hinter die Zeile des Cursors: nichts ersetzen, nichts teilen.
      const ende = opts?.amZeilenende ? view.state.doc.lineAt(auswahl.head).to : null;
      const sel = ende == null ? auswahl : { from: ende, to: ende };
      let ins = text;
      let vorne = 0;
      if (opts?.block) {
        const before = sel.from > 0 ? view.state.doc.sliceString(sel.from - 1, sel.from) : '\n';
        if (before !== '\n') {
          ins = '\n' + ins;
          vorne = 1;
        }
        if (!ins.endsWith('\n')) ins = ins + '\n';
      }
      // `caretBack` zählt vom Ende des übergebenen TEXTS, nicht vom angehängten Zeilenumbruch: Sonst landete der
      // Cursor bei `{capo: }` hinter der Klammer statt davor (Test-Instanz, 24.10.2026 – im Format-Menü schon so).
      const caret =
        opts?.caretBack != null
          ? sel.from + vorne + text.length - opts.caretBack
          : sel.from + ins.length;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: ins },
        selection: { anchor: caret },
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
    markieren(bereich) {
      viewRef.current?.dispatch({ effects: aktivSetzen.of(bereich) });
    },
    stelle(pos) {
      const k = viewRef.current?.coordsAtPos(pos, 1);
      return k ? { x: k.left, y: k.bottom, oben: k.top } : null;
    },
  }));

  return <div ref={hostRef} className={styles.host} />;
});
