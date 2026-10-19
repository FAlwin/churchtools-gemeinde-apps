import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type { AnnotationText } from '@shared/types/index';
import type { DrawTool } from '../types/index';
import { usePageDraw } from '../hooks/usePageDraw';
import { usePointerStrokes } from '../hooks/usePointerStrokes';
import { useTextEingabe } from '../hooks/useTextEingabe';
import { useLatestRef } from '../hooks/useLatestRef';
import { pushField } from '../services/annotations';
import { textSchluessel } from '../utils/annotationKeys';
import { lokalSchreiben } from '../utils/lokalSpeicher';
import { rahmenAufKernen, streifen, type Anmerkungsquelle } from '../utils/rollenAbbildung';
import { PAGE_W } from '../utils/blattMasse';
import {
  bildLaden,
  entwurfStriche,
  entwurfTexte,
  lueckenStricheHolen,
  lueckenTexteHolen,
  stricheZurueck,
  texteZurueck,
} from '../utils/rolleSpeichern';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import { PageDrawToolbar } from './PageDrawToolbar';
import { PageTextLayer } from './PageTextLayer';
import { LassoEbene, type Dazugeholt } from './LassoEbene';
import type { Punkt, Rahmen } from '../utils/lasso';
import styles from './ScrollDeck.module.scss';
import { maltStriche } from '../utils/malwerkzeug';

/** So lange nach dem letzten Strich wird auf die A4-Seiten geschrieben – nicht bei jedem Strich. */
const SPEICHERN_NACH_MS = 700;

interface RollenMalenProps {
  /** Was die Seite zeigt: bei der Rolle die A4-Seiten samt Abbildung, sonst die Seite selbst. */
  quelle: Anmerkungsquelle;
  /** Größe der Seiten-Leinwand in Bildpunkten. */
  breitePx: number;
  hoehePx: number;
  /** Höhe der Seite in mm (die Rolle ist so breit wie A4). */
  hoeheMm: number;
  /** Wird beim Tippen über die Tastatur angehoben. */
  rootRef: MutableRefObject<HTMLDivElement | null>;
  /** Hierhin kommen Werkzeugleiste und Rückfrage – sie dürfen nicht mitscrollen. */
  leisteZiel: HTMLElement | null;
  drawTool: DrawTool;
  setDrawTool: (t: DrawTool) => void;
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawColors: string[];
  /** Nachdem auf die A4-Seiten geschrieben wurde – die Anzeige liest dann neu. */
  onGespeichert: () => void;
}

/**
 * **Malen auf der Rolle** (#608, Alwin 17.10.2026: „Direkt, scrollen mit 2 Fingern"). Liegt über der
 * Seite in der Bildmitte, solange der Stift an ist. Alles Werkzeug wie beim Blättern – derselbe Kern
 * (`usePageDraw`, `usePointerStrokes`, `useTextEingabe`, `PageTextLayer`, `PageDrawToolbar`), keine Kopie.
 *
 * Bei der Rolle wird in einem Entwurf gemalt (Rollen-Koordinaten, nur die Kerne der A4-Seiten); jede
 * Änderung schreibt `rolleSpeichern` zurück auf die A4-Seiten. Bei einer gewöhnlichen Seite (hochgeladenes
 * PDF) wird direkt auf ihre eigene Ebene gemalt – genau wie beim Blättern.
 */
