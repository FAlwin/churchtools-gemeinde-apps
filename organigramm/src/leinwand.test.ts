import { describe, expect, it } from 'vitest';
import { anfang, ganz, GROESST, KLEINST, verschieben, zoomen } from './leinwand';

const F = { breite: 800, hoehe: 600 };

describe('ganz', () => {
  it('passt das Diagramm mittig mit Rand ein', () => {
    const b = ganz({ x: 0, y: 0, breite: 1504, hoehe: 200 }, F);
    expect(b.s).toBeCloseTo(0.5);
    // mittig: links wie rechts gleich viel Platz
    expect(b.x).toBeCloseTo((800 - 1504 * 0.5) / 2);
    expect(b.y).toBeCloseTo((600 - 200 * 0.5) / 2);
  });

  it('ein kleiner Baum wird nicht riesig; einer, der links ins Minus reicht, rückt ein', () => {
    expect(ganz({ x: 0, y: 0, breite: 100, hoehe: 36 }, F).s).toBe(1.15);
    const b = ganz({ x: -300, y: -50, breite: 600, hoehe: 100 }, F);
    expect(b.x + -300 * b.s).toBeCloseTo((800 - 600 * b.s) / 2);
  });

  it('ohne Fläche (noch nicht gezeichnet) bleibt alles bei 1:1 – keine negativen Größen', () => {
    expect(ganz({ x: 0, y: 0, breite: 500, hoehe: 500 }, { breite: 0, hoehe: 0 })).toEqual({
      s: 1,
      x: 0,
      y: 0,
    });
  });

  it('nie kleiner als das Kleinste', () => {
    expect(ganz({ x: 0, y: 0, breite: 100000, hoehe: 100 }, F).s).toBe(KLEINST);
  });
});

describe('anfang', () => {
  const anker = { x: 400, y: 0, fx: 0.5, fy: 0 };

  it('passt alles lesbar hinein → ganz zeigen', () => {
    const rahmen = { x: 0, y: 0, breite: 900, hoehe: 400 };
    expect(anfang({ rahmen, anker }, F)).toEqual(ganz(rahmen, F));
  });

  it('zu groß → lesbar groß, die Spitze am Anker (von oben: oben in der Mitte)', () => {
    const b = anfang({ rahmen: { x: 0, y: 0, breite: 3000, hoehe: 400 }, anker }, F);
    expect(b.s).toBe(0.85);
    expect(400 * b.s + b.x).toBeCloseTo(400); // Spitze in der Mitte
    expect(0 * b.s + b.y).toBe(24); // oben mit Rand
  });

  it('von links: Spitze links mit Rand, senkrecht in der Mitte', () => {
    const b = anfang(
      {
        rahmen: { x: 0, y: -2000, breite: 600, hoehe: 4000 },
        anker: { x: 0, y: 23, fx: 0, fy: 0.5 },
      },
      F,
    );
    expect(b.x).toBe(24);
    expect(23 * b.s + b.y).toBeCloseTo(300);
  });
});

describe('zoomen und verschieben', () => {
  it('der Punkt unter der Maus bleibt, wo er ist', () => {
    const b = { s: 1, x: 10, y: 20 };
    const z = zoomen(b, 2, 300, 200);
    // Bildpunkt unter (300|200) vorher: ((300-10)/1, (200-20)/1) = (290|180)
    expect(290 * z.s + z.x).toBeCloseTo(300);
    expect(180 * z.s + z.y).toBeCloseTo(200);
  });

  it('begrenzt nach unten und oben – und dann bewegt sich auch nichts', () => {
    expect(zoomen({ s: KLEINST, x: 5, y: 5 }, 0.5, 100, 100)).toEqual({ s: KLEINST, x: 5, y: 5 });
    expect(zoomen({ s: 2, x: 0, y: 0 }, 10, 0, 0).s).toBe(GROESST);
  });

  it('verschieben ändert nur die Lage', () => {
    expect(verschieben({ s: 2, x: 1, y: 1 }, 5, -3)).toEqual({ s: 2, x: 6, y: -2 });
  });
});

describe('Streifen der Knöpfe unten (O7b-5, Alwin 28.10.2026)', () => {
  const r = { x: 0, y: 0, breite: 400, hoehe: 1104 };
  const MIT = { ...F, unten: 50 };
  const unterkante = (b: { s: number; y: number }) => b.y + (r.y + r.hoehe) * b.s;

  it('„Ganz zeigen“ lässt den Streifen frei – ohne ihn lag das Unterste unter den Knöpfen', () => {
    expect(unterkante(ganz(r, F))).toBeGreaterThan(600 - 50);
    const b = ganz(r, MIT);
    expect(unterkante(b)).toBeLessThanOrEqual(600 - 50 - 24 + 1e-9);
    expect(b.y + r.y * b.s).toBeGreaterThanOrEqual(24 - 1e-9);
  });

  it('auch der Anfang: mittig in der Höhe ÜBER dem Streifen', () => {
    const gross = {
      rahmen: { x: -2000, y: -2000, breite: 4000, hoehe: 4000 },
      anker: { x: 0, y: 0, fx: 0.5, fy: 0.5 },
    };
    expect(anfang(gross, MIT).y).toBeCloseTo(0.5 * 550);
    expect(anfang(gross, F).y).toBeCloseTo(0.5 * 600);
  });
});
