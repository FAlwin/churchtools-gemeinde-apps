import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { flushSync } from 'react-dom';
import type { DrawTool } from '../types/index';
import { DEFAULT_TEXT_STYLE, type TextStyle, type usePageDraw } from './usePageDraw';
import { useKeyboardInsets } from './useKeyboardInsets';
import { useLatestRef } from './useLatestRef';

type PageDraw = ReturnType<typeof usePageDraw>;

interface UseTextEingabeParams {
  /** Wird beim Tippen über die Tastatur angehoben (iPhone). */
  rootRef: MutableRefObject<HTMLDivElement | null>;
  /** Anmerkungs-Zustand je Fläche – beim Blättern zwei (Querformat), auf der Rolle eine. */
  draws: PageDraw[];
  /** Text-Ebene je Fläche (dort wird getippt und gemessen). */
  layerRefs: MutableRefObject<HTMLDivElement | null>[];
  drawMode: boolean;
  drawTool: DrawTool;
  drawColor: string;
  /** Wie viele Flächen nebeneinander stehen (2 = Querformat beim Blättern). */
  perView: number;
  activeSlot: number;
  pageIndex: number;
  onActivePage: (page: number) => void;
}

/**
 * **Textfelder auf einer Fläche: platzieren, tippen, übernehmen, Größe ziehen** – herausgelöst aus
 * `PageDeck` (#608), damit die Rolle des Scroll-Modus DIESELBE Bedienung bekommt statt einer Kopie.
 *
 * Unverändert übernommen: Inline-Eingabe mit Cursor an der Tippstelle (Fokus SYNCHRON in der Geste,
 * sonst öffnet iOS keine Tastatur), Sperre gegen doppeltes Übernehmen (Blur + Tipp im selben Moment),
 * Tipp neben einer offenen Eingabe übernimmt sie, Tipp ins Leere hebt eine Auswahl auf, Zieh-Knopf
 * am Auswahlrahmen, beim Verlassen des Malmodus keine Auswahl stehen lassen, und im Querformat nur
 * auf der aktiven Seite (#53).
 */
