import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Über der Leiste von ChurchTools liegt nur, wer `--ebene-vollflaeche` nimmt** (Test-Instanz, 30.10.2026).
 *
 * Die Leiste von ChurchTools steht auf z-index 1040. „Ablauf zeigen“ hatte 1000 und lag damit darunter – die Leiste
 * schnitt die Uhr ab; in der Demo ohne Leiste fiel es nicht auf. Präsentation und App-Vollbild hatten je eine eigene
 * 2500. Jetzt gilt: Eine Ebene ab 1000 schreibt niemand als Zahl, sondern `var(--ebene-vollflaeche)`
 * (`_variables.scss`). Ausgenommen: die Einführung (`Coachmarks`, bewusst darüber) und das öffentliche
 * Anmeldeformular (läuft auf der Webseite der Gemeinde, nie unter der Leiste von ChurchTools).
 */
const ERLAUBT = ['client/src/components/Coachmarks.module.scss', 'ui/anmeldeformular/'];

const hoheEbenen = (text: string) =>
  [...text.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1])).filter((z) => z >= 1000);

describe('Ebene über ChurchTools', () => {
  it('keine Ebene ab 1000 als Zahl – alles über --ebene-vollflaeche', () => {
    const treffer = ORDNER.flatMap((o) => dateien(o, /\.(scss|css)$/))
      .map((p) => relative(WURZEL, p))
      .filter((p) => !ERLAUBT.some((e) => p.startsWith(e)))
      .filter((p) => hoheEbenen(readFileSync(join(WURZEL, p), 'utf8')).length > 0);
    expect(treffer).toEqual([]);
  });

  it('der Wert liegt über der Leiste (1040) und unter der Einführung (3000)', () => {
    const wert = /--ebene-vollflaeche:\s*(\d+)/.exec(
      readFileSync(join(WURZEL, 'ui/design/_variables.scss'), 'utf8'),
    );
    expect(Number(wert?.[1])).toBeGreaterThan(1040);
    expect(Number(wert?.[1])).toBeLessThan(3000);
  });

  it('die Prüfung findet etwas (Gegenprobe: die Einführung steht als Zahl darüber)', () => {
    expect(
      hoheEbenen(
        readFileSync(join(WURZEL, 'client/src/components/Coachmarks.module.scss'), 'utf8'),
      ),
    ).toEqual([3000]);
  });
});
