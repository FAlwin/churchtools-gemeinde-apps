/**
 * Die Seiten eines Dokuments (PDF oder Bild) als Leinwände – für die Anzeige im Liedblatt
 * (`useSetlistPages`) UND das Teilen des Ablaufs als PDF (`ablaufPdf.ts`). Lag bis 07.10.2026 privat
 * im Hook; das Teilen braucht dieselbe Umwandlung, eine zweite Fassung wäre die nächste Abweichung.
 */
import * as pdfjsLib from 'pdfjs-dist';
// Worker inline im Bundle (../pdfSetup) → Charts rendern auch offline (#32).
import '../pdfSetup';
import type { SongDocument } from '@shared/types/index';

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
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.ceil(vp.width);
  c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
  return c;
}

export async function renderImageToCanvas(bytes: ArrayBuffer): Promise<HTMLCanvasElement> {
  // Aus den geladenen Bytes statt über eine Adresse (#335): So kommt das Bild in beiden
  // Auslieferungen über denselben Weg (`ladeDokument`), und die Seite muss nicht wissen, woher.
  const url = URL.createObjectURL(new Blob([bytes]));
  const img = new Image();
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Bild konnte nicht geladen werden'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}

/** Alle Seiten eines Dokuments – ein Bild ist eine Seite. */
export async function dokumentSeiten(
  bytes: ArrayBuffer,
  typ: SongDocument['type'],
): Promise<HTMLCanvasElement[]> {
  return typ === 'image' ? [await renderImageToCanvas(bytes)] : renderPdfToCanvases(bytes);
}
