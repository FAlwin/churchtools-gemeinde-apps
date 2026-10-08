import type { jsPDF } from 'jspdf';
import { downloadFile, shareOrDownload } from './shareFile';

/**
 * Teilt eine erzeugte PDF über das System-Teilen-Menü (Web Share API mit Datei – iPad/iPhone/
 * Android). Wo das nicht geht (Desktop), wird die PDF heruntergeladen.
 *
 * Der Ablauf selbst steht in `shareOrDownload` – er gilt seit #321 für jede Datei, nicht nur für
 * erzeugte PDFs. Hier bleibt nur, was PDF-spezifisch ist: die Endung.
 */
export async function sharePdf(doc: jsPDF, filename: string): Promise<void> {
  await shareOrDownload(doc.output('blob'), mitEndung(filename));
}

/** Lädt eine erzeugte PDF direkt herunter – ohne Teilen-Menü (08.10.2026). */
export function downloadPdf(doc: jsPDF, filename: string): void {
  downloadFile(doc.output('blob'), mitEndung(filename));
}

function mitEndung(filename: string): string {
  return filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
}
