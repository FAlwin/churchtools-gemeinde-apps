import type { jsPDF } from 'jspdf';
import { qrInsPdf, qrMuster } from '@ui/teilen/qr';
import { datumText } from '@shared/ct/datum';

/**
 * **Aushang** (A8-4, Entwurf `a8-druckliste-v1`, abgenommen 23.10.2026) – ein A4-Blatt für Schaukasten und Foyer:
 * Gemeinde, Titel, Termin, groß der QR-Code zum Anmeldelink, darunter der Link zum Abtippen und der Anmeldeschluss.
 * Termin wie im Formular (`terminZeile`) – so steht es auch da, wo die Gäste landen.
 */
export interface AushangDaten {
  gemeinde: string | null;
  titel: string;
  /** `terminZeile` – „Sa, 21.11.2026 · Gemeindehaus“. */
  termin: string;
  link: string;
  /** Ende des Anmeldezeitraums (ISO) – steht unten, wenn es eins gibt. */
  anmeldeschluss: string | null;
}

const RAND = 20;
const QR = 95;

/** Baut das PDF. jsPDF wird erst hier geladen (wie bei den Drucklisten). */
export async function aushangPdf(a: AushangDaten): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const breite = d.internal.pageSize.getWidth();
  const mitte = breite / 2;
  const innen = breite - 2 * RAND;
  let y = 36;

  if (a.gemeinde) {
    d.setFont('helvetica', 'normal');
    d.setFontSize(13);
    d.setTextColor(90);
    d.text(a.gemeinde, mitte, y, { align: 'center', maxWidth: innen });
    d.setTextColor(0);
    y += 16;
  }
  d.setFont('helvetica', 'bold');
  d.setFontSize(32);
  const titel = d.splitTextToSize(a.titel, innen) as string[];
  d.text(titel, mitte, y, { align: 'center', lineHeightFactor: 1.15 });
  y += titel.length * 13 + 4;

  d.setFont('helvetica', 'normal');
  d.setFontSize(16);
  const termin = d.splitTextToSize(a.termin, innen) as string[];
  d.text(termin, mitte, y, { align: 'center' });
  y += termin.length * 7 + 14;

  d.setFont('helvetica', 'bold');
  d.setFontSize(20);
  d.text('Jetzt anmelden', mitte, y, { align: 'center' });
  y += 6;
  qrInsPdf(d, qrMuster(a.link), mitte - QR / 2, y, QR);
  y += QR + 4;

  d.setFont('helvetica', 'normal');
  d.setFontSize(11);
  const link = d.splitTextToSize(a.link, innen) as string[];
  d.text(link, mitte, y, { align: 'center' });
  y += link.length * 5 + 8;

  if (a.anmeldeschluss) {
    d.setFontSize(14);
    d.text(`Anmeldung bis ${datumText(a.anmeldeschluss.slice(0, 10))}`, mitte, y, {
      align: 'center',
    });
  }
  return d;
}
