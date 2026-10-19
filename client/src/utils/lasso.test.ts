import { describe, expect, it } from 'vitest';
import {
  MASSSTAB,
  OHNE,
  imLasso,
  imRahmen,
  massstabAusZiehen,
  pixelRahmen,
  rahmenUm,
  verwandelterPunkt,
  verwandelterRahmen,
} from './lasso';

// Ein „U": offen nach oben – der Punkt in der Kerbe liegt im Rahmen, aber NICHT in der Form.
const U = [
  { x: 0.1, y: 0.1 },
  { x: 0.3, y: 0.1 },
  { x: 0.3, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 0.7, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];

describe('imLasso – die Form entscheidet, nicht ihr Rahmen (#615)', () => {
  it('innen, außen und in der Kerbe einer eingebuchteten Form', () => {
    expect(imLasso({ x: 0.2, y: 0.5 }, U)).toBe(true);
    expect(imLasso({ x: 0.5, y: 0.8 }, U)).toBe(true);
    expect(imLasso({ x: 0.5, y: 0.3 }, U)).toBe(false); // Kerbe
    expect(imRahmen({ x: 0.5, y: 0.3 }, rahmenUm(U))).toBe(true);
    expect(imLasso({ x: 0.95, y: 0.5 }, U)).toBe(false);
  });
});

describe('rahmenUm / pixelRahmen', () => {
  it('über den Rand gezogen: auf die Fläche begrenzt', () => {
    const r = rahmenUm([
      { x: -0.2, y: 0.5 },
      { x: 0.4, y: 1.3 },
      { x: 0.1, y: 0.2 },
    ]);
    expect(r).toEqual({ x: 0, y: 0.2, w: 0.4, h: 0.8 });
  });

  it('in Bildpunkten nach außen gerundet – nichts am Rand der Form fällt heraus', () => {
    const p = pixelRahmen(
      [
        { x: 0.101, y: 0.2 },
        { x: 0.3005, y: 0.4 },
        { x: 0.2, y: 0.7999 },
      ],
      1000,
      500,
    );
    expect(p).toEqual({ x: 101, y: 100, w: 200, h: 300 });
  });
});

describe('Verschieben und Vergrößern', () => {
  const r = { x: 0.2, y: 0.4, w: 0.2, h: 0.1 };

  it('ohne Verwandlung bleibt alles, wo es ist', () => {
    expect(verwandelterRahmen(r, OHNE)).toEqual(r);
    expect(verwandelterPunkt({ x: 0.3, y: 0.45 }, r, OHNE)).toEqual({ x: 0.3, y: 0.45 });
  });

  it('ein Text in der Mitte der Auswahl bleibt in der Mitte des verwandelten Rahmens', () => {
    const v = { dx: 0.1, dy: -0.2, s: 2 };
    const z = verwandelterRahmen(r, v);
    const p = verwandelterPunkt({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, r, v);
    expect(p.x).toBeCloseTo(z.x + z.w / 2, 12);
    expect(p.y).toBeCloseTo(z.y + z.h / 2, 12);
  });

  it('der Griff vergrößert gleichmäßig – nach dem längeren Zug, auch auf einer hohen Fläche', () => {
    // Rolle: 4× so hoch wie breit. Rahmen 0.2 breit, 0.05 hoch → in Bildpunkten ein Quadrat.
    const q = { x: 0.1, y: 0.1, w: 0.2, h: 0.05 };
    // 0.2 nach rechts = doppelte Breite.
    expect(massstabAusZiehen(q, OHNE, 0.2, 0, 0.25)).toBeCloseTo(2, 12);
    // 0.05 nach unten = doppelte Höhe – gleiche Bildpunkte, gleicher Maßstab.
    expect(massstabAusZiehen(q, OHNE, 0, 0.05, 0.25)).toBeCloseTo(2, 12);
  });

  it('nicht kleiner als MASSSTAB.min, nicht größer als MASSSTAB.max', () => {
    expect(massstabAusZiehen(r, OHNE, -5, 0, 1)).toBe(MASSSTAB.min);
    expect(massstabAusZiehen(r, OHNE, 50, 0, 1)).toBe(MASSSTAB.max);
  });
});
