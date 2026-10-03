/**
 * **Zoom als Ausschnitt des Blatts, nicht als Pixel** (#420, 03.10.2026).
 *
 * Die Zoom-Bibliothek (react-zoom-pan-pinch) beschreibt einen Zoom als Verschiebung in Pixeln plus
 * Faktor. Ihre Zoom-Ebene ist so groß wie die ganze Anzeigefläche, das Blatt sitzt darin zentriert.
 * Ändert sich die Fläche – Vollbild an/aus, Drehen –, wird das Blatt neu eingepasst, die Pixel bleiben
 * aber dieselben: Der Ausschnitt verrutschte, das Blatt war seitlich angeschnitten (Alwin am iPad).
 *
 * Deshalb hier die Umrechnung in eine Größe, die eine neue Fläche übersteht: **welche Stelle des
 * Blatts in der Mitte steht** (Anteile `fx`/`fy` von 0 bis 1) und **wie breit das Blatt auf dem
 * Bildschirm ist**. Rein und ohne DOM – die Werte liefert der Aufrufer.
 */

/** Die Zoom-Ebene (bei uns = Anzeigefläche): Breite und Höhe in CSS-Pixeln. */
export interface Flaeche {
  w: number;
  h: number;
}

/** Das Blatt innerhalb der Zoom-Ebene, ungezoomt: linke obere Ecke und Größe in CSS-Pixeln. */
export interface Blatt {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ein Zoom, wie die Bibliothek ihn führt. */
export interface ZoomTransform {
  x: number;
  y: number;
  scale: number;
}

/** Ein Zoom als Ausschnitt des Blatts – übersteht eine neue Flächengröße. */
export interface Ausschnitt {
  /** Mitte der Ansicht als Anteil der Blattbreite (0 = linker Rand, 1 = rechter Rand). */
  fx: number;
  /** Mitte der Ansicht als Anteil der Blatthöhe. */
  fy: number;
  /** Breite des Blatts auf dem Bildschirm in CSS-Pixeln – „wie groß der Text erscheint". */
  blattBreite: number;
}

/** Zoom-Grenzen der Liedblätter – eine Quelle für die Zoom-Ebene (`PageDeck`) und die Umrechnung. */
export const ZOOM_GRENZEN = { min: 1, max: 6 } as const;

const begrenze = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Aus einem Zoom der Bibliothek den Ausschnitt des Blatts machen. */
export function ausschnittAus(t: ZoomTransform, flaeche: Flaeche, blatt: Blatt): Ausschnitt | null {
  if (!(t.scale > 0) || !(blatt.w > 0) || !(blatt.h > 0)) return null;
  // Mitte der Ansicht in ungezoomten Ebenen-Koordinaten.
  const mx = (flaeche.w / 2 - t.x) / t.scale;
  const my = (flaeche.h / 2 - t.y) / t.scale;
  return {
    fx: (mx - blatt.x) / blatt.w,
    fy: (my - blatt.y) / blatt.h,
    blattBreite: blatt.w * t.scale,
  };
}

/**
 * Aus Ausschnitt und Faktor wieder einen Zoom für die AKTUELLE Fläche machen.
 *
 * Begrenzt wie die Bibliothek mit `limitToBounds` (Ebene = Fläche): Die gezoomte Ebene muss die
 * Fläche ganz bedecken, `x` liegt also zwischen `w · (1 − scale)` und 0. Ohne das stünde nach dem
 * Umrechnen am Rand ein leerer Streifen, wo vorher Blatt war.
 */
export function transformAus(
  a: { fx: number; fy: number },
  scale: number,
  flaeche: Flaeche,
  blatt: Blatt,
  grenzen: { min: number; max: number },
): ZoomTransform {
  const s = begrenze(scale, grenzen.min, grenzen.max);
  const mx = blatt.x + a.fx * blatt.w;
  const my = blatt.y + a.fy * blatt.h;
  return {
    x: begrenze(flaeche.w / 2 - mx * s, flaeche.w * (1 - s), 0),
    y: begrenze(flaeche.h / 2 - my * s, flaeche.h * (1 - s), 0),
    scale: s,
  };
}

/**
 * Faktor, mit dem das Blatt auf einer NEUEN Fläche wieder so breit erscheint wie vorher – die
 * Schrift bleibt beim Umschalten ins Vollbild gleich groß, statt mit dem neu eingepassten Blatt
 * mitzuwachsen.
 */
export function faktorFuerBlattBreite(blattBreite: number, blatt: Blatt): number {
  return blatt.w > 0 ? blattBreite / blatt.w : 1;
}
