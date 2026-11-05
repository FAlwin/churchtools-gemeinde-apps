// Ohne Abhängigkeiten (kein pdf.js) – damit es Liederheft und Editor-Vorschau gleichermaßen nutzen und
// es sich ohne Worker testen lässt.

/**
 * Größte Leinwand, die iOS-Safari zuverlässig zeichnet (16,7 Mio. Bildpunkte). Darüber bleibt sie
 * still LEER. Mit A4 kein Thema; die Rolle des Scroll-Modus (#607) kann aber sehr lang werden – dann
 * wird sie etwas weniger scharf gezeichnet statt gar nicht.
 */
export const MAX_BILDPUNKTE = 16_000_000;

/** Der Maßstab, mit dem eine Seite noch unter `MAX_BILDPUNKTE` bleibt – höchstens der gewünschte. */
export function wirksamerMassstab(basis: { width: number; height: number }, scale: number): number {
  const passt = Math.sqrt(MAX_BILDPUNKTE / (basis.width * basis.height));
  return Math.min(scale, passt);
}
