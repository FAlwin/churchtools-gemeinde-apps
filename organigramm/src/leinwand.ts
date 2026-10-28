/**
 * **Die Rechnung der Leinwand** (O7b-3): wo das Diagramm in der Fläche liegt – verschoben (`x`, `y`) und vergrößert
 * (`s`). Ohne Browser prüfbar; das Ziehen und Zoomen mit Maus und Fingern steht in `Diagramm.tsx`.
 */
import type { Anordnung } from '@shared/organigramm/ansichten';

export interface Blick {
  s: number;
  x: number;
  y: number;
}

export interface Flaeche {
  breite: number;
  hoehe: number;
  /**
   * Unten frei zu halten (px): Dort liegen die Knöpfe − / + / „Ganz zeigen“ über dem Diagramm. Ohne das lagen sie beim
   * Ganz-Zeigen über dem untersten Kästchen (Alwin, 28.10.2026).
   */
  unten?: number;
}

/** Kleiner und größer geht es nicht – darunter ist nichts mehr zu lesen, darüber nur noch ein Kästchen. */
export const KLEINST = 0.15;
export const GROESST = 3;
/** Rand um das ganze Diagramm bei „Ganz zeigen“. */
const RAND = 24;
/** Lesbar: Darunter fängt der Blick lieber groß an der Spitze an, als alles winzig zu zeigen (Entwurf 26.10.2026). */
export const LESBAR = 0.7;
/** So groß fängt der Blick an der Spitze an, wenn nicht alles lesbar passt. */
const ANFANG = 0.85;
/** Nicht größer als so beim Ganz-Zeigen – ein kleiner Baum soll nicht riesig werden. */
const GANZ_HOECHSTENS = 1.15;

const begrenzt = (s: number) => Math.min(GROESST, Math.max(KLEINST, s));

/** Die Höhe, in die eingepasst wird – ohne den Streifen der Knöpfe. */
const nutzbar = (f: Flaeche) => f.hoehe - Math.max(0, f.unten ?? 0);

/** Ohne Fläche (noch nicht gezeichnet, unsichtbar) lässt sich nichts einpassen – dann bleibt alles, wie es ist. */
const leer = (f: Flaeche) => f.breite <= 0 || nutzbar(f) <= 0;

/** „Ganz zeigen“: das ganze Diagramm mittig in der Fläche über dem Streifen der Knöpfe. */
export function ganz(rahmen: Anordnung['rahmen'], f: Flaeche): Blick {
  if (leer(f)) return { s: 1, x: 0, y: 0 };
  const h = nutzbar(f);
  const s = begrenzt(
    Math.min((f.breite - 2 * RAND) / rahmen.breite, (h - 2 * RAND) / rahmen.hoehe, GANZ_HOECHSTENS),
  );
  return {
    s,
    x: (f.breite - rahmen.breite * s) / 2 - rahmen.x * s,
    y: (h - rahmen.hoehe * s) / 2 - rahmen.y * s,
  };
}

/**
 * Wie der Blick anfängt: Passt alles lesbar hinein, ganz. Sonst lesbar groß an der Spitze – der Anker sagt, wo sie in
 * der Fläche hinkommt (von oben: oben in der Mitte, von links: links in der Mitte, Mindmap: in der Mitte).
 */
export function anfang(a: Pick<Anordnung, 'rahmen' | 'anker'>, f: Flaeche): Blick {
  if (leer(f)) return { s: 1, x: 0, y: 0 };
  const h = nutzbar(f);
  const passt = Math.min((f.breite - 2 * RAND) / a.rahmen.breite, (h - 2 * RAND) / a.rahmen.hoehe);
  if (passt >= LESBAR) return ganz(a.rahmen, f);
  const { x, y, fx, fy } = a.anker;
  return {
    s: ANFANG,
    x: fx * f.breite + (fx ? 0 : RAND) - x * ANFANG,
    y: fy * h + (fy ? 0 : RAND) - y * ANFANG,
  };
}

/** Um einen Punkt der Fläche vergrößern (Mausrad, zwei Finger, − / +): Der Punkt bleibt, wo er ist. */
export function zoomen(b: Blick, faktor: number, px: number, py: number): Blick {
  const s = begrenzt(b.s * faktor);
  const f = s / b.s;
  return { s, x: px - (px - b.x) * f, y: py - (py - b.y) * f };
}

export function verschieben(b: Blick, dx: number, dy: number): Blick {
  return { ...b, x: b.x + dx, y: b.y + dy };
}
