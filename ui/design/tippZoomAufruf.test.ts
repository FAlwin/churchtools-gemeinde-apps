import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Jede App schaltet den Zoom beim Antippen am iPhone ab** (`ui/fenster/tippZoom.ts`, K3a 04.11.2026) – eine Regel für
 * A, B, C heißt: alle. Eine App, die später dazukommt, fällt hier auf, statt am iPhone wieder hineinzuzoomen.
 *
 * Seit #845 starten alle Erweiterungen über `erweiterungStarten` (`ui/erweiterung/starten.tsx`) – dort steht der Aufruf
 * EINMAL. Eine Erweiterung, die ihren Start wieder selbst schreibt, fällt im zweiten Test auf.
 */
const lies = (p: string) => readFileSync(p, 'utf8');
const mains = ORDNER.map((o) => join(WURZEL, o, 'main.tsx')).filter((p) => existsSync(p));

describe('zoomBeimTippenAus in jeder App', () => {
  it('jede App mit eigenem Start ruft es auf – selbst oder über erweiterungStarten', () => {
    expect(mains.length).toBeGreaterThanOrEqual(6);
    expect(lies(join(WURZEL, 'ui/erweiterung/starten.tsx'))).toMatch(
      /^\s*zoomBeimTippenAus\(\);$/m,
    );
    const ohne = mains.filter(
      (p) => !/^zoomBeimTippenAus\(\);$|erweiterungStarten\(\{/m.test(lies(p)),
    );
    expect(ohne).toEqual([]);
  });

  it('jede Erweiterung (außer der Musik-App mit eigener PWA) startet über erweiterungStarten', () => {
    const erweiterungen = ORDNER.filter((o) => o.endsWith('/src'))
      .map((o) => o.slice(0, -'/src'.length))
      .filter((app) => app !== 'client')
      .filter((app) => {
        const konfig = join(WURZEL, app, 'vite.config.ts');
        return existsSync(konfig) && lies(konfig).includes('erweiterungsBau(');
      });
    // Findet die Suche die vier bekannten nicht, misst der Test nichts.
    expect(erweiterungen).toEqual(
      expect.arrayContaining(['anmeldungen', 'dienstplaner', 'organigramm', 'protokolle']),
    );
    const selbst = erweiterungen.filter(
      (app) => !/erweiterungStarten\(\{/.test(lies(join(WURZEL, app, 'src/main.tsx'))),
    );
    expect(selbst).toEqual([]);
  });
});
