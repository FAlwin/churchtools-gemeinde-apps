import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import type { DrawTool } from '../types/index';
import { usePageDraw, type PageTextObj } from '../hooks/usePageDraw';
import { pushField } from '../services/annotations';
import { useTextEingabe } from '../hooks/useTextEingabe';
import { useSlideTransition, type SlideSlot } from '../hooks/useSlideTransition';
import { usePointerStrokes } from '../hooks/usePointerStrokes';
import { usePageNavigation } from '../hooks/usePageNavigation';
import { usePageCanvases } from '../hooks/usePageCanvases';
import { useZoomOrchestration } from '../hooks/useZoomOrchestration';
import { ZOOM_GRENZEN, type Blatt, type Flaeche } from '../utils/zoomAusschnitt';
import { useRefPair } from '../hooks/useRefPair';
import { useLandscape } from '../hooks/useLandscape';
import { eigenerSchluessel, joinKeys, splitKeys } from '../utils/pageKeys';
import { readPageTexts } from '../utils/annotationKeys';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { PageDrawToolbar } from './PageDrawToolbar';
import { PageTextLayer } from './PageTextLayer';
import { LassoEbene } from './LassoEbene';
import { SlidePanes } from './SlidePanes';
import { Spinner } from './Spinner';
import styles from './PageDeck.module.scss';
import { maltStriche } from '../utils/malwerkzeug';

// Aus der Umrechnung (#420): Dieselben Grenzen gelten beim Wiederherstellen eines Ausschnitts.
const MIN_SCALE = ZOOM_GRENZEN.min;
const MAX_SCALE = ZOOM_GRENZEN.max;

interface PageDeckProps {
  /** Fertig gerenderte Seiten (offscreen-Canvas). Der aufrufende Loader liefert sie. */
  pages: HTMLCanvasElement[];
  loading: boolean;
  error: string | null;
  /** Text unter dem Spinner während des Ladens. */
  loadingLabel: string;
  /** localStorage-Schlüssel für Anmerkungen (Striche+Text) einer Seite – oder null (nicht speicherbar). */
  drawKeyFor: (page: number) => string | null;
  /**
   * „Notizen von …"-Ansehen (Team-Notizen, PCO-Modell): Schlüssel der GERADE ANGESEHENEN fremden
   * Ebene einer Seite – null = normale eigene Anzeige. Ist ein Schlüssel gesetzt, zeigt die Seite
   * die fremde Ebene SCHREIBGESCHÜTZT statt der eigenen Anmerkungen.
   */
  viewKeyFor?: (page: number) => string | null;
  /**
   * Import-Vorschau „Zusammenführen": Während des Ansehens die EIGENE Ebene zusätzlich zeigen
   * (fremde Overlay + eigene übereinander = das Ergebnis des Zusammenführens, live).
   */
  previewOwn?: boolean;
  /** Basis-Schlüssel für den gespeicherten Zoom einer Seite (ohne Layout-Suffix – das hängt PageDeck an). */
  zoomKeyBaseFor: (page: number) => string;
  /** Optionaler Seiten-Hinweis unten rechts (z. B. „Seite 1 / 3"). null = nicht anzeigen. */
  pageLabel?: (activePage: number, pageIndex: number, pageCount: number) => string | null;

  pageIndex: number;
  onPageIndex: (i: number) => void;
  activePage: number;
  onActivePage: (i: number) => void;
  /** Tipp in die Mitte – die Chart-Ansicht blendet damit ihre Leisten aus/ein (#319). */
  onMiddleTap?: () => void;

  drawMode: boolean;
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawTool: DrawTool;
  setDrawTool: (t: DrawTool) => void;
  drawColors: string[];
  /** Erhöht sich nach einem Server-Sync der Anmerkungen → Striche/Texte/Zoom neu aus localStorage laden. */
  syncTick?: number;
  /** Meldet nach oben, ob gerade eine sichtbare Seite reingezoomt ist (für den Reset-Knopf in der Kopfleiste). */
  onZoomedChange?: (zoomed: boolean) => void;
  /** Erhöht sich, wenn der Reset-Knopf der Kopfleiste gedrückt wird → sichtbaren Zoom zurücksetzen. */
  resetZoomSignal?: number;
}

// Stabiler Default für `viewKeyFor` (kein Ansehen).
const NO_VIEW = (): string | null => null;

