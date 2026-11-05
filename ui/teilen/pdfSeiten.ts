/**
 * **PDF-Seiten als Leinwände** (pdf.js) – für das Liedblatt der Musik-App (`dokumentSeiten`) und die Vorschau im
 * Teilen-Fenster (`PdfSeitenVorschau`). Lag bis E8-1 in `client/src/utils/dokumentSeiten.ts`; der Dienstplaner braucht
 * dieselbe Vorschau, eine zweite Fassung wäre die nächste Abweichung.
 */
import * as pdfjsLib from 'pdfjs-dist';
// Worker inline im Bundle (./pdfSetup) → Charts rendern auch offline (#32); in Erweiterungen als eigene Datei.
import './pdfSetup';
import { wirksamerMassstab } from './leinwand';

const RENDER_SCALE = 2;

/**
 * Alle Seiten eines PDF als Leinwände. `scale` kleiner als die Vorgabe für Miniaturen (Vorschau im
 * Teilen-Fenster, 08.10.2026) – sonst hielte ein langer Ablauf Dutzende Seiten in voller Größe.
 */
export async function renderPdfToCanvases(
  data: ArrayBuffer,
  scale = RENDER_SCALE,
): Promise<HTMLCanvasElement[]> {
  // Dokumente IMMER komplett laden statt pdf.js selbst streamen zu lassen – Begründung in
  // `services/fileDownload.ts` (#32).
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const out: HTMLCanvasElement[] = [];
  for (let i = 1; i <= pdf.numPages; i++) out.push(await seiteZeichnen(pdf, i, scale));
  return out;
}

/** Eine Seite eines PDF (1-basiert) – für die Großansicht, ohne alle anderen mitzuzeichnen. */
export async function renderPdfSeite(
  data: ArrayBuffer,
  seite: number,
  scale = RENDER_SCALE,
): Promise<HTMLCanvasElement> {
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  return seiteZeichnen(pdf, seite, scale);
}

async function seiteZeichnen(
  pdf: pdfjsLib.PDFDocumentProxy,
  nr: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(nr);
  const vp = page.getViewport({ scale: wirksamerMassstab(page.getViewport({ scale: 1 }), scale) });
  const c = document.createElement('canvas');
  c.width = Math.ceil(vp.width);
  c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
  return c;
}
