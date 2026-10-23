import type { jsPDF } from 'jspdf';
import qrcode from 'qrcode-generator';

/**
 * **QR-Code** (A8-4, Entwurf `a8-druckliste-v1`, abgenommen 23.10.2026) – für jede App, die einen Link aufs Papier oder
 * auf den Beamer bringt. Das Muster rechnet `qrcode-generator` (MIT, ohne weitere Abhängigkeiten; Alwin, 23.10.2026);
 * gezeichnet wird hier – als SVG-Pfad für die Anzeige, als PNG zum Teilen und direkt ins PDF.
 *
 * Immer schwarz auf weiß mit Ruhezone: Viele Handys lesen einen umgekehrten Code (hell auf dunkel) nicht.
 */

/** Ein QR-Code als Raster: `true` = dunkles Modul. Fehlerkorrektur „M“ – verträgt Knicke und Flecken auf dem Aushang. */
export type QrMuster = boolean[][];

export function qrMuster(text: string): QrMuster {
  const q = qrcode(0, 'M');
  q.addData(text, 'Byte');
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

/** Breite der Ruhezone in Modulen (Norm: 4). */
export const QR_RAND = 4;

/** Die dunklen Module als ein SVG-Pfad – Koordinaten in Modulen, die Ruhezone schon eingerechnet. */
export function qrPfad(m: QrMuster): string {
  const teile: string[] = [];
  m.forEach((zeile, r) =>
    zeile.forEach((dunkel, c) => {
      if (dunkel) teile.push(`M${c + QR_RAND} ${r + QR_RAND}h1v1h-1z`);
    }),
  );
  return teile.join('');
}

/** Kantenlänge samt Ruhezone, in Modulen. */
export const qrGroesse = (m: QrMuster) => m.length + 2 * QR_RAND;

/** Das Muster als PNG – `punkt` Bildpunkte je Modul (scharf für Beamer und Gemeindebrief). */
export function qrPng(m: QrMuster, punkt = 16): Promise<Blob> {
  const seite = qrGroesse(m) * punkt;
  const c = document.createElement('canvas');
  c.width = seite;
  c.height = seite;
  const g = c.getContext('2d');
  if (!g) return Promise.reject(new Error('Das Bild des QR-Codes ließ sich nicht zeichnen.'));
  g.fillStyle = '#fff'; // bewusst fest: QR immer schwarz auf weiß
  g.fillRect(0, 0, seite, seite);
  g.fillStyle = '#000'; // bewusst fest
  m.forEach((zeile, r) =>
    zeile.forEach((dunkel, col) => {
      if (dunkel) g.fillRect((col + QR_RAND) * punkt, (r + QR_RAND) * punkt, punkt, punkt);
    }),
  );
  return new Promise((ok, fehler) =>
    c.toBlob(
      (b) => (b ? ok(b) : fehler(new Error('Das Bild des QR-Codes ließ sich nicht erstellen.'))),
      'image/png',
    ),
  );
}

/** Zeichnet das Muster ins PDF – `x`, `y`, `seite` in mm, die Ruhezone liegt innerhalb von `seite`. */
export function qrInsPdf(d: jsPDF, m: QrMuster, x: number, y: number, seite: number): void {
  const modul = seite / qrGroesse(m);
  d.setFillColor(0, 0, 0);
  m.forEach((zeile, r) =>
    zeile.forEach((dunkel, c) => {
      // Etwas überlappen lassen – sonst zeigen manche Betrachter feine Linien zwischen den Modulen.
      if (dunkel)
        d.rect(
          x + (c + QR_RAND) * modul,
          y + (r + QR_RAND) * modul,
          modul + 0.02,
          modul + 0.02,
          'F',
        );
    }),
  );
}