/**
 * Gemeinsame 2-Seiten-Engine für ChordPro-Strom (StreamView) UND hochgeladene PDFs/Bilder
 * (DocumentView). Hochformat 1 Seite, Querformat IMMER 2 Seiten nebeneinander – jede Seite ein
 * eigener Bereich mit eigenem Zoom (dauerhaft gespeichert) und vollen Anmerkungen (Stift/Marker/
 * Radierer + Textfelder + Rückgängig).
 *
 * Anmerken im 2-up (#53): Nur die AKTIVE Seite ist beschreibbar und dezent hervorgehoben; die
 * inaktive Seite ist ausgegraut und gegen Anmerkungen gesperrt. Ein Tipp auf die inaktive Seite
 * macht sie aktiv (setzt dabei keinen Strich).
 *
 * Aufgeteilt (#193): Zeichnen der Seiten → `usePageCanvases`, Text-Ebene → `PageTextLayer`,
 * Blätter-Streifen → `SlidePanes`. Hier bleiben Gesten, Blättern, Zoom-Orchestrierung und die
 * Verdrahtung der Werkzeugleiste. **Alle Hook-Prüfungen sind wieder eingeschaltet** – möglich
 * wurde das dadurch, dass die Effekte an den *Schlüsseln* der Seiten hängen statt an den je Render
 * neu erzeugten Schlüssel-Funktionen (siehe `utils/pageKeys.ts`).
 */
