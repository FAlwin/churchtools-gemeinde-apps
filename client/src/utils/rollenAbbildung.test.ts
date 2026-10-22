// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { satzplaene } from './chordPdf';
import {
  a4NachRolle,
  kerneAufSeite,
  pedalHalte,
  rollenUnterkante,
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
    // 5 px je mm, so lang wie das gesetzte Lied
    const rolle = { width: 1050, height: a.rolle.hoehe * 5 } as unknown as HTMLCanvasElement;
    kerneAufSeite(ctx, rolle, st, 1, 420); // A4-Seite: 2 px je mm
    const kerne = st.filter((s) => s.seite === 1 && s.art === 'kern' && s.quelle.h > 0);
    expect(drawImage).toHaveBeenCalledTimes(kerne.length);
    expect(clearRect).toHaveBeenCalledTimes(kerne.length);
    const [, sx, sy, , , dx, dy] = drawImage.mock.calls[0] as number[];
    expect([sx, sy]).toEqual([kerne[0].ziel.x * 5, kerne[0].ziel.y * 5]);
    expect([dx, dy]).toEqual([kerne[0].quelle.x * 2, kerne[0].quelle.y * 2]);
  });

  it('unter dem letzten Teil nur, so weit die Rolle reicht – darunter bleibt die A4-Seite unberührt (#626)', () => {
    const a = abb();
    const st = streifen(a);
    const letzter = a.a4.stuecke[a.a4.stuecke.length - 1];
    const unten = st.find(
      (s) => s.art === 'kern' && s.seite === letzter.seite && s.quelle.y === letzter.y1,
    )!;
    expect(unten.quelle.y + unten.quelle.h).toBe(PAGE_H);
    const clearRect = vi.fn();
    const ctx = { clearRect, drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    // Die Rolle reicht 10 mm unter den letzten Teil.
    const rolle = { width: 210, height: unten.ziel.y + 10 } as unknown as HTMLCanvasElement;
    kerneAufSeite(ctx, rolle, st, letzter.seite, 210);
    const geleert = clearRect.mock.calls.find((c) => (c as number[])[1] === unten.quelle.y) as number[];
    expect(geleert[3]).toBeCloseTo(10, 6);
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
  it('mitten im Lied ja, unter dem letzten Teil auch (#626) – aber nicht tiefer, als A4 Platz hat', () => {
    const a = abb();
    const st = streifen(a);
    const letzter = a.rolle.stuecke[a.rolle.stuecke.length - 1];
    expect(rahmenAufKernen(st, { x: 20, y: letzter.y0 + 2, w: 60, h: 10 })).toBe(true);
    // Unter dem letzten Teil: Der Platz bis zum Ende der A4-Seite steht auf der Rolle genauso darunter.
    const platz = PAGE_H - a.a4.stuecke[a.a4.stuecke.length - 1].y1;
    expect(rahmenAufKernen(st, { x: 20, y: letzter.y1 - 9, w: 60, h: 10 })).toBe(true);
    expect(rahmenAufKernen(st, { x: 20, y: letzter.y1 + platz - 11, w: 60, h: 10 })).toBe(true);
    // Reicht 1 mm über das Ende dieses Platzes hinaus: nicht mehr.
    expect(rahmenAufKernen(st, { x: 20, y: letzter.y1 + platz - 9, w: 60, h: 10 })).toBe(false);
  });

  it('zwei Spalten: rechts neben dem schmalen Streifen nein', () => {
    const st = streifen(abb({ cols: 2 }));
    const kern = st.find((s) => s.art === 'kern' && s.seite === 0 && s.quelle.y > 40)!;
    const y = kern.ziel.y + 1;
    expect(rahmenAufKernen(st, { x: kern.ziel.x + 1, y, w: kern.quelle.w - 2, h: 1 })).toBe(true);
    expect(rahmenAufKernen(st, { x: kern.ziel.x + kern.quelle.w + 5, y, w: 20, h: 1 })).toBe(false);
  });
});

describe('pedalHalte – wo das Pedal auf der Rolle anhält (#609)', () => {
  // Drei Teile, im zweiten ein Weiterschalt-Punkt nach der zweiten Zeile.
  const MIT_TRENNER = lied(
    [
      '{comment: Vers 1}',
      '[C]Eins',
      '[C]Zwei',
      '{comment: Chorus}',
      '[G]Drei',
      '[G]Vier',
      '----',
      '[G]Fünf',
      '{comment: Vers 2}',
      '[C]Sechs',
    ].join('\n'),
  );

  it('Titel, jeder Teil-Anfang und der ---- – in dieser Reihenfolge', () => {
    const a = abb({}, MIT_TRENNER);
    const halte = pedalHalte(a);
    const teilAnfaenge = a.rolle.stuecke.filter((s) => s.imTeil === 0).map((s) => s.y0);
    expect(teilAnfaenge).toHaveLength(3);
    expect(a.rolle.weiterschalten).toHaveLength(1);
    expect(halte).toEqual([
      0,
      teilAnfaenge[0],
      teilAnfaenge[1],
      a.rolle.weiterschalten[0].y,
      teilAnfaenge[2],
    ]);
  });

  it('der ---- liegt im Chorus, zwei Zeilen unter seinem Anfang', () => {
    const a = abb({}, MIT_TRENNER);
    const chorus = a.rolle.stuecke.find((s) => s.teil === 1)!;
    const w = a.rolle.weiterschalten[0].y;
    expect(w).toBeGreaterThan(chorus.y0);
    expect(w).toBeLessThan(chorus.y1);
    // Überschrift + zwei Zeilen von drei liegen darüber – also mehr als die Hälfte des Chorus.
    expect(w - chorus.y0).toBeGreaterThan((chorus.y1 - chorus.y0) / 2);
  });

  it('kehrt ein Teil im Flow wieder, hält es bei jedem Vorkommen – samt seinem ----', () => {
    const a = abb({}, lied(`{flow: Vers 1, Chorus, Vers 1, Chorus}\n${MIT_TRENNER.chordpro}`));
    expect(a.rolle.weiterschalten).toHaveLength(2);
    expect(pedalHalte(a)).toHaveLength(1 + 4 + 2);
  });

  it('ohne ---- nur Titel und Teil-Anfänge', () => {
    const a = abb();
    expect(a.rolle.weiterschalten).toEqual([]);
    expect(pedalHalte(a)).toHaveLength(1 + 6);
  });
});

describe('rollenUnterkante – wie weit die Rolle für Anmerkungen unter dem Lied wächst (#626)', () => {
  const a = abb();
  const st = streifen(a);
  const letzter = a.a4.stuecke[a.a4.stuecke.length - 1];
  const rollenEnde = a.rolle.stuecke[a.rolle.stuecke.length - 1].y1;

  it('ein Strich unten auf der letzten Seite: so weit unter dem letzten Teil wie auf A4', () => {
    // Striche bis 280 mm, aber nur im Bereich unter dem letzten Teil.
    const bis = (q: { y: number; h: number }) => (q.y <= 280 && q.y + q.h >= 280 ? 280 : null);
    expect(rollenUnterkante(st, letzter.seite, 0, bis, [])).toBeCloseTo(
      rollenEnde + (280 - letzter.y1),
      6,
    );
  });

  it('ein Text unten auf der letzten Seite: seine Unterkante zählt', () => {
    const t = { fx: 0.5, fy: 270 / PAGE_H, sizeCqh: 2, text: 'eins\nzwei' };
    const groesse = 0.02 * PAGE_H;
    expect(rollenUnterkante(st, letzter.seite, 0, () => null, [t])).toBeCloseTo(
      rollenEnde + (270 - letzter.y1) + (groesse * (2 * 1.15 + 0.4)) / 2,
      6,
    );
  });

  it('nichts unter dem Lied: 0 – und gefragt wird nur nach Bereichen unter `ab`', () => {
    const gefragt: number[] = [];
    const bis = (q: { y: number }) => {
      gefragt.push(q.y);
      return null;
    };
    expect(rollenUnterkante(st, letzter.seite, rollenEnde, bis, [])).toBe(0);
    // Nur der Platz unter dem letzten Teil reicht unter das Liedende.
    expect(gefragt).toEqual([letzter.y1]);
  });
});
