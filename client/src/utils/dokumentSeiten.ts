/**
 * Die Seiten eines Dokuments (PDF oder Bild) als Leinwände – für die Anzeige im Liedblatt
 * (`useSetlistPages`) UND das Teilen des Ablaufs als PDF (`ablaufPdf.ts`). Lag bis 07.10.2026 privat
 * im Hook; das Teilen braucht dieselbe Umwandlung, eine zweite Fassung wäre die nächste Abweichung.
 */
import type { SongDocument } from '@shared/types/index';
import { renderPdfToCanvases } from '@ui/teilen/pdfSeiten';

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
