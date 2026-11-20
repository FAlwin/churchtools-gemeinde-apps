import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Bereichs-Reiter sind unterstrichen, nie ein Kasten-Umschalter** (R4/E4 „Ruhige Bedienung“, B2, 20.11.2026).
 * Bis dahin zeichneten Dienstplaner, Organigramm, Protokolle und Website ihre Reiter am Rechner als
 * `<Segment ariaLabel="Bereiche" verbunden>` und am Handy als `ReiterLeiste` – zwei Aussehen für dieselbe Sache.
 * Jetzt zeichnet `ErweiterungsSeite` (Prop `bereiche`) beide; der Kasten (`Segment`) ist nur für die Ansichtswahl da.
 */
export function segmentAlsBereiche(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/<Segment\b([\s\S]*?)\/>/g)) {
    if (/ariaLabel=(?:"Bereiche"|\{\s*['"`]Bereiche['"`]\s*\})/.test(m[1])) {
      out.push(text.slice(0, m.index).split('\n').length);
    }
  }
  return out;
}

describe('Reiter unterstrichen (R4)', () => {
  it('kein `Segment` heißt „Bereiche“ – das sind Reiter (`ErweiterungsSeite … bereiche`)', () => {
    const funde: string[] = [];
    for (const ordner of ORDNER) {
      for (const datei of dateien(ordner, /\.tsx$/)) {
        if (/\.test\.tsx$/.test(datei)) continue;
        for (const zeile of segmentAlsBereiche(readFileSync(datei, 'utf8'))) {
          funde.push(`${relative(WURZEL, datei)}:${zeile}`);
        }
      }
    }
    expect(funde).toEqual([]);
  });

  it('Gegenprobe: die Erkennung findet so einen Kasten, auch mit Zeilenumbrüchen', () => {
    const kasten = `<Segment\n  value={a}\n  ariaLabel="Bereiche"\n  verbunden\n/>`;
    expect(segmentAlsBereiche(kasten)).toEqual([1]);
    expect(segmentAlsBereiche(`<Segment ariaLabel={'Bereiche'} />`)).toEqual([1]);
    expect(segmentAlsBereiche(`<Segment ariaLabel="Ansicht" />`)).toEqual([]);
  });

  it('`ErweiterungsSeite` zeichnet die Reiter selbst, unterstrichen (`ReiterLeiste oben`)', () => {
    const text = readFileSync(`${WURZEL}ui/erweiterung/ErweiterungsSeite.tsx`, 'utf8');
    expect(text).toMatch(/<ReiterLeiste[\s\S]*?oben=\{!handy\}/);
  });
});
