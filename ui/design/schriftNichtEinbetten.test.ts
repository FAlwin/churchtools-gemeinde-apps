import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';
import { schriftNichtEinbetten } from './schrift';

/**
 * **Wer Lato mitbringt, bettet sie nicht ein** (05.11.2026). Vite machte aus den `lato-latin-ext-*.woff` (3,8 KB)
 * `data:`-Adressen, die die CSP der Musik-App blockierte – zwei Konsolenfehler bei jedem Start, in Musik-App UND
 * Formular. Die Regel steht einmal in `ui/design/schrift.ts`; dieser Test hält fest, dass jede App, die
 * `latoMitbringen` aufruft, sie auch in ihrer `vite.config.ts` benutzt.
 */
describe('Schriften nicht einbetten', () => {
  it('Schriftdateien nie, alles andere nach Vites Vorgabe', () => {
    for (const d of ['a/lato-latin-ext-400-normal.woff', 'b.woff2', 'c.TTF', 'd.otf', 'e.eot'])
      expect(schriftNichtEinbetten(d)).toBe(false);
    for (const d of ['logo.png', 'icon.svg', 'woff.png', 'x.woff.js'])
      expect(schriftNichtEinbetten(d)).toBeUndefined();
  });

  it('jede App mit latoMitbringen setzt assetsInlineLimit: schriftNichtEinbetten', () => {
    const apps = ORDNER.filter((o) => o.endsWith('/src'))
      .map((o) => o.slice(0, -'/src'.length))
      .filter((app) =>
        dateien(`${app}/src`, /\.tsx?$/).some((d) =>
          /latoMitbringen\(\)/.test(readFileSync(d, 'utf8')),
        ),
      );
    // Gegenprobe der Suche selbst: findet sie die beiden bekannten Apps nicht, misst der Test nichts.
    expect(apps).toEqual(expect.arrayContaining(['client', 'formular']));
    for (const app of apps) {
      const konfig = join(WURZEL, app, 'vite.config.ts');
      expect(existsSync(konfig), app).toBe(true);
      expect(readFileSync(konfig, 'utf8'), app).toMatch(
        /assetsInlineLimit:\s*schriftNichtEinbetten\b/,
      );
    }
  });
});