export function useTextEingabe({
  rootRef,
  draws,
  layerRefs,
  drawMode,
  drawTool,
  drawColor,
  perView,
  activeSlot,
  pageIndex,
  onActivePage,
}: UseTextEingabeParams) {
  // Inline-Texteingabe direkt auf der Seite (blinkender Cursor statt separater Leiste).
  const editRefs = useRef<(HTMLSpanElement | null)[]>(draws.map(() => null));
  const textCommitLock = useRef<boolean[]>(draws.map(() => false)); // gegen Doppel-Commit (Blur + Tipp)
  // Zieh-Knopf am Auswahlrahmen: Startgröße + Start-Y + Ebenenhöhe für die Größenänderung.
  const resizeDrag = useRef<{
    slot: number;
    id: number;
    startY: number;
    startSize: number;
    layerH: number;
  } | null>(null);
  const [textSize, setTextSize] = useState(1.5); // cqh = % der Seitenhöhe (~13 pt, nahe der Liedtext-Größe)
  // Aktueller „Pinsel"-Stil für NEU platzierten Text (bei ausgewähltem Text wirken die Format-
  // Knöpfe direkt auf das Objekt via dr_.setStyle). Startet normal & mittig (DEFAULT_TEXT_STYLE).
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const drawsRef = useLatestRef(draws);

  // Offene Inline-Eingabe eines Slots übernehmen (leerer Text = verwerfen). Lock verhindert
  // Doppel-Commit, wenn Blur UND Außen-Tipp im selben Moment feuern.
  function commitInlineText(slot: number) {
    const d = draws[slot];
    if (!d.pending || textCommitLock.current[slot]) return;
    textCommitLock.current[slot] = true;
    const el = editRefs.current[slot];
    // innerText (nicht textContent) → erhält Zeilenumbrüche als \n; nur Ränder trimmen,
    // interne Umbrüche/Abstände bleiben erhalten.
    const value = (el?.innerText ?? '')
      .replace(/\u00A0/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
    d.confirmText(value, drawColor, textSize, textStyle);
  }
  const commitRef = useLatestRef(commitInlineText);

  // Beim Text-Bearbeiten die iOS-Tastatur „vermeiden" (nur den Chart-Bereich anheben) – ausgelagert
  // in useKeyboardInsets. preLiftForEditor wird synchron in der Tipp-Geste (focusEditor) genutzt.
  const pendingSlot = Math.max(
    0,
    draws.findIndex((d) => d.pending),
  );
  const anyPending = draws.some((d) => d.pending);
  const { preLiftForEditor } = useKeyboardInsets({ rootRef, editRefs, anyPending, pendingSlot });

  // Inline-Eingabe fokussieren + Cursor ans Ende. MUSS synchron in der Tipp-Geste passieren,
  // damit iOS die Tastatur öffnet (asynchroner Fokus per setTimeout wird von iOS ignoriert).
  function focusEditor(slot: number) {
    const el = editRefs.current[slot];
    if (!el) return;
    // VOR dem Fokus den Chart-Bereich anheben (gelernte Tastaturhöhe) – Details im Hook.
    preLiftForEditor(slot);
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  // Text platzieren (Tipp mit Text-Werkzeug auf leere Stelle der Seite) → blinkender Cursor
  // direkt an der Stelle (Inline-Eingabe wie in Word/GoodNotes).
  function layerDown(e: React.PointerEvent, slot: number) {
    if (!drawMode || drawTool !== 'text') return;
    // #53: Text nur auf der aktiven Seite – Tipp auf die inaktive Seite aktiviert sie nur.
    if (perView === 2 && slot !== activeSlot) {
      e.stopPropagation();
      onActivePage(pageIndex + slot);
      return;
    }
    const layer = layerRefs[slot].current;
    if (!layer) return;
    e.stopPropagation();
    const d = draws[slot];
    // Offene Inline-Eingabe? → Tipp daneben übernimmt den Text (steht dann fest), kein neues Feld.
    if (d.pending) {
      commitInlineText(slot);
      return;
    }
    // Ist ein Text ausgewählt? → Tipp ins Leere hebt die Auswahl auf (Rahmen weg), kein neues Feld.
    if (d.selectedId !== null) {
      d.setSelectedId(null);
      return;
    }
    const rect = layer.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    // flushSync → die Inline-Eingabe wird SOFORT (synchron) eingehängt, danach fokussieren wir
    // noch innerhalb der Tipp-Geste → iOS öffnet die Tastatur.
    flushSync(() => d.placeText(fx, fy, e.clientX, e.clientY));
    focusEditor(slot);
  }

  // Zieh-Knopf am Auswahlrahmen: Größe des ausgewählten Textes per Ziehen ändern.
  function handleResizeDown(e: React.PointerEvent, slot: number, id: number, size: number) {
    e.stopPropagation();
    const layer = layerRefs[slot].current;
    if (!layer) return;
    draws[slot].pushHistory();
    resizeDrag.current = {
      slot,
      id,
      startY: e.clientY,
      startSize: size,
      layerH: layer.clientHeight,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handleResizeMove(e: React.PointerEvent) {
    const r = resizeDrag.current;
    if (!r || r.layerH <= 0) return;
    e.stopPropagation();
    // Ziehen nach unten = größer: Y-Weg in % der Seitenhöhe direkt auf die cqh-Größe addieren.
    const next = r.startSize + ((e.clientY - r.startY) / r.layerH) * 100;
    draws[r.slot].setSize(r.id, next);
  }
  function handleResizeUp(e: React.PointerEvent) {
    if (!resizeDrag.current) return;
    e.stopPropagation();
    resizeDrag.current = null;
  }

  // Anmerkungsmodus verlassen → Text-Auswahl aufheben. Sonst bliebe der gestrichelte Rahmen des
  // zuletzt bearbeiteten Textes stehen (er hängt an selectedId) und verschwände erst beim
  // nächsten Seitenwechsel.
  useEffect(() => {
    if (!drawMode) for (const d of drawsRef.current) d.setSelectedId(null);
  }, [drawMode, drawsRef]);

  // Wechselt die AKTIVE Hälfte (2-up), darf auf der nun inaktiven keine Auswahl/Eingabe
  // zurückbleiben – sonst stehen Auswahlrahmen auf beiden Seiten gleichzeitig. Eine offene
  // Inline-Eingabe dort wird zuerst übernommen (nichts geht verloren).
  useEffect(() => {
    if (perView !== 2) return;
    const other = activeSlot === 0 ? 1 : 0;
    if (drawsRef.current[other]?.pending) commitRef.current(other);
    drawsRef.current[other]?.setSelectedId(null);
  }, [activeSlot, perView, drawsRef, commitRef]);

  // Lock wieder freigeben, sobald sich eine Eingabe geöffnet oder geschlossen hat.
  const offen = draws.map((d) => (d.pending ? '1' : '0')).join('');
  const vorher = useRef(offen);
  useEffect(() => {
    for (let i = 0; i < offen.length; i++) {
      if (offen[i] !== vorher.current[i]) textCommitLock.current[i] = false;
    }
    vorher.current = offen;
  }, [offen]);

  return {
    editRefs,
    textSize,
    setTextSize,
    textStyle,
    setTextStyle,
    commitInlineText,
    focusEditor,
    layerDown,
    handleResizeDown,
    handleResizeMove,
    handleResizeUp,
  };
}
