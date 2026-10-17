// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { satzplaene } from './chordPdf';
import {
  a4NachRolle,
  stricheAufRolle,
  streifen,
  textAufRolle,
  type Abbildung,
} from './rollenAbbildung';
import { PAGE_H, PAGE_W } from './blattMasse';
import type { SetlistSong } from '@shared/types/index';

/**
 * Gemeinsame Anmerkungen (#614): Die Umrechnung wird gegen ECHTE Sätze geprüft (`satzplaene` aus dem Blatt),
 * nicht gegen ausgedachte Zahlen – stimmte der Satz nicht mehr zur Umrechnung, fiele es hier auf.
 */
function lied(chordpro: string): SetlistSong {
  return {
    id: 1,
    arrangementId: 1,
    arrangementName: 'Standard',
    arrangementCount: 1,
    title: 'T',
    author: '',
    originalKey: 'C',
    targetKey: 'C',
    bpm: null,
    timeSig: null,
    ccli: null,
    versions: [],
    documents: [],
    chordpro,
  };
}

/** Sechs Teile à neun Zeilen – passt nicht auf eine A4-Seite, ein Teil springt auf Seite 2. */
const SECHS = lied(
  Array.from(
    { length: 6 },
    (_, n) =>
      `{comment: Vers ${n + 1}}\n${Array.from({ length: 9 }, () => '[C]Zeile mit [G]Text').join('\n')}`,
  ).join('\n'),
);

function abb(opts: { cols?: 1 | 2 } = {}, song = SECHS): Abbildung {
  return satzplaene(song, opts);
}

/** Ist jede Stelle jeder A4-Seite in genau einem Streifen? (Raster von 1 mm) */
function luecken(a: Abbildung): string[] {
  const st = streifen(a);
  const fehler: string[] = [];
  for (let seite = 0; seite < a.a4.seiten; seite++)
    for (let y = 0.5; y < PAGE_H; y += 3)
      for (let x = 0.5; x < PAGE_W; x += 7) {
        const n = st.filter(
          (s) =>
            s.seite === seite &&
            x >= s.quelle.x &&
            x < s.quelle.x + s.quelle.w &&
            y >= s.quelle.y &&
            y < s.quelle.y + s.quelle.h,
        ).length;
        if (n !== 1) fehler.push(`S${seite} ${x}/${y}: ${n}×`);
      }
  return fehler;
}

describe('streifen – jede Stelle einer A4-Seite hat genau ein Ziel', () => {
  it('eine Spalte', () => {
    expect(luecken(abb())).toEqual([]);
  });

  it('zwei Spalten', () => {
    expect(luecken(abb({ cols: 2 }))).toEqual([]);
  });
});

describe('a4NachRolle – eine Spalte: exakt', () => {
  it('der Anfang jedes Teils landet am Anfang desselben Teils auf der Rolle', () => {
    const a = abb();
    const st = streifen(a);
    for (const s of a.a4.stuecke.filter((s) => s.imTeil === 0)) {
      const ziel = a4NachRolle(st, s.seite, 50, s.y0 + 1);
      const r = a.rolle.stuecke.find((r) => r.teil === s.teil)!;
      expect(ziel!.y).toBeCloseTo(r.y0 + 1, 5);
      expect(ziel!.x).toBe(50);
    }
  });

  it('auf Seite 2 rückt alles um die weggefallene Lücke nach oben', () => {
    const a = abb();
    const zweite = a.a4.stuecke.find((s) => s.seite === 1)!;
    const r = a.rolle.stuecke.find((x) => x.teil === zweite.teil)!;
    const ziel = a4NachRolle(streifen(a), 1, 30, zweite.y0 + 5)!;
    expect(ziel.y).toBeCloseTo(r.y0 + 5, 5);
    expect(ziel.y).toBeLessThan(PAGE_H + zweite.y0 + 5); // höher als einfach aneinandergehängt
  });

  it('der Titelkopf bleibt, wo er ist', () => {
    expect(a4NachRolle(streifen(abb()), 0, 40, 10)).toEqual({ x: 40, y: 10 });
  });
});

