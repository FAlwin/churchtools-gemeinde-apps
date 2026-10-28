import type { jsPDF } from 'jspdf';

/**
 * **Seiten, die schon als SVG am Bildschirm stehen, als PDF** (O7b-4) – die Vorschau IST das Blatt: Was das Fenster
 * zeigt, wird Seite für Seite übernommen, keine zweite Zeichnung fürs Papier.
 *
 * Die PDF kennt keine Stilvorlagen. Deshalb wird jede Seite vorher kopiert und bekommt, was der Browser für sie
 * ausgerechnet hat (Farben, Linien, Schrift), als Attribute – so gelten die gemeinsamen Farben (`ui/design`) auch
 * auf Papier, ohne dass ein Wert ein zweites Mal dasteht.
 */

export interface SvgSeite {
  svg: SVGSVGElement;
  /** Blatt in Millimetern – die `viewBox` der Seite ist in denselben Einheiten. */
  breite: number;
  hoehe: number;
}

/** Was aus den Stilregeln in die Attribute wandert. */
const EIGENSCHAFTEN = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-size',
  'text-anchor',
] as const;

/** Längen ohne Einheit – svg2pdf rechnet `px` in Schriftgrößen nicht wie der Browser. */
const ohnePx = (wert: string) => (/^-?[\d.]+px$/.test(wert) ? String(parseFloat(wert)) : wert);

/**
 * Eine Kopie der Seite mit den ausgerechneten Stilen als Attributen. Die Schrift ist immer `schrift`: In der PDF gibt
 * es nur die eingebettete. Schriftstärke nur normal oder fett – mehr Schnitte sind nicht eingebettet. `<title>`
 * (Hinweis beim Darüberfahren) gehört nicht aufs Papier.
 */
export function stileEinbetten(svg: SVGSVGElement, schrift: string): SVGSVGElement {
  const kopie = svg.cloneNode(true) as SVGSVGElement;
  const quellen = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const ziele = [kopie, ...Array.from(kopie.querySelectorAll('*'))];
  quellen.forEach((q, i) => {
    const z = ziele[i];
    const stil = getComputedStyle(q);
    for (const e of EIGENSCHAFTEN) {
      const wert = stil.getPropertyValue(e);
      if (wert) z.setAttribute(e, ohnePx(wert));
    }
    const gewicht = Number(stil.getPropertyValue('font-weight'));
    if (gewicht) z.setAttribute('font-weight', gewicht >= 600 ? 'bold' : 'normal');
    const grundlinie = stil.getPropertyValue('dominant-baseline');
    if (grundlinie && grundlinie !== 'auto') z.setAttribute('dominant-baseline', grundlinie);
    z.setAttribute('font-family', schrift);
    z.removeAttribute('class');
    z.removeAttribute('style');
  });
  kopie.querySelectorAll('title').forEach((t) => t.remove());
  return kopie;
}

/**
 * Die Grundlinie mittig gesetzter Texte (`dominant-baseline: central` – so zentriert das Diagramm die Namen im
 * Kästchen) als feste Lage. svg2pdf kennt nur `alignment-baseline` und setzt die Namen damit sichtbar zu hoch (Demo
 * 28.10.2026). Den Versatz kennt der Browser: Der Rahmen des Textes einmal mit, einmal ohne die Angabe (die Lage des
 * ersten Zeichens zeigt ihn nicht – gemessen in Chromium, 50 statt 55,5 bei 14er-Schrift). Die Kopie muss dazu
 * eingehängt sein. Ohne Messung (kein Zeichen, Testumgebung) bleibt es bei `alignment-baseline`.
 */
export function grundlinienFestlegen(kopie: SVGSVGElement): void {
  for (const t of Array.from(kopie.querySelectorAll('text'))) {
    const grundlinie = t.getAttribute('dominant-baseline');
    if (!grundlinie) continue;
    let versatz: number | null = null;
    try {
      const mit = t.getBBox();
      t.removeAttribute('dominant-baseline');
      const ohne = t.getBBox();
      if (mit.height > 0) versatz = mit.y - ohne.y;
    } catch {
      versatz = null;
    }
    t.removeAttribute('dominant-baseline');
    const y = parseFloat(t.getAttribute('y') ?? '0');
    if (versatz !== null && Number.isFinite(versatz) && Number.isFinite(y)) {
      t.setAttribute('y', String(y + versatz));
    } else t.setAttribute('alignment-baseline', grundlinie);
  }
}

/**
 * Die PDF aus den Seiten – jede in ihrem eigenen Format (quer bleibt quer, auch in Safari, das `@page { size }` beim
 * Drucken nicht beachtet: Grund für diesen Weg, Rückmeldung Alwin 28.10.2026). jsPDF, svg2pdf und die Schrift werden
 * erst hier geladen.
 */
export async function svgSeitenPdf(
  seiten: readonly SvgSeite[],
  info: { titel: string; thema?: string },
): Promise<jsPDF> {
  if (!seiten.length) throw new Error('Keine Seite für die PDF.');
  const [{ jsPDF }, { svg2pdf }, { latoEinbetten, schriftImDokument, PDF_SCHRIFT }] =
    await Promise.all([import('jspdf'), import('svg2pdf.js'), import('./pdfSchrift')]);
  const lage = (s: SvgSeite) => (s.breite > s.hoehe ? 'landscape' : 'portrait');
  const doc = new jsPDF({
    unit: 'mm',
    format: [seiten[0].breite, seiten[0].hoehe],
    orientation: lage(seiten[0]),
  });
  latoEinbetten(doc);
  // Ohne die Schrift im Dokument wird die PDF trotzdem – nur rechtsbündige Texte sitzen dann etwas daneben.
  await schriftImDokument().catch(() => undefined);
  doc.setProperties({ title: info.titel, subject: info.thema ?? '', creator: 'ChurchTools' });
  // svg2pdf liest Maße am eingehängten Element – die Kopien liegen kurz unsichtbar außerhalb der Seite.
  const ablage = document.createElement('div');
  ablage.setAttribute('aria-hidden', 'true');
  ablage.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden';
  document.body.appendChild(ablage);
  try {
    for (const [i, s] of seiten.entries()) {
      if (i > 0) doc.addPage([s.breite, s.hoehe], lage(s));
      const kopie = stileEinbetten(s.svg, PDF_SCHRIFT);
      ablage.replaceChildren(kopie);
      grundlinienFestlegen(kopie);
      await svg2pdf(kopie, doc, { x: 0, y: 0, width: s.breite, height: s.hoehe });
    }
  } finally {
    ablage.remove();
  }
  return doc;
}
