import type { jsPDF } from 'jspdf';
// Als Daten im Code (`?inline`), nicht als Datei zum Nachladen: In ChurchTools gilt dessen Inhaltsrichtlinie, und
// dieses Modul wird ohnehin erst beim Erstellen einer PDF geladen (`import('@ui/teilen/pdfSchrift')`).
import schriftNormal from './schrift/GemeindeSans-Regular.ttf?inline';
import schriftFett from './schrift/GemeindeSans-Bold.ttf?inline';

/**
 * **Die Schrift der PDFs** (O7b-4, Entwurf `o7b-4-pdf-v1.html`, abgenommen 28.10.2026) – die Schrift der
 * ChurchTools-Weboberfläche (Lato) auf Papier, normal und fett. Seit 16.11.2026 als **„Gemeinde Sans“**: Lato 2.015,
 * gekürzt auf Latein (mit Erweiterungen), Kyrillisch und Satzzeichen – sonst passte das Protokolle-ZIP nicht mehr in
 * ChurchTools (3,2 MB kamen nicht an, 2,2 MB schon). Gekürzt heißt verändert, und die Lizenz (SIL OFL) reserviert den
 * Namen „Lato“ – darum der eigene Name. Herkunft, Werkzeug und Lizenz in `schrift/`. jsPDF bettet je PDF nur die
 * gebrauchten Zeichen ein.
 *
 * Die Helvetica der übrigen PDFs (`listenPdf`, Liedblatt) bleibt, wie sie ist; wer dort diese Schrift will, ruft dies hier.
 *
 * **Eigener Name** `GemeindeSans` – in der PDF und im Dokument (`schriftImDokument`). Eine zweite Schrift „Lato“ im
 * Dokument träfe ChurchTools selbst (siehe `ui/design/schrift.ts`).
 */
export const PDF_SCHRIFT = 'GemeindeSans';

const SCHNITTE = [
  { daten: schriftNormal, datei: 'GemeindeSans-Regular.ttf', stil: 'normal', gewicht: '400' },
  { daten: schriftFett, datei: 'GemeindeSans-Bold.ttf', stil: 'bold', gewicht: '700' },
] as const;

const base64 = (url: string) => url.slice(url.indexOf(',') + 1);

export function schriftEinbetten(doc: jsPDF): void {
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