describe('a4NachRolle – Lücken: ans Ende des vorigen Stücks (Entscheidung Alwin)', () => {
  it('was in die Lücke am Seitenende gemalt ist, steht auf der Rolle direkt hinter dem letzten Teil der Seite', () => {
    const a = abb();
    const letzterAufS1 = a.a4.stuecke.filter((s) => s.seite === 0).at(-1)!;
    const r = a.rolle.stuecke.find((x) => x.teil === letzterAufS1.teil)!;
    const ziel = a4NachRolle(streifen(a), 0, 60, PAGE_H - 5)!;
    expect(ziel.y).toBeGreaterThanOrEqual(r.y1 - 0.001);
  });

  it('der obere Rand von Seite 2 gehört ebenfalls an dieses Ende', () => {
    const a = abb();
    const letzterAufS1 = a.a4.stuecke.filter((s) => s.seite === 0).at(-1)!;
    const r = a.rolle.stuecke.find((x) => x.teil === letzterAufS1.teil)!;
    expect(a4NachRolle(streifen(a), 1, 60, 2)!.y).toBeCloseTo(r.y1 + 2, 5);
  });
});

describe('a4NachRolle – zwei Spalten: übertragen, an den linken Rand gerückt', () => {
  it('die rechte Spalte rückt nach links', () => {
    const a = abb({ cols: 2 });
    const rechts = a.a4.stuecke.find((s) => s.spalte === 1)!;
    const ziel = a4NachRolle(streifen(a), rechts.seite, rechts.x + 3, rechts.y0 + 1)!;
    expect(ziel.x).toBeCloseTo(12 + 3, 5);
  });
});

describe('textAufRolle – Textfelder', () => {
  it('rückt mit und behält seine Größe in Millimetern (cqh bezieht sich auf die Seitenhöhe)', () => {
    const a = abb();
    const st = streifen(a);
    const zweite = a.a4.stuecke.find((s) => s.seite === 1)!;
    const t = {
      id: 1,
      fx: 0.5,
      fy: (zweite.y0 + 4) / PAGE_H,
      sizeCqh: 2,
      text: 'x',
      color: '#000',
    };
    const rolleH = a.rolle.hoehe;
    const z = textAufRolle(t, st, 1, rolleH)!;
    const r = a.rolle.stuecke.find((s) => s.teil === zweite.teil)!;
    expect(z.fy * rolleH).toBeCloseTo(r.y0 + 4, 5);
    expect(z.fx).toBe(0.5);
    expect((z.sizeCqh * rolleH) / 100).toBeCloseTo((2 * PAGE_H) / 100, 5); // gleiche mm
    expect(z.text).toBe('x');
  });
});

describe('stricheAufRolle – gemalte Striche Streifen für Streifen', () => {
  it('zeichnet nur die Streifen DIESER Seite, mit dem Maßstab von Bild und Rolle', () => {
    const a = abb();
    const st = streifen(a);
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;
    const bild = { width: 420 } as unknown as HTMLCanvasElement; // 2 px je mm
    stricheAufRolle(ctx, bild, st, 1, 1050); // Rolle: 5 px je mm
    const meine = st.filter((s) => s.seite === 1 && s.quelle.h > 0);
    expect(drawImage).toHaveBeenCalledTimes(meine.length);
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = drawImage.mock.calls[0] as number[];
    const s0 = meine[0];
    expect([sx, sy, sw, sh]).toEqual([
      s0.quelle.x * 2,
      s0.quelle.y * 2,
      s0.quelle.w * 2,
      s0.quelle.h * 2,
    ]);
    expect([dx, dy, dw, dh]).toEqual([
      s0.ziel.x * 5,
      s0.ziel.y * 5,
      s0.quelle.w * 5,
      s0.quelle.h * 5,
    ]);
  });
});
