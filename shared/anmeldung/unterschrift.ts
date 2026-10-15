/**
 * **Eine gezeichnete Unterschrift als kurzer Text** (A6-2b, Entwurf `a6-2b-entwurf-v2`).
 *
 * Gemessen 15.10.2026 (`messung-a6-2026-10-14.md`): Ein Gruppenfeld in ChurchTools fasst **höchstens 4.000 Zeichen**,
 * fest – eine höhere `maxLength` nimmt ChurchTools mit 200 an und ignoriert sie. Ein Bild (PNG) wäre zu groß.
 * Gespeichert werden deshalb nur die **Striche**: geglättet (Ramer-Douglas-Peucker) und als Differenzen kodiert,
 * 6 Bit je Zeichen. Eine nachgestellte Unterschrift mit gut 1.000 Punkten brauchte 360 Zeichen.
 *
 * Koordinaten in einer festen Fläche `BREITE × HOEHE` (2:1) – auf jedem Bildschirm dasselbe Seitenverhältnis,
 * sonst würde die Unterschrift beim Anzeigen verzerrt.
 */

export const BREITE = 600;
export const HOEHE = 300;
/** Gemessen: mehr nimmt ein ChurchTools-Feld nicht. */
export const MAX_ZEICHEN = 4000;
const KENNUNG = 'u1;';
const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export type Punkt = readonly [number, number];
export type Strich = Punkt[];

/** Abstand eines Punkts zur Geraden durch a und b. */
function abstand(p: Punkt, a: Punkt, b: Punkt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const laenge = Math.hypot(dx, dy);
  if (laenge === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / laenge;
}

/** Glätten: Punkte weglassen, die weniger als `eps` von der Linie abweichen (Ramer-Douglas-Peucker). */
export function glaetten(s: Strich, eps: number): Strich {
  if (s.length < 3) return s;
  const a = s[0];
  const b = s[s.length - 1];
  let max = 0;
  let idx = 0;
  for (let i = 1; i < s.length - 1; i++) {
    const d = abstand(s[i], a, b);
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [a, b];
  return [...glaetten(s.slice(0, idx + 1), eps).slice(0, -1), ...glaetten(s.slice(idx), eps)];
}

/** Eine ganze Zahl als 1–n Zeichen: Zickzack (Vorzeichen ins letzte Bit), je 5 Bit plus Fortsetzungsbit. */
function zahlText(n: number): string {
  let z = n < 0 ? -2 * n - 1 : 2 * n;
  let s = '';
  do {
    let teil = z & 31;
    z = Math.floor(z / 32);
    if (z) teil |= 32;
    s += ZEICHEN[teil];
  } while (z);
  return s;
}

const innen = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));

function kodiert(striche: Strich[], eps: number): string {
  const teile = striche.map((s) => {
    let px = 0;
    let py = 0;
    return glaetten(s, eps)
      .map(([x, y]) => {
        const t = zahlText(x - px) + zahlText(y - py);
        px = x;
        py = y;
        return t;
      })
      .join('');
  });
  return KENNUNG + teile.join('.');
}

/**
 * **Die Unterschrift als Text** – höchstens `MAX_ZEICHEN`. Reicht der Platz nicht, wird stärker geglättet (sieht
 * kantiger aus). `null` ohne Striche – oder bei so vielen Strichen, dass schon ihre Anfangs- und Endpunkte nicht
 * passen (mehrere hundert; eine Unterschrift hat eine Handvoll).
 */
export function unterschriftText(striche: Strich[]): string | null {
  const sauber = striche
    .map((s) => s.map(([x, y]) => [innen(x, BREITE), innen(y, HOEHE)] as const))
    .filter((s) => s.length > 0);
  if (sauber.length === 0) return null;
  // Bis es passt – zur Not bleiben von jedem Strich nur Anfang und Ende (eps größer als die Fläche).
  for (let eps = 1; eps <= BREITE * 2; eps *= 1.5) {
    const t = kodiert(sauber, eps);
    if (t.length <= MAX_ZEICHEN) return t;
  }
  return null;
}

/** **Die Striche aus dem Text** – für die Anzeige (Reiter Anmeldungen, Druckliste). `null`, wenn es keiner ist. */
export function unterschriftLesen(text: string): Strich[] | null {
  if (!text.startsWith(KENNUNG)) return null;
  const striche: Strich[] = [];
  for (const teil of text.slice(KENNUNG.length).split('.')) {
    const zahlen: number[] = [];
    let z = 0;
    let faktor = 1;
    for (const c of teil) {
      const v = ZEICHEN.indexOf(c);
      if (v < 0) return null;
      z += (v & 31) * faktor;
      if (v & 32) {
        faktor *= 32;
        continue;
      }
      zahlen.push(z % 2 ? -(z + 1) / 2 : z / 2);
      z = 0;
      faktor = 1;
    }
    if (zahlen.length % 2) return null;
    const s: Punkt[] = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i < zahlen.length; i += 2) {
      x += zahlen[i];
      y += zahlen[i + 1];
      s.push([x, y]);
    }
    if (s.length) striche.push(s);
  }
  return striche;
}
