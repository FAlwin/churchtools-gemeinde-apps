import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Fenster liegen immer ganz oben** (Alwin am iPhone, 20.11.2026: das schwebende Plus lag über dem offenen Fenster).
 * Zwei Hälften, zwei Wächter – jede für sich gegengeprobt:
 *
 * 1. Die Ebenen sind Zahlen in `_variables.scss`, geordnet: Vollbild < Fenster < Bestätigung < Hinweis < Einführung (3000),
 *    und `Sheet`/`ConfirmDialog`/`Toast` nehmen sie – keine eigene Zahl.
 * 2. Ein Fenster mit `position: fixed` über der ganzen Seite zeichnet sich nur über `FensterEbene` (unter `#root`):
 *    Dort, wo es aufgerufen wird, sperrt jeder Stapel darüber (`z-index`, `transform` …) es ein.
 */
const lies = (p: string) => readFileSync(join(WURZEL, p), 'utf8');
const ebene = (name: string) => {
  const m = new RegExp(`--ebene-${name}:\\s*(\\d+)`).exec(lies('ui/design/_variables.scss'));
  return Number(m?.[1]);
};

describe('Fenster-Ebenen (_variables.scss)', () => {
  it('Vollbild < Fenster < Bestätigung < Hinweis < Einführung', () => {
    expect(ebene('vollflaeche')).toBeLessThan(ebene('fenster'));
    expect(ebene('fenster')).toBeLessThan(ebene('bestaetigung'));
    expect(ebene('bestaetigung')).toBeLessThan(ebene('hinweis'));
    expect(ebene('hinweis')).toBeLessThan(3000);
  });

  it.each([
    ['ui/fenster/Sheet.module.scss', 'fenster'],
    ['ui/fenster/ConfirmDialog.module.scss', 'bestaetigung'],
    ['ui/fenster/Toast.module.scss', 'hinweis'],
  ])('%s nimmt var(--ebene-%s) statt einer Zahl', (datei, name) => {
    expect(lies(datei)).toMatch(new RegExp(`z-index:\\s*var\\(--ebene-${name}\\)`));
  });
});

describe('Fenster zeichnen sich in der Fenster-Ebene', () => {
  it('Sheet und ConfirmDialog liefern ihren Schleier nur über FensterEbene', () => {
    for (const datei of ['ui/fenster/Sheet.tsx', 'ui/fenster/ConfirmDialog.tsx']) {
      const q = lies(datei);
      const schleier = (
        q.match(/className=\{styles\.overlay|className=\{`\$\{styles\.overlay/g) ?? []
      ).length;
      const ebenen = (q.match(/<FensterEbene>/g) ?? []).length;
      expect(ebenen, datei).toBe(schleier);
      expect(ebenen, datei).toBeGreaterThan(0);
    }
  });

  it('kein anderer Baustein baut sich einen eigenen Schleier über die ganze Seite (ein Fenster ist ein Sheet)', () => {
    // Ein eigenes `position: fixed; inset: 0` mit `--scrim` wäre ein zweites Fenster-Gerüst – ohne die Fenster-Ebene.
    const treffer = ORDNER.flatMap((o) => dateien(o, /\.module\.scss$/))
      .map((p) => relative(WURZEL, p))
      .filter(
        (p) =>
          !['ui/fenster/Sheet.module.scss', 'ui/fenster/ConfirmDialog.module.scss'].includes(p),
      )
      .filter((p) => /position:\s*fixed[^}]*inset:\s*0[^}]*var\(--scrim\)/s.test(lies(p)));
    expect(treffer).toEqual([]);
  });
});
