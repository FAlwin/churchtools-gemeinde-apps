import { describe, expect, it } from 'vitest';
import { ausschnittAus, faktorFuerBlattBreite, transformAus } from './zoomAusschnitt';

/**
 * #420: Zoom als Ausschnitt des Blatts. Geprüft wird das, woran der Fehler hing: Nach einer neuen
 * Flächengröße (Vollbild, Drehen) muss DIESELBE Stelle des Blatts in der Mitte stehen – und am Rand
 * darf nichts herausrutschen.
 */
const GRENZEN = { min: 1, max: 6 };

describe('zoomAusschnitt', () => {
  // iPad hoch mit Leisten: Fläche 820 × 1000, Blatt an der Höhe eingepasst (A4 ≈ 707 × 1000).
  const flaeche = { w: 820, h: 1000 };
  const blatt = { x: 56.5, y: 0, w: 707, h: 1000 };

  it('Rundlauf: Ausschnitt und zurück ergibt denselben Zoom', () => {
    const t = { x: -400, y: -600, scale: 2 };
    const a = ausschnittAus(t, flaeche, blatt)!;
    expect(transformAus(a, t.scale, flaeche, blatt, GRENZEN)).toEqual(t);
  });

  it('Vollbild: dieselbe Stelle des Blatts steht wieder in der Mitte', () => {
    const t = { x: -400, y: -600, scale: 2 };
    const a = ausschnittAus(t, flaeche, blatt)!;
    // Vollbild: Fläche 820 × 1180, Blatt jetzt an der BREITE eingepasst (820 × 1160), mittig.
    const voll = { w: 820, h: 1180 };
    const blattVoll = { x: 0, y: 10, w: 820, h: 1160 };
    const s = faktorFuerBlattBreite(a.blattBreite, blattVoll);
    const neu = transformAus(a, s, voll, blattVoll, GRENZEN);
    const danach = ausschnittAus(neu, voll, blattVoll)!;
    expect(danach.fx).toBeCloseTo(a.fx, 6);
    expect(danach.fy).toBeCloseTo(a.fy, 6);
    // …und das Blatt erscheint so breit wie vorher (die Schrift wächst nicht mit).
    expect(danach.blattBreite).toBeCloseTo(a.blattBreite, 6);
  });

  it('der ALTE Fehler: dieselben Pixel auf der neuen Fläche zeigen eine andere Stelle', () => {
    const t = { x: -400, y: -600, scale: 2 };
    const a = ausschnittAus(t, flaeche, blatt)!;
    const voll = { w: 820, h: 1180 };
    const blattVoll = { x: 0, y: 10, w: 820, h: 1160 };
    const alt = ausschnittAus(t, voll, blattVoll)!;
    // Die Mitte rutscht nach oben (andere Stelle), und das Blatt erscheint größer, weil es neu
    // eingepasst wurde, der Faktor aber blieb – deshalb stand es rechts über den Rand hinaus.
    expect(Math.abs(alt.fy - a.fy)).toBeGreaterThan(0.03);
    expect(alt.blattBreite).toBeGreaterThan(a.blattBreite * 1.1);
  });

  it('begrenzt am Rand: kein leerer Streifen, wo vorher Blatt war', () => {
    // Ganz rechts unten reingezoomt – auf einer breiteren Fläche würde die Mitte zu weit wandern.
    const neu = transformAus(
      { fx: 1, fy: 1 },
      3,
      { w: 1000, h: 800 },
      { x: 0, y: 0, w: 1000, h: 800 },
      GRENZEN,
    );
    expect(neu.x).toBe(1000 * (1 - 3));
    expect(neu.y).toBe(800 * (1 - 3));
    const links = transformAus(
      { fx: 0, fy: 0 },
      3,
      { w: 1000, h: 800 },
      { x: 0, y: 0, w: 1000, h: 800 },
      GRENZEN,
    );
    expect(links.x).toBe(0);
    expect(links.y).toBe(0);
  });

  it('hält den Faktor in den Grenzen der Bibliothek', () => {
    expect(transformAus({ fx: 0.5, fy: 0.5 }, 0.4, flaeche, blatt, GRENZEN).scale).toBe(1);
    expect(transformAus({ fx: 0.5, fy: 0.5 }, 9, flaeche, blatt, GRENZEN).scale).toBe(6);
  });

  it('liefert nichts bei einem Blatt ohne Größe (noch nicht vermessen)', () => {
    expect(ausschnittAus({ x: 0, y: 0, scale: 2 }, flaeche, { x: 0, y: 0, w: 0, h: 0 })).toBeNull();
  });
});
