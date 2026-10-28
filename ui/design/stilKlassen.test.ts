import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Keine Stilklasse ohne Stil.** Ein `styles.x`, das es in der eingebundenen `*.module.scss` nicht (mehr) gibt, ist
 * still `undefined` – der Knopf steht dann ungestaltet da, Build und Tests bleiben grün. Gefunden in der Test-Instanz
 * (29.10.2026): „Neuer Bereich“ im Reiter „Neue Gliederung“ zeigte auf `praesentieren`, eine Klasse, die mit O7b-3
 * („Präsentieren“ in den Seitenkopf) gestrichen worden war. Geprüft werden feste Namen (`styles.x`, `styles['x']`);
 * berechnete (`styles[art]`) sieht diese Prüfung nicht.
 */
function fehlende(): string[] {
  const funde: string[] = [];
  for (const ordner of ORDNER) {
    for (const datei of dateien(ordner, /\.tsx?$/)) {
      if (/\.test\.tsx?$/.test(datei)) continue;
      const text = readFileSync(datei, 'utf8');
      for (const m of text.matchAll(/import (\w+) from '(\.{1,2}\/[^']+\.module\.scss)'/g)) {
        const [, name, pfad] = m;
        const scss = join(dirname(datei), pfad);
        if (!existsSync(scss)) continue;
        const css = readFileSync(scss, 'utf8');
        const klassen = new Set([
          ...[...text.matchAll(new RegExp(`\\b${name}\\.(\\w+)`, 'g'))].map((k) => k[1]),
          ...[...text.matchAll(new RegExp(`\\b${name}\\[\\s*'(\\w+)'\\s*\\]`, 'g'))].map(
            (k) => k[1],
          ),
        ]);
        for (const k of klassen) {
          if (!new RegExp(`\\.${k}\\b`).test(css))
            funde.push(`${relative(WURZEL, datei)}: ${name}.${k}`);
        }
      }
    }
  }
  return funde;
}

describe('Stilklassen', () => {
  it('jede benutzte Klasse steht in ihrer *.module.scss', () => {
    expect(fehlende()).toEqual([]);
  });
});
