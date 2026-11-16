import type { jsPDF } from 'jspdf';
// Wie `pdfSchrift.ts`: als Daten im Code, erst beim Erstellen eines Protokoll-PDFs geladen.
import schriftKursiv from './schrift/GemeindeSans-Italic.ttf?inline';
import schriftFettKursiv from './schrift/GemeindeSans-BoldItalic.ttf?inline';
import { PDF_SCHRIFT } from './pdfSchrift';

/**
 * **Kursiv in der PDF** (Protokolle S6-3a, Alwin 12.11.2026: „echte Kursiv-Lato holen“) – kursiver Text aus dem
 * Editor des Protokolls. Gekürzt und umbenannt wie normal und fett („Gemeinde Sans“, `schrift/HERKUNFT.md`). Ein eigenes Modul,
 * geladen nur von `protokollPdf.ts` – die übrigen Apps tragen die beiden Schnitte
 * nicht im ZIP.
 */
const SCHNITTE = [
  { daten: schriftKursiv, datei: 'GemeindeSans-Italic.ttf', stil: 'italic' },
  { daten: schriftFettKursiv, datei: 'GemeindeSans-BoldItalic.ttf', stil: 'bolditalic' },
] as const;

const base64 = (url: string) => url.slice(url.indexOf(',') + 1);

export function kursivEinbetten(doc: jsPDF): void {
  for (const s of SCHNITTE) {
    doc.addFileToVFS(s.datei, base64(s.daten));
    doc.addFont(s.datei, PDF_SCHRIFT, s.stil);
  }
}