export function PageDeck({
  pages,
  loading,
  error,
  loadingLabel,
  drawKeyFor,
  viewKeyFor = NO_VIEW,
  previewOwn = false,
  zoomKeyBaseFor,
  pageLabel,
  pageIndex,
  onPageIndex,
  activePage,
  onActivePage,
  onMiddleTap,
  drawMode,
  drawColor,
  setDrawColor,
  drawTool,
  setDrawTool,
  drawColors,
  syncTick = 0,
  onZoomedChange,
  resetZoomSignal = 0,
}: PageDeckProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRefs = useRefPair<HTMLCanvasElement>();
  const annoRefs = useRefPair<HTMLCanvasElement>();
  // Schreibgeschützte Striche des jeweils ANDEREN Bereichs (Team-Ebene bzw. beim Team-Bearbeiten
  // die privaten) – eigene Canvas UNTER der interaktiven Anno-Canvas.
  const overlayRefs = useRefPair<HTMLCanvasElement>();
  const layerRefs = useRefPair<HTMLDivElement>();
  const transformRefs = useRefPair<ReactZoomPanPinchRef>();
  // Ausrichtung (steuert 1 vs. 2 Seiten) – inkl. Nachprüfung bei App-Rückkehr.
  const landscape = useLandscape();
  // Wird bei App-Rückkehr hochgezählt → erzwingt einen sauberen Remount der Zoom-Ebenen (steckt im
  // TransformWrapper-key), damit ein nach dem Backgrounding veralteter Zoom-Zustand aufgelöst wird.
  const [remountEpoch, setRemountEpoch] = useState(0);
  // Strichstärke je Werkzeug (Canvas-Pixel bei Renderskala 2) – einstellbar über die Werkzeugleiste.
  const [toolSizes, setToolSizes] = useState({ pen: 3, marker: 18, eraser: 26 });
  const [confirmClear, setConfirmClear] = useState(false);

  const pageCount = pages.length;
  const perView = landscape ? 2 : 1;

  // Pinch-Zoom: Speichern, Wiederherstellen und der komplette Lebenslauf einer Geste.
  /**
   * Fläche und Blatt eines Slots, gemessen am echten DOM (#420). Die Zoom-Ebene ist so groß wie die
   * Fläche (`contentStyle` 100 %), das Blatt (die Inhalts-Canvas) sitzt darin in `.pageBox` – deren
   * linke obere Ecke ist die der Ebene, also sind die `offset*`-Werte schon Ebenen-Koordinaten.
   */
  const geometrie = (j: number): { flaeche: Flaeche; blatt: Blatt } | null => {
    const flaeche = transformRefs[j].current?.instance?.wrapperComponent;
    const blatt = contentRefs[j].current;
    if (!flaeche || !blatt) return null;
    return {
      flaeche: { w: flaeche.clientWidth, h: flaeche.clientHeight },
      blatt: {
        x: blatt.offsetLeft,
        y: blatt.offsetTop,
        w: blatt.offsetWidth,
        h: blatt.offsetHeight,
      },
    };
  };

  const { paneProps, loadZoom, restoreAfterPaint } = useZoomOrchestration({
    zoomKeyBaseFor,
    pageIndex,
    perView,
    pages,
    loading,
    syncTick,
    transformRefs,
    onZoomedChange,
    resetZoomSignal,
    geometrie,
  });

  // ── Schlüssel der beteiligten Seiten ──
  // Ist für eine Seite ein Ansichts-Schlüssel gesetzt, wird DIE FREMDE Ebene (Overlay, nur lesend)
  // gezeigt und die eigene ausgeblendet. Bearbeitet wird immer nur die eigene (private) Ebene.
  const overlayKeyFor = (p: number): string | null => viewKeyFor(p);
  const viewing = (p: number): boolean => overlayKeyFor(p) != null;
  /** WIRKSAMER eigener Schlüssel: beim Ansehen ohne Vorschau wird die eigene Ebene nicht gezeigt. */
  const ownKeyFor = (p: number): string | null =>
    eigenerSchluessel(p, drawKeyFor, viewKeyFor, previewOwn);

  // Die Schlüssel selbst sind die Abhängigkeit – nicht die Funktionen, die sie liefern. Über die
  // Signatur bekommen die Arrays eine stabile Identität (Begründung in `utils/pageKeys.ts`).
  const ownSig = joinKeys([ownKeyFor(pageIndex), ownKeyFor(pageIndex + 1)]);
  const overSig = joinKeys([overlayKeyFor(pageIndex), overlayKeyFor(pageIndex + 1)]);
  const neighbourSig = joinKeys(
    Array.from({
      length: Math.max(0, Math.min(pageCount - 1, pageIndex + 3) - Math.max(0, pageIndex - 2) + 1),
    })
      .map((_, i) => Math.max(0, pageIndex - 2) + i)
      .flatMap((p) => [ownKeyFor(p), overlayKeyFor(p)]),
  );
  const ownKeys = useMemo(() => splitKeys(ownSig), [ownSig]);
  const overKeys = useMemo(() => splitKeys(overSig), [overSig]);
  const neighbourKeys = useMemo(() => splitKeys(neighbourSig), [neighbourSig]);

  // Ein Anmerkungs-Zustand je sichtbarer Seite (fixe Anzahl Hooks – Regeln der Hooks). Bewusst am
  // EIGENEN Schlüssel (nicht am wirksamen): Beim Ansehen einer fremden Ebene bleibt die eigene
  // Ebene der Bearbeitungs-Gegenstand, sie wird nur nicht angezeigt.
  const drawA = usePageDraw(drawKeyFor(pageIndex), annoRefs[0], layerRefs[0], syncTick, pushField);
  const drawB = usePageDraw(
    drawKeyFor(pageIndex + 1),
    annoRefs[1],
    layerRefs[1],
    syncTick,
    pushField,
  );
  const draws = [drawA, drawB];
  const activeSlot = Math.max(0, Math.min(perView - 1, activePage - pageIndex));
  const activeDraw = draws[activeSlot];

  // Texte des Overlay-Bereichs (nur lesend) je sichtbarem Slot – direkt aus localStorage.
  //
  // Einziges verbliebenes Disable in dieser Datei (#193, vorher 11). Grund: `syncTick` wird im
  // Rumpf nicht gelesen – er IST das Signal, dass sich der localStorage geändert hat, und genau den
  // liest der Rumpf. ESLint kann das nicht sehen und hält die Abhängigkeit für überflüssig; ohne sie
  // bliebe nach einem Server-Sync der alte Text-Stand stehen. Bewusst KEIN `useState`+`useEffect`:
  // das ergäbe einen Render mit noch altem Stand → beim Blättern blitzt der Text der Vorseite auf
  // (dieselbe Klasse Fehler wie #113).
  const overlayTexts: PageTextObj[][] = useMemo(() => {
    const out: PageTextObj[][] = [[], []];
    if (loading) return out;
    for (let j = 0; j < 2; j++) out[j] = readPageTexts<PageTextObj>(overKeys[j]);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overKeys, syncTick, loading]);

  // ── Striche zeichnen (Stift/Marker/Radierer) – Engine ausgelagert in usePointerStrokes ──
  const { strokeDown, strokeMove, strokeUp } = usePointerStrokes({
    annoRefs,
    draws,
    drawMode,
    drawTool,
    drawColor,
    toolSizes,
    perView,
    activeSlot,
    pageIndex,
    onActivePage,
  });

  // Textfelder: platzieren, tippen, übernehmen, Größe ziehen – gemeinsam mit der Rolle (#608).
  const {
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
  } = useTextEingabe({
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
  });

  // ── Effekte ──

  // Bei App-Rückkehr (iOS-PWA) kann der Container neu vermessen worden sein, ohne dass sich die
  // Ausrichtung ändert → die Zoom-Ebene bliebe mit einem veralteten Transform „stecken". Ein
  // Epoche-Hochzählen erzwingt einen sauberen Remount der Zoom-Ebenen (onInit stellt den
  // gespeicherten Zoom des aktuellen Layouts frisch her). Nur im Vordergrund. Committete Striche
  // liegen in localStorage und werden nach dem Remount neu gezeichnet – kein Datenverlust.
  // (Die Ausrichtung selbst prüft `useLandscape` bei denselben Ereignissen nach.)
  useEffect(() => {
    const bump = () => {
      if (document.visibilityState === 'hidden') return;
      setRemountEpoch((n) => n + 1);
    };
    window.addEventListener('pageshow', bump);
    document.addEventListener('visibilitychange', bump);
    return () => {
      window.removeEventListener('pageshow', bump);
      document.removeEventListener('visibilitychange', bump);
    };
  }, []);

  // Sichtbare Seiten malen + Striche laden + Seitenverhältnis setzen; dazu der Bild-Vorrat der
  // Nachbarseiten für den Blätter-Streifen.
  const { aspects, strokeImgCache } = usePageCanvases({
    pages,
    pageIndex,
    perView,
    loading,
    syncTick,
    remountEpoch,
    ownKeys,
    overKeys,
    neighbourKeys,
    contentRefs,
    annoRefs,
    overlayRefs,
    onAfterPaint: restoreAfterPaint,
  });

  // Eine Streifen-Hälfte (1–2 Seiten ab `start`) aus offscreen-Seite + Strichen zusammensetzen.
  function composePane(start: number): SlideSlot[] {
    const out: SlideSlot[] = [];
    for (let j = 0; j < perView; j++) {
      const p = start + j;
      const src = pages[p];
      if (!src) break;
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(src, 0, 0);
      // Beide Ebenen in den Streifen zeichnen (Overlay zuerst, interaktive Ebene obenauf) –
      // im Slide sieht die Seite damit exakt aus wie in der Live-Ansicht.
      const texts: PageTextObj[] = [];
      for (const key of [overlayKeyFor(p), ownKeyFor(p)]) {
        if (!key) continue;
        const strokes = strokeImgCache.current.get(key);
        if (strokes && strokes.complete && strokes.naturalWidth > 0) ctx.drawImage(strokes, 0, 0);
        texts.push(...readPageTexts<PageTextObj>(key));
      }
      out.push({ canvas: c, texts, zoom: loadZoom(p), aspect: `${src.width} / ${src.height}` });
    }
    return out;
  }

  // Slide-Übergang beim Blättern (Auslösen ±1 + Abspielen) – ausgelagert in useSlideTransition.
  // composePane bleibt hier, weil es tief in die Zeichen-/Overlay-Interna greift.
  const { slide, slidePanes, slideOverlayRef } = useSlideTransition({
    pageIndex,
    perView,
    pages,
    loading,
    composePane,
  });

  // Zwei Dinge in einem Durchgang, weil das zweite auf dem ersten aufbaut:
  //
  //  1. **Die Seite in ihren Rahmen deckeln – in PIXELN, nicht in Prozent (#319).**
  //     Im Stylesheet steht `max-width/max-height: 100%`. Das greift beim Vergrößern des Rahmens,
  //     beim VERKLEINERN aber nicht mehr verlässlich: Gemessen behielt die Seite nach dem
  //     Ausblenden der Leisten ihre Breite (990 px) und leitete daraus über das Seitenverhältnis
  //     1400 px Höhe ab – in einem Rahmen von 1220 px. Der Liedtext ragte hinter die Fußzeile.
  //     Ein Deckel in Pixeln hängt an keiner Prozent-Auflösung und greift in beide Richtungen.
  //     (`object-fit: contain` wäre die elegantere Lösung, verbietet sich aber: Dann wäre das
  //     Element so groß wie der Rahmen und die Zeichnung nur hineingelegt – die Anmerkungs-Ebene
  //     läge nicht mehr deckungsgleich auf dem Notenblatt.)
  //
  //  2. **Text-Ebene exakt auf die dargestellte Seite legen.** Ein leeres div mit nur
  //     `aspect-ratio` kollabiert im Grid auf 0×0 → Text ließe sich nicht platzieren. Muss NACH
  //     dem Deckeln passieren, sonst übernimmt sie die zu große Höhe.
  useEffect(() => {
    function sync() {
      for (let j = 0; j < perView; j++) {
        const a = annoRefs[j].current;
        const rahmen = a?.parentElement;
        if (a && rahmen) {
          const hoehe = `${rahmen.clientHeight}px`;
          const breite = `${rahmen.clientWidth}px`;
          for (const el of [contentRefs[j].current, a, overlayRefs[j].current]) {
            if (!el) continue;
            el.style.maxHeight = hoehe;
            el.style.maxWidth = breite;
          }
        }
        const l = layerRefs[j].current;
        if (a && l) {
          l.style.width = `${a.clientWidth}px`;
          l.style.height = `${a.clientHeight}px`;
        }
      }
    }
    sync();
    const ro = new ResizeObserver(sync);
    for (let j = 0; j < perView; j++) {
      const a = annoRefs[j].current;
      if (a) ro.observe(a);
      // Den RAHMEN mitbeobachten: Ändert sich die verfügbare Fläche (Leisten aus/ein, Drehen),
      // meldet sich die Seite selbst nicht – sie behält ja ihre Größe. Genau das war der Fehler.
      if (a?.parentElement) ro.observe(a.parentElement);
    }
    return () => ro.disconnect();
  }, [perView, loading, pages, pageIndex, annoRefs, layerRefs, contentRefs, overlayRefs]);

  // Aktive Seite im sichtbaren Fenster halten
  useEffect(() => {
    const maxVisible = pageIndex + perView - 1;
    if (activePage < pageIndex || activePage > maxVisible) onActivePage(pageIndex);
  }, [perView, pageIndex, activePage, onActivePage]);

  // Blättern per Wisch/Tipp (drei Zonen) – ausgelagert in usePageNavigation.
  const { onTouchStart, onTouchEnd, onClick } = usePageNavigation({
    pageIndex,
    pageCount,
    perView,
    drawMode,
    onPageIndex,
    onActivePage,
    onMiddleTap,
  });

  const slots: number[] = [];
  for (let j = 0; j < perView; j++) {
    if (pageIndex + j >= pageCount) break;
    slots.push(j);
  }

  // #53: im 2-up Zeichenmodus wird die inaktive Seite ausgegraut/zurückgestellt (und ist gesperrt –
  // das erledigen strokeDown/layerDown). Die aktive Seite bleibt in voller Deckkraft = hervorgehoben.
  function slotClass(j: number): string {
    if (!drawMode || perView !== 2 || slots.length < 2 || j === activeSlot) return styles.slot;
    return `${styles.slot} ${styles.slotInactive}`;
  }

  const label =
    !loading && !error && pageCount > 0 && !drawMode && pageLabel
      ? pageLabel(activePage, pageIndex, pageCount)
      : null;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
      {loading && (
        <div className={styles.center}>
          <Spinner />
          <span>{loadingLabel}</span>
        </div>
      )}
      {error && <div className={styles.center}>⚠️ {error}</div>}
      {!loading && slots.length === 2 && <div className={styles.divider} />}

      <div className={styles.row} style={{ visibility: loading ? 'hidden' : 'visible' }}>
        {slots.map((j) => (
          <div key={j} className={slotClass(j)}>
            {/* key = SEITE + LAYOUT (perView): beim Blättern UND beim Formatwechsel (Hoch↔Quer)
                wird die Zoom-Ebene frisch aufgebaut statt den Transform-Zustand des vorherigen
                Zustands dieser Hälfte zu erben (sonst blieb die linke Hälfte beim Drehen im Zoom
                „stecken"). onInit stellt danach den für DIESES Layout gespeicherten Zoom her (bzw.
                passt ein, wenn keiner gespeichert ist). Beim Hintergrund-Neuaufbau (pages-Tausch)
                bleibt der key gleich → kein Remount, laufende Gesten unberührt. */}
            <TransformWrapper
              key={`p${pageIndex + j}_v${perView}_e${remountEpoch}`}
              ref={transformRefs[j]}
              minScale={MIN_SCALE}
              maxScale={MAX_SCALE}
              centerOnInit
              centerZoomedOut
              initialScale={1}
              limitToBounds
              doubleClick={{ disabled: true }}
              // Ein-Finger-Panning IMMER aus: ein Finger blättert (bzw. zeichnet im Zeichenmodus).
              // Zwei Finger gehören der Zoom-Geste – die zoomt UND verschiebt (Mittelpunkt-Bewegung),
              // AUCH im Zeichenmodus: so kann man beim Anmerken kurz zoomen/verschieben, ohne den
              // Modus zu verlassen (ein begonnener Strich wird bei Zweitfinger verworfen).
              panning={{ disabled: true }}
              pinch={{ disabled: false }}
              wheel={{ disabled: false, step: 0.08 }}
              // Wiederherstellen, Sichern und der Lebenslauf einer Geste: useZoomOrchestration.
              {...paneProps(j)}
            >
              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%' }}
              >
                <div
                  className={styles.pageBox}
                  // Im 2-up (2 Seiten sichtbar) sitzt jede Seite mittig in IHRER Hälfte. Eine
                  // allein stehende LETZTE Seite eines mehrseitigen Charts bleibt LINKS wie ein
                  // normales linkes Blatt (springt so beim Blättern nicht in die Mitte). Ein
                  // Chart mit NUR EINER Seite (pageCount === 1) wird dagegen über die volle Breite
                  // zentriert – sonst klebte es unmotiviert links neben einer leeren Hälfte.
                  style={{
                    justifyItems:
                      perView === 2 && slots.length === 1 && pageCount > 1 ? 'start' : 'center',
                  }}
                >
                  <canvas ref={contentRefs[j]} className={styles.contentCanvas} />
                  {/* Striche der gerade ANGESEHENEN fremden Ebene (nur lesend). */}
                  <canvas
                    ref={overlayRefs[j]}
                    className={styles.annoCanvas}
                    style={{ pointerEvents: 'none' }}
                  />
                  <canvas
                    ref={annoRefs[j]}
                    className={styles.annoCanvas}
                    style={{
                      pointerEvents: drawMode && maltStriche(drawTool) ? 'all' : 'none',
                      cursor: drawMode ? 'crosshair' : 'default',
                    }}
                    onPointerDown={(e) => strokeDown(e, j)}
                    onPointerMove={strokeMove}
                    onPointerUp={strokeUp}
                    onPointerCancel={strokeUp}
                  />
                  <PageTextLayer
                    draw={draws[j]}
                    layerRef={layerRefs[j]}
                    editRef={(n) => {
                      editRefs.current[j] = n;
                    }}
                    aspect={aspects[j]}
                    overlayTexts={overlayTexts[j]}
                    showOwn={!viewing(pageIndex + j) || previewOwn}
                    drawMode={drawMode}
                    drawTool={drawTool}
                    interactive={!(perView === 2 && j !== activeSlot)}
                    drawColor={drawColor}
                    textSize={textSize}
                    textStyle={textStyle}
                    onLayerDown={(e) => layerDown(e, j)}
                    onCommit={() => commitInlineText(j)}
                    onFocusEditor={() => focusEditor(j)}
                    onResizeDown={(e, id, size) => handleResizeDown(e, j, id, size)}
                    onResizeMove={handleResizeMove}
                    onResizeUp={handleResizeUp}
                  >
                    {/* Lasso nur auf der aktiven Seite. Nach einem Abgleich (syncTick) wird die Seite
                        neu gezeichnet – vorher legt das Lasso seine Auswahl ab (key → neu einhängen). */}
                    {drawMode && drawTool === 'lasso' && j === activeSlot && (
                      <LassoEbene key={syncTick} leinwandRef={annoRefs[j]} draw={draws[j]} />
                    )}
                  </PageTextLayer>
                </div>
              </TransformComponent>
            </TransformWrapper>
          </div>
        ))}
      </div>

      {slide && slidePanes.current && (
        <SlidePanes
          slide={slide}
          panes={slidePanes.current}
          perView={perView}
          overlayRef={slideOverlayRef}
        />
      )}

      {/* Werkzeugleiste (volle Anmerkungen für die aktive Seite) */}
      {drawMode && (
        <PageDrawToolbar
          activeDraw={activeDraw}
          draws={draws}
          drawColors={drawColors}
          drawColor={drawColor}
          setDrawColor={setDrawColor}
          drawTool={drawTool}
          setDrawTool={setDrawTool}
          toolSizes={toolSizes}
          setToolSizes={setToolSizes}
          textSize={textSize}
          setTextSize={setTextSize}
          textStyle={textStyle}
          setTextStyle={setTextStyle}
          onClear={() => setConfirmClear(true)}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Markierungen löschen?"
          message="Alle Zeichnungen und Texte auf der aktiven Seite werden entfernt."
          confirmLabel="Löschen"
          onConfirm={() => {
            activeDraw.clearAll();
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {label && <div className={styles.pageBadge}>{label}</div>}
    </div>
  );
}
