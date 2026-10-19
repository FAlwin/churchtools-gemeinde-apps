/**
 * **Lasso-Rechnung** (#615): einkreisen, verschieben, vergrößern. Alles in **Anteilen der Fläche** (0..1) –
 * so gilt dieselbe Rechnung für eine A4-Seite und für die lange Rolle, egal wie scharf gezeichnet.
 */

export interface Punkt {
  x: number;
  y: number;
}

export interface Rahmen {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Verschiebung und Vergrößerung einer Auswahl (Anker: linke obere Ecke des Rahmens). */
export interface Verwandlung {
  dx: number;
  dy: number;
  s: number;
}

export const OHNE: Verwandlung = { dx: 0, dy: 0, s: 1 };

/** Kleiner als ein Fünftel und größer als das Vierfache wird es nicht – sonst verliert man es. */
export const MASSSTAB = { min: 0.2, max: 4 };

/** Liegt der Punkt in der Lasso-Form? (Strahl-Verfahren; die Form schließt sich selbst.) */
export function imLasso(p: Punkt, form: Punkt[]): boolean {
  let innen = false;
  for (let i = 0, j = form.length - 1; i < form.length; j = i++) {
    const a = form[i];
    const b = form[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      innen = !innen;
    }
  }
  return innen;
}

/** Der umschließende Rahmen der Form, auf die Fläche begrenzt. */
export function rahmenUm(form: Punkt[]): Rahmen {
  const xs = form.map((p) => Math.min(1, Math.max(0, p.x)));
  const ys = form.map((p) => Math.min(1, Math.max(0, p.y)));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Wo der Rahmen nach der Verwandlung steht. */
export function verwandelterRahmen(r: Rahmen, v: Verwandlung): Rahmen {
  return { x: r.x + v.dx, y: r.y + v.dy, w: r.w * v.s, h: r.h * v.s };
}

/** Ein Punkt der Auswahl nach der Verwandlung (relativ zur linken oberen Ecke vergrößert). */
export function verwandelterPunkt(p: Punkt, r: Rahmen, v: Verwandlung): Punkt {
  return { x: r.x + v.dx + (p.x - r.x) * v.s, y: r.y + v.dy + (p.y - r.y) * v.s };
}

/**
 * Ziehen am Griff (rechte untere Ecke): neuer Maßstab aus der Breite. Gleichmäßig in beide Richtungen –
 * ein verzogenes Notenzeichen hilft niemandem. `seitenVerhaeltnis` = Breite/Höhe der Fläche in Bildpunkten;
 * gezogen wird in Anteilen, also in x und y verschieden großen Einheiten.
 */
export function massstabAusZiehen(
  r: Rahmen,
  start: Verwandlung,
  zugX: number,
  zugY: number,
  seitenVerhaeltnis: number,
): number {
  // Den längeren Zug nehmen – in gleichen Einheiten (Anteile der Breite).
  const breite = r.w * start.s;
  const hoeheInBreite = (r.h * start.s) / seitenVerhaeltnis;
  const zuX = breite > 0 ? (breite + zugX) / breite : 1;
  const zuY = hoeheInBreite > 0 ? (hoeheInBreite + zugY / seitenVerhaeltnis) / hoeheInBreite : 1;
  const faktor = Math.abs(zuX - 1) >= Math.abs(zuY - 1) ? zuX : zuY;
  return Math.min(MASSSTAB.max, Math.max(MASSSTAB.min, start.s * faktor));
}

/** Liegt der Punkt im (verwandelten) Rahmen – mit etwas Spielraum für den Finger? */
export function imRahmen(p: Punkt, r: Rahmen, spiel = 0.01): boolean {
  return (
    p.x >= r.x - spiel && p.x <= r.x + r.w + spiel && p.y >= r.y - spiel && p.y <= r.y + r.h + spiel
  );
}

/** Der Rahmen der Form in ganzen Bildpunkten einer Fläche `w`×`h` (mindestens 1×1). */
export function pixelRahmen(
  form: Punkt[],
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  const r = rahmenUm(form);
  const x = Math.floor(r.x * w);
  const y = Math.floor(r.y * h);
  return {
    x,
    y,
    w: Math.max(1, Math.ceil((r.x + r.w) * w) - x),
    h: Math.max(1, Math.ceil((r.y + r.h) * h) - y),
  };
}

/** Die Form als Zeichenpfad in Bildpunkten, verschoben um (`dx`, `dy`) – z. B. relativ zu ihrem Rahmen. */
export function lassoPfad(form: Punkt[], w: number, h: number, dx = 0, dy = 0): Path2D {
  const p = new Path2D();
  form.forEach((q, i) =>
    i ? p.lineTo(q.x * w - dx, q.y * h - dy) : p.moveTo(q.x * w - dx, q.y * h - dy),
  );
  p.closePath();
  return p;
}

/** Steht auf der Leinwand irgendein sichtbarer Bildpunkt? */
export function hatInhalt(c: HTMLCanvasElement): boolean {
  const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
  if (!d) return false;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
  return false;
}
