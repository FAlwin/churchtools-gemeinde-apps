import type { jsPDF } from 'jspdf';
// Wie `pdfSchrift.ts`: als Daten im Code, erst beim Erstellen eines Protokoll-PDFs geladen.
import latoKursiv from './schrift/Lato-Italic.ttf?inline';
import latoFettKursiv from './schrift/Lato-BoldItalic.ttf?inline';
import { PDF_SCHRIFT } from './pdfSchrift';

/**
 * **Lato kursiv in der PDF** (Protokolle S6-3a, Alwin 12.11.2026: „echte Kursiv-Lato holen“) – kursiver Text aus dem
 * Editor des Protokolls. Unverändert aus google/fonts wie normal und fett (`schrift/HERKUNFT.md`). Ein eigenes Modul,
 * geladen nur von `protokollPdf.ts` – die übrigen Apps tragen die beiden Schnitte
 * nicht im ZIP.
 */
const SCHNITTE = [
  { daten: latoKursiv, datei: 'Lato-Italic.ttf', stil: 'italic' },
  { daten: latoFettKursiv, datei: 'Lato-BoldItalic.ttf', stil: 'bolditalic' },
] as const;

const base64 = (url: string) => url.slice(url.indexOf(',') + 1);

export function latoKursivEinbetten(doc: jsPDF): void {
  for (const s of SCHNITTE) {
    doc.addFileToVFS(s.datei, base64(s.daten));
    doc.addFont(s.datei, PDF_SCHRIFT, s.stil);
  }
}
