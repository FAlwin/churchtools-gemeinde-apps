import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Trennlinien bleiben gerade** (Alwin, 02.11.2026: „Warum sind die Linien rechts und links so abgerundet?“).
 *
 * Eine Haarlinie als `box-shadow: inset 0 1px 0 …` folgt den Ecken ihres Elements. Hat die Zeile eine Rundung (für die
 * Hervorhebung beim Antippen), biegt sich die Linie an beiden Enden nach unten – so im Lied-Menü seit #779. Eine
 * gerade Linie über die volle Breite ist ein eigenes Element (`::before`, siehe `SongMenu.module.scss`).
 *
 * Geprüft wird je Regel-Block samt der darin verschachtelten Regeln (`& + & { … }`): Rundung UND Linien-Schatten
 * zusammen fallen auf.
 */

/** Alle Regel-Blöcke einer SCSS-Datei: Kopf, ganzer Inhalt (mit Verschachteltem) und Zeile. */
function bloecke(quelltext: string): { kopf: string; inhalt: string; zeile: number }[] {
  const out: { kopf: string; inhalt: string; zeile: number }[] = [];
  const offen: number[] = [];
  for (let i = 0; i < quelltext.length; i++) {
    if (quelltext[i] === '{') offen.push(i);
    else if (quelltext[i] === '}' && offen.length) {
      const start = offen.pop()!;
      const kopfStart =
        Math.max(
          quelltext.lastIndexOf(';', start),
          quelltext.lastIndexOf('}', start),
          quelltext.lastIndexOf('{', start - 1),
        ) + 1;
      out.push({
        kopf: quelltext.slice(kopfStart, start).trim(),
        inhalt: quelltext.slice(start + 1, i),
        zeile: quelltext.slice(0, start).split('\n').length,
      });
    }
  }
  return out;
}

/** Hat der Block SELBST (nicht nur ein verschachtelter) eine Rundung? */
function eigeneRundung(inhalt: string): boolean {
  let tiefe = 0;
  let flach = '';
  for (const c of inhalt) {
    if (c === '{') tiefe++;
    else if (c === '}') tiefe--;
    else if (tiefe === 0) flach += c;
  }
  return /border(?:-[a-z]+)*-radius\s*:\s*(?!0\b)/.test(flach);
}

describe('Trennlinien bleiben gerade (02.11.2026)', () => {
  it('keine Zeile mit Rundung trägt ihre Trennlinie als Schatten', () => {
    const funde: string[] = [];
    for (const ordner of ORDNER) {
      for (const datei of dateien(ordner, /\.scss$/)) {
        const rel = relative(WURZEL, datei);
        for (const b of bloecke(readFileSync(datei, 'utf8'))) {
          if (eigeneRundung(b.inhalt) && /box-shadow\s*:\s*inset\s+0\s+1px\s+0/.test(b.inhalt)) {
            funde.push(`${rel}:${b.zeile} ${b.kopf}`);
          }
        }
      }
    }
    expect(funde).toEqual([]);
  });

  it('erkennt das Muster, auch verschachtelt (sonst wäre der Test oben billig grün)', () => {
    const quelle =
      '.zeile {\n  border-radius: var(--r-ctrl);\n  & + & {\n    box-shadow: inset 0 1px 0 var(--hair);\n  }\n}\n';
    const treffer = bloecke(quelle).filter(
      (b) => eigeneRundung(b.inhalt) && /box-shadow\s*:\s*inset\s+0\s+1px\s+0/.test(b.inhalt),
    );
    expect(treffer.map((b) => b.kopf)).toEqual(['.zeile']);
  });
});