export function RollenMalen({
  quelle,
  breitePx,
  hoehePx,
  hoeheMm,
  rootRef,
  leisteZiel,
  drawTool,
  setDrawTool,
  drawColor,
  setDrawColor,
  drawColors,
  onGespeichert,
}: RollenMalenProps) {
  const annoRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [toolSizes, setToolSizes] = useState({ pen: 3, marker: 18, eraser: 26 });
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  const abbildung = quelle.abbildung;
  const liste = useMemo(() => (abbildung ? streifen(abbildung) : null), [abbildung]);
  const eigeneSig = quelle.seiten.map((s) => s.own ?? '').join('\u0001');
  const eigene = useMemo(() => eigeneSig.split('\u0001').map((k) => k || null), [eigeneSig]);

  // Der Entwurf der Rolle: eigener, nur lokaler Schlüssel (Doppelpunkt-Namensraum → kein Konto-Abgleich).
  // Seine Texte müssen VOR `usePageDraw` im Speicher stehen – der liest sie beim Schlüsselwechsel noch im
  // Render. Deshalb hier im Memo (einmal je Rolle) und nicht in einem Effekt.
  const entwurf = useMemo(() => {
    if (!liste) return null;
    const key = `worship:rolle-entwurf:${eigeneSig}:${Date.now()}`;
    lokalSchreiben(textSchluessel(key), JSON.stringify(entwurfTexte(eigene, liste, hoeheMm)));
    return key;
  }, [liste, eigeneSig, eigene, hoeheMm]);
  useEffect(() => {
    if (!entwurf) return;
    return () => {
      try {
        localStorage.removeItem(entwurf);
        localStorage.removeItem(textSchluessel(entwurf));
      } catch {
        /* Speicher gesperrt – dann gab es auch nichts zu räumen */
      }
    };
  }, [entwurf]);

  // Zurückschreiben: Texte sofort (billig), Striche gesammelt (ein Bild je A4-Seite kostet Zeit).
  const offeneStriche = useRef<{ wert: string | null } | null>(null);
  const timer = useRef<number | null>(null);
  const live = useLatestRef({
    eigene,
    liste,
    breitePx,
    hoehePx,
    hoeheMm,
    onGespeichert,
    jetzt: () => stricheJetzt(),
  });
  function stricheJetzt() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const offen = offeneStriche.current;
    offeneStriche.current = null;
    const l = live.current;
    if (!offen || !l.liste) return;
    void stricheZurueck(offen.wert, l.breitePx, l.hoehePx, l.eigene, l.liste).then(l.onGespeichert);
  }
  // Beim Verlassen (Stift aus, andere Rolle, App in den Hintergrund) nichts liegen lassen. Aufgerufen wird
  // die NEUESTE Fassung – sie kennt die aktuellen Schlüssel; deshalb über `live`, nicht über den Abschluss.
  useEffect(() => {
    const weg = () => {
      if (document.visibilityState === 'hidden') live.current.jetzt();
    };
    const l = live;
    document.addEventListener('visibilitychange', weg);
    return () => {
      document.removeEventListener('visibilitychange', weg);
      l.current.jetzt();
    };
  }, [live]);

  function speichern(_key: string, feld: 'strokes' | 'texts', wert: unknown) {
    const l = live.current;
    if (!l.liste) return;
    if (feld === 'texts') {
      texteZurueck(wert as AnnotationText[], l.hoeheMm, l.eigene, l.liste);
      l.onGespeichert();
      return;
    }
    offeneStriche.current = { wert: (wert as string | null) ?? null };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(stricheJetzt, SPEICHERN_NACH_MS);
  }

  // Bei einer gewöhnlichen Seite direkt auf ihre Ebene, sonst in den Entwurf.
  const schluessel = entwurf ?? quelle.seiten[0]?.own ?? null;
  const draw = usePageDraw(schluessel, annoRef, layerRef, 0, entwurf ? speichern : pushField);

  // Die Leinwand füllen: Entwurf aus den Kernen der A4-Seiten bzw. die eigenen Striche der Seite.
  useEffect(() => {
    const c = annoRef.current;
    if (!c) return;
    c.width = breitePx;
    c.height = hoehePx;
    if (liste) void entwurfStriche(c, eigene, liste);
    else
      void bildLaden(schluessel ? localStorage.getItem(schluessel) : null).then((bild) => {
        if (bild) c.getContext('2d')?.drawImage(bild, 0, 0, c.width, c.height);
      });
  }, [breitePx, hoehePx, liste, eigene, schluessel]);

  const { strokeDown, strokeMove, strokeUp } = usePointerStrokes({
    annoRefs: [annoRef],
    draws: [draw],
    drawMode: true,
    drawTool,
    drawColor,
    toolSizes,
    perView: 1,
    activeSlot: 0,
    pageIndex: 0,
    onActivePage: () => {},
  });

  // Lasso (#615): Was beim Blättern in einer Lücke steht, liegt auf der Rolle über dem nächsten Teil – aber
  // nicht im Entwurf. Das Lasso holt es vor dem Ausschneiden dazu („ans Lückenende, dann zurechtrücken").
  async function lueckenHolen(form: Punkt[]): Promise<Dazugeholt> {
    const c = annoRef.current;
    if (!c || !liste) return { texte: [], striche: false };
    const texte = lueckenTexteHolen(form, hoeheMm, eigene, liste);
    const striche = await lueckenStricheHolen(c, form, eigene, liste);
    if (texte.length || striche) onGespeichert();
    return { texte, striche };
  }

  /** Nur über dem Lied ablegen – darunter gäbe es keine A4-Stelle (#615). */
  function ablegbar(z: Rahmen): boolean {
    if (!liste) return true;
    return rahmenAufKernen(liste, {
      x: z.x * PAGE_W,
      y: z.y * hoeheMm,
      w: z.w * PAGE_W,
      h: z.h * hoeheMm,
    });
  }

  const text = useTextEingabe({
    rootRef,
    draws: [draw],
    layerRefs: [layerRef],
    drawMode: true,
    drawTool,
    drawColor,
    perView: 1,
    activeSlot: 0,
    pageIndex: 0,
    onActivePage: () => {},
  });

  return (
    <div className={styles.malen} data-testid="rollen-malen">
      <canvas
        ref={annoRef}
        className={styles.malLeinwand}
        style={{ pointerEvents: maltStriche(drawTool) ? 'all' : 'none' }}
        onPointerDown={(e) => strokeDown(e, 0)}
        onPointerMove={strokeMove}
        onPointerUp={strokeUp}
        onPointerCancel={strokeUp}
      />
      <PageTextLayer
        draw={draw}
        layerRef={layerRef}
        editRef={(n) => {
          text.editRefs.current[0] = n;
        }}
        aspect={`${breitePx} / ${hoehePx}`}
        overlayTexts={[]}
        showOwn
        drawMode
        drawTool={drawTool}
        interactive
        drawColor={drawColor}
        textSize={text.textSize}
        textStyle={text.textStyle}
        onLayerDown={(e) => text.layerDown(e, 0)}
        onCommit={() => text.commitInlineText(0)}
        onFocusEditor={() => text.focusEditor(0)}
        onResizeDown={(e, id, size) => text.handleResizeDown(e, 0, id, size)}
        onResizeMove={text.handleResizeMove}
        onResizeUp={text.handleResizeUp}
      >
        {drawTool === 'lasso' && (
          <LassoEbene
            leinwandRef={annoRef}
            draw={draw}
            vorAuswahl={liste ? lueckenHolen : undefined}
            ablegbar={ablegbar}
          />
        )}
      </PageTextLayer>
      {leisteZiel &&
        createPortal(
          <>
            <PageDrawToolbar
              activeDraw={draw}
              draws={[draw]}
              drawColors={drawColors}
              drawColor={drawColor}
              setDrawColor={setDrawColor}
              drawTool={drawTool}
              setDrawTool={setDrawTool}
              toolSizes={toolSizes}
              setToolSizes={setToolSizes}
              textSize={text.textSize}
              setTextSize={text.setTextSize}
              textStyle={text.textStyle}
              setTextStyle={text.setTextStyle}
              onClear={() => setLoeschenFragen(true)}
            />
            {loeschenFragen && (
              <ConfirmDialog
                title="Markierungen löschen?"
                message="Alle Zeichnungen und Texte dieses Lieds werden entfernt. Was beim Blättern in einer Lücke am Seitenende steht, bleibt."
                confirmLabel="Löschen"
                onConfirm={() => {
                  draw.clearAll();
                  setLoeschenFragen(false);
                }}
                onCancel={() => setLoeschenFragen(false)}
              />
            )}
          </>,
          leisteZiel,
        )}
    </div>
  );
}
