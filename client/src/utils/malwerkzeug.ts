import type { DrawTool } from '../types/index';

/**
 * **Malt dieses Werkzeug Striche auf die Leinwand?** (#615) Stift, Marker und Radierer ja; Text und Lasso
 * haben ihre eigene Ebene. Die Regel stand vorher dreimal als `drawTool !== 'text'` im Code (Blättern,
 * Rolle, Zeichen-Engine) – mit dem Lasso wäre sie an jeder Stelle einzeln nachzuziehen gewesen.
 */
export function maltStriche(t: DrawTool): boolean {
  return t === 'pen' || t === 'marker' || t === 'eraser';
}
