// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { satzplaene } from './chordPdf';
import {
  a4NachRolle,
  kerneAufSeite,
  rolleNachA4,
  rahmenAufKernen,
  textAufSeite,
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
    expect(a4NachRolle(streifen(abb()), 0, 40, 10)).toMatchObject({ x: 40, y: 10 });
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

describe('rolleNachA4 – zurück auf die A4-Seite (#608)', () => {
  it('hin und zurück landet jeder Punkt eines Teils wieder an seiner Stelle – auch auf Seite 2', () => {
    const a = abb();
    const st = streifen(a);
    for (const s of a.a4.stuecke) {
      for (const y of [s.y0 + 0.5, (s.y0 + s.y1) / 2, s.y1 - 0.5]) {
        const r = a4NachRolle(st, s.seite, 70, y)!;
        expect(r.art).toBe('kern');
        const zurueck = rolleNachA4(st, r.x, r.y)!;
        expect(zurueck.seite).toBe(s.seite);
        expect(zurueck.x).toBeCloseTo(70, 5);
        expect(zurueck.y).toBeCloseTo(y, 5);
      }
    }
  });

  it('der Abstand zwischen zwei Teilen einer Spalte ist ein Kern – hin und zurück genau', () => {
    const a = abb();
    const st = streifen(a);
    const [s1, s2] = a.a4.stuecke.filter((s) => s.seite === 0);
    const mitte = (s1.y1 + s2.y0) / 2;
    const r = a4NachRolle(st, 0, 50, mitte)!;
    expect(r.art).toBe('kern');
    expect(rolleNachA4(st, r.x, r.y)).toMatchObject({ seite: 0, y: expect.closeTo(mitte, 5) });
  });

  it('unter dem letzten Teil der Rolle (CCLI-Bereich): zum letzten Teil, nicht ins Leere', () => {
    const a = abb();
    const st = streifen(a);
    const z = rolleNachA4(st, 50, a.rolle.hoehe - 1)!;
    const letzte = a.a4.stuecke.at(-1)!;
    expect(z.seite).toBe(letzte.seite);
  });
});

describe('textAufSeite – Textfelder zurück (#608)', () => {
  it('Lage und Größe kommen dort an, wo sie herkamen', () => {
    const a = abb();
    const st = streifen(a);
    const zweite = a.a4.stuecke.find((s) => s.seite === 1)!;
    const t = {
      id: 1,
      fx: 0.3,
      fy: (zweite.y0 + 3) / PAGE_H,
      sizeCqh: 2,
      text: 'x',
      color: '#000',
    };
    const aufRolle = textAufRolle(t, st, 1, a.rolle.hoehe)!;
    const zurueck = textAufSeite(aufRolle, st, a.rolle.hoehe)!;
    expect(zurueck.seite).toBe(1);
    expect(zurueck.text.fx).toBeCloseTo(0.3, 6);
    expect(zurueck.text.fy).toBeCloseTo(t.fy, 6);
    expect(zurueck.text.sizeCqh).toBeCloseTo(2, 6);
  });
});

describe('kerneAufSeite / stricheAufRolle(nur) – Striche zurückschreiben (#608)', () => {
  it('jeder Kern der Seite wird geleert und aus der Rolle gefüllt – Lücken nicht', () => {
    const a = abb();
    const st = streifen(a);
    const clearRect = vi.fn();
    const drawImage = vi.fn();
    const ctx = { clearRect, drawImage } as unknown as CanvasRenderingContext2D;
    const rolle = { width: 1050 } as unknown as HTMLCanvasElement; // 5 px je mm
    kerneAufSeite(ctx, rolle, st, 1, 420); // A4-Seite: 2 px je mm
    const kerne = st.filter((s) => s.seite === 1 && s.art === 'kern' && s.quelle.h > 0);
    expect(drawImage).toHaveBeenCalledTimes(kerne.length);
    expect(clearRect).toHaveBeenCalledTimes(kerne.length);
    const [, sx, sy, , , dx, dy] = drawImage.mock.calls[0] as number[];
    expect([sx, sy]).toEqual([kerne[0].ziel.x * 5, kerne[0].ziel.y * 5]);
    expect([dx, dy]).toEqual([kerne[0].quelle.x * 2, kerne[0].quelle.y * 2]);
  });

  it('stricheAufRolle(…, "luecke") zeichnet nur die Lücken', () => {
    const a = abb();
    const st = streifen(a);
    const drawImage = vi.fn();
    stricheAufRolle(
      { drawImage } as unknown as CanvasRenderingContext2D,
      { width: 420 } as unknown as HTMLCanvasElement,
      st,
      0,
      1050,
      'luecke',
    );
    expect(drawImage).toHaveBeenCalledTimes(
      st.filter((s) => s.seite === 0 && s.art === 'luecke' && s.quelle.h > 0).length,
    );
  });
});

describe('rahmenAufKernen – wo das Lasso auf der Rolle ablegen darf (#615)', () => {
  it('mitten im Lied ja, unter dem letzten Teil nein – dort gäbe es keine A4-Stelle zum Speichern', () => {
    const a = abb();
    const st = streifen(a);
    const letzter = a.rolle.stuecke[a.rolle.stuecke.length - 1];
    expect(rahmenAufKernen(st, { x: 20, y: letzter.y0 + 2, w: 60, h: 10 })).toBe(true);
    // Reicht nur 1 mm unter das Ende des letzten Teils: schon nicht mehr.
    expect(rahmenAufKernen(st, { x: 20, y: letzter.y1 - 9, w: 60, h: 10 })).toBe(false);
    expect(rahmenAufKernen(st, { x: 20, y: a.rolle.hoehe - 5, w: 60, h: 4 })).toBe(false);
  });

  it('zwei Spalten: rechts neben dem schmalen Streifen nein', () => {
    const st = streifen(abb({ cols: 2 }));
    const kern = st.find((s) => s.art === 'kern' && s.seite === 0 && s.quelle.y > 40)!;
    const y = kern.ziel.y + 1;
    expect(rahmenAufKernen(st, { x: kern.ziel.x + 1, y, w: kern.quelle.w - 2, h: 1 })).toBe(true);
    expect(rahmenAufKernen(st, { x: kern.ziel.x + kern.quelle.w + 5, y, w: 20, h: 1 })).toBe(false);
  });
});
