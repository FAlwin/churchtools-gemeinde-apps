import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from '../design/quelltexte.testutil';

/**
 * **„Rechts“ bleibt rechts, auch ohne Mitte** (B4): „Dienste“ hat keinen Zeitraum, die Werkzeugzeile also nur `links` und
 * `rechts`. Im Raster `1fr auto 1fr` rutschte `rechts` sonst in die schmale mittlere Spalte und stand neben der Ansicht statt am
 * Rand. Der Quelltext legt `.rechts` deshalb ausdrücklich in Spalte 3 (Rechner) bzw. 2 (Tablet, zwei Spalten).
 */
const scss = readFileSync(join(WURZEL, 'ui/bedienung/Werkzeugzeile.module.scss'), 'utf8');

describe('Werkzeugzeile: Spalten ohne Mitte', () => {
  it('Rechner: rechts in Spalte 3', () => {
    expect(scss).toMatch(/\.zeile:not\(\.handy\) \.rechts \{\s*grid-column: 3;/);
  });

  it('Tablet (zwei Spalten): rechts in Spalte 2', () => {
    const tablet = scss.slice(scss.indexOf('@media (max-width: 1019px)'));
    expect(tablet).toMatch(/\.rechts \{\s*grid-column: 2;/);
  });
});
