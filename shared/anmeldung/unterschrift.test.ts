import { describe, expect, it } from 'vitest';
import {
  BREITE,
  HOEHE,
  MAX_ZEICHEN,
  glaetten,
  unterschriftLesen,
  unterschriftText,
  type Strich,
} from './unterschrift';

/** Eine nachgestellte Unterschrift wie im Entwurf: zwei Schleifen-Wörter und ein Unterstrich, gut 1.000 Punkte. */
function nachgestellt(): Strich[] {
  const strich = (f: (t: number) => [number, number], n: number): Strich =>
    Array.from({ length: n + 1 }, (_, i) => f(i / n));
  return [
    strich(
      (t) => [60 + t * 200, 170 - 60 * Math.sin(t * Math.PI * 6) - 20 * Math.sin(t * Math.PI * 23)],
      420,
    ),
    strich(
      (t) => [
        290 + t * 230,
        180 - 50 * Math.abs(Math.sin(t * Math.PI * 7)) + 14 * Math.cos(t * Math.PI * 31),
      ],
      480,
    ),
    strich((t) => [70 + t * 450, 235 + 8 * Math.sin(t * Math.PI * 3)], 200),
  ];
}

/** Abstand eines Punkts zur Strecke a–b. */
function zurStrecke(
  [x, y]: readonly [number, number],
  [ax, ay]: readonly [number, number],
  [bx, by]: readonly [number, number],
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** Größter Abstand eines Originalpunkts zur gelesenen Linie desselben Strichs (Formtreue). */
function abweichung(original: Strich[], gelesen: Strich[]): number {
  let max = 0;
  original.forEach((s, i) => {
    const g = gelesen[i];
    for (const p of s) {
      const r = [Math.round(p[0]), Math.round(p[1])] as const;
      let d = Infinity;
      for (let j = 1; j < g.length; j++) d = Math.min(d, zurStrecke(r, g[j - 1], g[j]));
      max = Math.max(max, d);
    }
  });
  return max;
}

describe('Unterschrift als Text (A6-2b)', () => {
  it('eine typische Unterschrift passt weit unter die 4.000 Zeichen von ChurchTools', () => {
    const t = unterschriftText(nachgestellt())!;
    expect(t.startsWith('u1;')).toBe(true);
    expect(t.length).toBeLessThan(600);
  });

  it('gelesen ergibt sie dieselben Striche (Endpunkte genau, Form höchstens ein paar Punkte daneben)', () => {
    const original = nachgestellt();
    const gelesen = unterschriftLesen(unterschriftText(original)!)!;
    expect(gelesen).toHaveLength(3);
    original.forEach((s, i) => {
      expect(gelesen[i][0]).toEqual([Math.round(s[0][0]), Math.round(s[0][1])]);
      expect(gelesen[i].at(-1)).toEqual([Math.round(s.at(-1)![0]), Math.round(s.at(-1)![1])]);
    });
    // Die Glättung lässt nur Punkte weg, die höchstens 1 von der Linie abweichen (dazu das Runden).
    expect(abweichung(original, gelesen)).toBeLessThanOrEqual(1.5);
  });

  it('ein einzelner Punkt und negative Schritte überstehen Kodieren und Lesen', () => {
    const striche: Strich[] = [
      [[300, 150]],
      [
        [500, 20],
        [10, 290],
        [599, 0],
      ],
    ];
    expect(unterschriftLesen(unterschriftText(striche)!)).toEqual(striche);
  });

  it('Punkte außerhalb der Fläche werden an den Rand gesetzt', () => {
    const t = unterschriftText([
      [
        [-20, 5],
        [BREITE + 50, HOEHE + 9],
      ],
    ])!;
    expect(unterschriftLesen(t)).toEqual([
      [
        [0, 5],
        [BREITE, HOEHE],
      ],
    ]);
  });

  it('sehr viele Striche: stärker geglättet, aber nie über der Grenze', () => {
    const wild: Strich[] = Array.from({ length: 60 }, (_, k) =>
      Array.from(
        { length: 300 },
        (_, i) => [(i * 2 + k * 7) % BREITE, (Math.sin(i * 0.9 + k) * 140 + 150) | 0] as const,
      ),
    );
    const t = unterschriftText(wild);
    expect(t).not.toBeNull();
    expect(t!.length).toBeLessThanOrEqual(MAX_ZEICHEN);
    expect(unterschriftLesen(t!)).toHaveLength(60);
  });

  it('ohne Striche: nichts', () => {
    expect(unterschriftText([])).toBeNull();
    expect(unterschriftText([[]])).toBeNull();
  });

  it('kein Unterschrift-Text → null (fremde oder kaputte Werte)', () => {
    expect(unterschriftLesen('✓ Erna Muster')).toBeNull();
    expect(unterschriftLesen('u1;Ab!')).toBeNull();
    expect(unterschriftLesen('u1;A')).toBeNull();
  });

  it('glätten behält Anfang und Ende und lässt Punkte auf der Linie weg', () => {
    expect(
      glaetten(
        [
          [0, 0],
          [5, 0],
          [10, 0],
          [20, 0],
        ],
        1,
      ),
    ).toEqual([
      [0, 0],
      [20, 0],
    ]);
    expect(
      glaetten(
        [
          [0, 0],
          [5, 9],
          [10, 0],
        ],
        1,
      ),
    ).toEqual([
      [0, 0],
      [5, 9],
      [10, 0],
    ]);
  });
});
