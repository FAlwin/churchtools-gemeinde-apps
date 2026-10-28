import type { jsPDF } from 'jspdf';
// Als Daten im Code (`?inline`), nicht als Datei zum Nachladen: In ChurchTools gilt dessen Inhaltsrichtlinie, und
// dieses Modul wird ohnehin erst beim Erstellen einer PDF geladen (`import('@ui/teilen/pdfSchrift')`).
import latoNormal from './schrift/Lato-Regular.ttf?inline';
import latoFett from './schrift/Lato-Bold.ttf?inline';

/**
 * **Lato in der PDF** (O7b-4, Entwurf `o7b-4-pdf-v1.html`, abgenommen 28.10.2026) – die Schrift der
 * ChurchTools-Weboberfläche auf Papier. Normal und fett, unverändert von Google Fonts (Lato 2.015, mit Latein-Erweiterung,
 * Griechisch und Kyrillisch; Lizenz und Herkunft in `schrift/`). jsPDF bettet nur die gebrauchten Zeichen ein.
 *
 * Die Helvetica der übrigen PDFs (`listenPdf`, Liedblatt) bleibt, wie sie ist; wer dort Lato will, ruft dies hier.
 *
 * **Eigener Name** `LatoPdf` – in der PDF und im Dokument (`schriftImDokument`). Eine zweite Schrift „Lato“ im Dokument
 * träfe ChurchTools selbst (siehe `ui/design/schrift.ts`).
 */
export const PDF_SCHRIFT = 'LatoPdf';

const SCHNITTE = [
  { daten: latoNormal, datei: 'Lato-Regular.ttf', stil: 'normal', gewicht: '400' },
  { daten: latoFett, datei: 'Lato-Bold.ttf', stil: 'bold', gewicht: '700' },
] as const;

const base64 = (url: string) => url.slice(url.indexOf(',') + 1);

export function latoEinbetten(doc: jsPDF): void {
  for (const s of SCHNITTE) {
    doc.addFileToVFS(s.datei, base64(s.daten));
    doc.addFont(s.datei, PDF_SCHRIFT, s.stil);
  }
}

let imDokument: Promise<void> | null = null;

/**
 * Dieselbe Schrift auch im Dokument anmelden: svg2pdf misst rechtsbündige und mittige Texte im Browser, und die Lage der
 * Grundlinie kommt ebenfalls von dort (`svgSeitenPdf`). Mit der Schrift der Seite (außerhalb von ChurchTools gar kein
 * Lato) lag das Datum rechts oben gut 2 mm über dem Rand hinaus (Demo 28.10.2026). Schlägt es fehl, wird beim
 * nächsten Mal neu versucht.
 */
export function schriftImDokument(): Promise<void> {
  imDokument ??= (async () => {
    for (const s of SCHNITTE) {
      const bytes = Uint8Array.from(atob(base64(s.daten)), (z) => z.charCodeAt(0));
      const schrift = new FontFace(PDF_SCHRIFT, bytes.buffer, { weight: s.gewicht });
      await schrift.load();
      document.fonts.add(schrift);
    }
  })().catch((x: unknown) => {
    imDokument = null;
    throw x;
  });
  return imDokument;
}
