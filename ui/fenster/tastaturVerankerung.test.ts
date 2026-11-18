import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from '../design/quelltexte.testutil';

/**
 * Das Kennzeichen allein bewirkt nichts – erst das Stylesheet verankert das Fenster oben. jsdom rechnet kein SCSS,
 * also wacht der Quelltext (wie `obenBand.test.ts`): Fällt die Regel weg, steht das Fenster wieder zentriert und
 * wandert bei jedem Tastatur-Schritt mit der Oberkante.
 */
describe('Sheet.module.scss – Fenster oben verankert, solange die Tastatur offen ist', () => {
  const scss = readFileSync(join(WURZEL, 'ui/fenster/Sheet.module.scss'), 'utf8');
  const regel = /\.overlay\[data-tastatur\]\s*\{([^}]*)\{[^}]*\}[^}]*\}/.exec(scss);

  it('hat eine Regel für .overlay[data-tastatur]', () => {
    expect(regel).not.toBeNull();
  });

  it('richtet oben aus, spart unten die Tastatur aus und gibt dem Fenster die volle Höhe', () => {
    const kopf = regel?.[0] ?? '';
    expect(kopf).toContain('align-items: flex-start');
    expect(kopf).toContain('var(--kb, 0px)');
    expect(kopf).toMatch(/\.sheet\s*\{\s*max-height: 100%/);
  });

  it('das Vollbild-Fenster (handyVoll) behält sein padding: 0', () => {
    expect(scss).toMatch(/\.overlayVoll\[data-tastatur\]\s*\{\s*padding: 0;/);
  });
});
