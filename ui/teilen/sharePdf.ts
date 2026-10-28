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

/**
 * Öffnet eine erzeugte PDF in einem neuen Tab – dort druckt der PDF-Betrachter des Browsers jede Seite in ihrem eigenen
 * Format, quer bleibt quer (O7b-4: Safari druckt eine Webseite immer hoch). Am iPad steht dort „Teilen“ → „Drucken“.
 * Sperrt der Browser das neue Fenster, wird die PDF stattdessen heruntergeladen.
 *
 * Nur direkt aus einem Klick aufrufen und die PDF vorher fertig haben – sonst blockt Safari das Fenster.
 */
export function oeffnePdf(doc: jsPDF, filename: string): void {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const fenster = window.open(url, '_blank');
  if (!fenster) {
    URL.revokeObjectURL(url);
    downloadFile(blob, mitEndung(filename));
    return;
  }
  // Der Tab hat die PDF dann längst geladen; freigeben, damit sie nicht bis zum Schließen der Seite im Speicher liegt.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function mitEndung(filename: string): string {
  return filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
}
