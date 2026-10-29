/**
 * **Wie breit ein Name ist** (O7b-3) – gemessen mit der Schrift der Seite, damit jedes Kästchen genau so breit wird,
 * wie sein Name es braucht. Ohne Zeichenfläche (alte Browser, Tests) wird geschätzt; ein Kästchen ist dann etwas zu
 * breit oder zu schmal, aber nichts bricht.
 */
let flaeche: CanvasRenderingContext2D | null | undefined;

export function textBreite(text: string, fett: boolean, schrift: string, groesse = 14): number {
  if (flaeche === undefined) {
    try {
      flaeche = document.createElement('canvas').getContext('2d');
    } catch {
      flaeche = null;
    }
  }
  if (!flaeche) return text.length * (fett ? 8.2 : 7.6) * (groesse / 14);
  flaeche.font = `${fett ? 700 : 400} ${groesse}px ${schrift}`;
  return flaeche.measureText(text).width;
}
