import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Worker inline im Bundle (../pdfSetup) → funktioniert auch offline (#32).
import '../pdfSetup';
import { type ChordPdfSong, generateChordPdf } from '../utils/chordPdf';
import { parseMetadata } from '../utils/chordpro';
import { wirksamerMassstab } from '../utils/leinwand';
import { useAppLogo } from '../hooks/useAppLogo';
import styles from './PdfPreview.module.scss';

interface PdfPreviewProps {
  title: string;
  text: string;
  semitones: number;
  /** Scroll-Modus (#607): die Vorschau zeigt die lange Seite, wie sie im Liederheft erscheint. */
  rolle?: boolean;
  /**
   * Kopf aus der Liedinfo (L4) statt aus den Kopfzeilen der Datei – so zeigt die Vorschau das Blatt, wie es nach dem
   * Speichern aussieht. Fehlt er, gilt wie bisher die Datei.
   */
  kopf?: { author: string; bpm: number | null; timeSig: string };
}

const MAX_PAGES = 8; // Sicherheitsdeckel – mehr Seiten hat kein Lied

/** Zeigt die „wie gedruckt"-Version des Lieds: erzeugt aus dem ChordPro-Text dieselbe PDF wie die
 *  Bühnen-/Druck-Ansicht und rendert ALLE Seiten untereinander (auf die Panel-Breite eingepasst,
 *  Retina-scharf). Entkoppelt (debounced), damit das Tippen flüssig bleibt; passt sich bei
 *  Größenänderung des Panels automatisch neu ein. */
export function PdfPreview({ title, text, semitones, rolle = false, kopf }: PdfPreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Erhöht sich bei Panel-Resize → Seiten neu einpassen (sonst bleibt eine beim ersten,
  // evtl. noch winzigen Layout gerenderte Mini-Vorschau stehen).
  const [fitTick, setFitTick] = useState(0);
  // Dasselbe Logo wie auf dem Blatt (samt Gemeinde-Schalter, 19.10.2026) – bis dahin fehlte es in der
  // Vorschau ganz, und der Text stand dort höher als auf dem fertigen Blatt.
  const logo = useAppLogo();

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => setFitTick((x) => x + 1), 150);
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      if (t) clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => void render(), 350);

    async function render() {
      const meta = parseMetadata(text);
      // Genau die Felder, die ein Blatt braucht (#283): `ChordPdfSong` statt eines künstlich
      // vervollständigten `SetlistSong` mit `as unknown as` – der Doppel-Cast hätte jeden Tippfehler
      // hier durchgelassen. `id`/`arrangementId`/`versions`/`documents` braucht das PDF nicht.
      const song: ChordPdfSong = {
        // Titel/Autor NICHT hier auflösen – das macht `chartHead` in `generateChordPdf` für Blatt
        // und Vorschau gemeinsam (#236). Vorher stand die Regel nur hier, weshalb die Vorschau
        // den `{title}` zeigte und das fertige Blatt nicht.
        title,
        author: kopf?.author ?? '',
        originalKey: meta.key || '',
        targetKey: meta.key || '',
        bpm: kopf ? kopf.bpm : meta.tempo ? Number(meta.tempo) || null : null,
        timeSig: kopf ? kopf.timeSig : meta.time || '',
        chordpro: text,
        ccli: null,
      };

      let bytes: ArrayBuffer;
      try {
        bytes = generateChordPdf(song, { semitones, fontPt: 11, cols: 1, rolle, logo }).output(
          'arraybuffer',
        );
      } catch {
        return; // ungültiger Zwischenstand beim Tippen – nächster Lauf rendert neu
      }
      try {
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        const wrap = wrapRef.current;
        if (!wrap) return;
        const width = Math.max(120, wrap.clientWidth - 24);
        const dpr = Math.min(3, window.devicePixelRatio || 1); // Retina-scharf, gedeckelt
        const canvases: HTMLCanvasElement[] = [];
        const n = Math.min(pdf.numPages, MAX_PAGES);
        for (let i = 1; i <= n; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = width / base.width;
          // Dieselbe Obergrenze wie im Liederheft – eine lange Rolle bliebe sonst auf iOS leer.
          const vp = page.getViewport({ scale: wirksamerMassstab(base, scale * dpr) });
          const canvas = document.createElement('canvas');
          canvas.className = styles.canvas;
          canvas.width = Math.ceil(vp.width);
          canvas.height = Math.ceil(vp.height);
          // Angezeigt wird immer in Panelbreite – auch wenn die Leinwand gedeckelt kleiner gezeichnet ist.
          canvas.style.width = `${Math.round(width)}px`;
          canvas.style.height = `${Math.round((width * base.height) / base.width)}px`;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          if (cancelled) return;
          canvases.push(canvas);
        }
        // Erst nach vollständigem Rendern austauschen → kein Aufblitzen einer leeren Vorschau.
        wrap.replaceChildren(...canvases);
      } catch {
        /* Render-Fehler ignorieren */
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Der Kopf als einzelne Werte: Das Objekt ist bei jedem Zeichnen neu und würde sonst jedes Mal neu rendern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, text, semitones, rolle, fitTick, logo, kopf?.author, kopf?.bpm, kopf?.timeSig]);

  return <div ref={wrapRef} className={styles.wrap} />;
}
