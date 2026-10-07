import type { PageTextObj } from '../hooks/usePageDraw';
import type { AnmerkungsEbene } from './ablaufPdf';
import { readPageTexts } from './annotationKeys';
import { drawKeyForOwner } from './streamKeys';
import { textStyleOf } from './textObjStyle';

/**
 * **Die eigenen Anmerkungen einer Seite als durchsichtiges Bild** – für das Teilen als PDF (Alwin,
 * 07.10.2026: „zum Üben digital, beim Auftritt Blätter").
 *
 * Gelesen wird, was das Liedblatt zeigt: die Striche (PNG unter dem Seitenschlüssel) und die Texte
 * (`<Schlüssel>_text`). Gezeichnet wird so wie auf dem Bildschirm (`PageTextLayer`, `.textObj`):
 * linke obere Ecke bei `fx`/`fy`, Größe in Prozent der Seitenhöhe (`cqh`), Zeilenhöhe 1, die Format-
 * Vorgaben aus `textStyleOf` – nicht ein zweites Mal hingeschrieben. Nur EIGENE Anmerkungen: fremde
 * (Team-Notizen) gehören nicht in ein PDF, das man weitergibt.
 */

/** Schrift der Anmerkungstexte – wie `--ui` in `_variables.scss`. */
const SCHRIFT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function bildLaden(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    // Ein kaputtes Bild darf das Teilen nicht verhindern – die Seite kommt dann ohne Striche.
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Einen Anmerkungstext auf die Leinwand zeichnen (Seite `breite` × `hoehe`). */
function textZeichnen(
  ctx: CanvasRenderingContext2D,
  o: PageTextObj,
  breite: number,
  hoehe: number,
) {
  const st = textStyleOf(o);
  const px = (o.sizeCqh / 100) * hoehe;
  ctx.font = `${st.italic ? 'italic ' : ''}${st.bold ? 700 : 400} ${px}px ${SCHRIFT}`;
  ctx.fillStyle = o.color;
  ctx.textBaseline = 'top';
  const zeilen = o.text.split('\n');
  const kasten = Math.max(...zeilen.map((z) => ctx.measureText(z).width));
  const links = o.fx * breite;
  zeilen.forEach((zeile, i) => {
    const w = ctx.measureText(zeile).width;
    const x =
      links + (st.align === 'center' ? (kasten - w) / 2 : st.align === 'right' ? kasten - w : 0);
    const y = o.fy * hoehe + i * px;
    ctx.fillText(zeile, x, y);
    if (st.underline) ctx.fillRect(x, y + px * 0.92, w, Math.max(1, px * 0.06));
  });
}

/**
 * Die Anmerkungen unter `schluessel` als PNG (durchsichtig) in `breite` × `hoehe` – oder `null`, wenn
 * die Seite keine hat. Die Striche werden auf die Seite gestreckt: Sie wurden auf einer Leinwand in
 * Seitengröße gezeichnet, nur in der Auflösung des Geräts.
 */
export async function anmerkungAlsBild(
  schluessel: string,
  breite: number,
  hoehe: number,
): Promise<string | null> {
  const striche = localStorage.getItem(schluessel);
  const texte = readPageTexts<PageTextObj>(schluessel).filter((t) => t.text.trim() !== '');
  if (!striche && texte.length === 0) return null;
  const c = document.createElement('canvas');
  c.width = breite;
  c.height = hoehe;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  if (striche) {
    const img = await bildLaden(striche);
    if (img) ctx.drawImage(img, 0, 0, breite, hoehe);
  }
  for (const t of texte) textZeichnen(ctx, t, breite, hoehe);
  return c.toDataURL('image/png');
}

/**
 * Die EIGENEN Anmerkungen einer Seite für `ablaufPdfBauen` – Schlüssel über `drawKeyForOwner`, dieselbe
 * Funktion wie im Liedblatt. Eine zweite Zusammensetzung wäre die sechste Stelle der Schlüssel-
 * Grammatik (siehe `annotationKeys.ts`, „FÜNF Stellen").
 */
export const eigeneEbene: AnmerkungsEbene = (seite, lyricsOnly, breite, hoehe) =>
  anmerkungAlsBild(drawKeyForOwner(seite, lyricsOnly), breite, hoehe);
