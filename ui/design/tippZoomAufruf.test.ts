import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Jede App schaltet den Zoom beim Antippen am iPhone ab** (`ui/fenster/tippZoom.ts`, K3a 04.11.2026) – eine Regel für
 * A, B, C heißt: alle. Eine App, die später dazukommt, fällt hier auf, statt am iPhone wieder hineinzuzoomen.
 */
describe('zoomBeimTippenAus in jeder App', () => {
  it('jede App mit eigenem Start (`src/main.tsx`) ruft es auf', () => {
    const mains = ORDNER.map((o) => join(WURZEL, o, 'main.tsx')).filter((p) => existsSync(p));
    expect(mains.length).toBeGreaterThanOrEqual(6);
    const ohne = mains.filter((p) => !/^zoomBeimTippenAus\(\);$/m.test(readFileSync(p, 'utf8')));
    expect(ohne).toEqual([]);
  });
});
