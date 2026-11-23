import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * **Der Fehlklick-Hinweis verschiebt die Knopfzeile nicht** (L4-3, Nachbesserung): Er liegt als Überlagerung direkt über der
 * Leiste mit Zurück/Weiter (innerhalb des Fußes), nicht im Fluss – sonst sprängen die Knöpfe gerade im Moment des Fehlklicks
 * um die Höhe des Hinweises. Kein `position: fixed` (Bedienregeln). Ein Quelltext-Test: jsdom rechnet kein Layout.
 */
const scss = readFileSync(
  fileURLToPath(new URL('../../dienstplaner/src/LiveAnsicht.module.scss', import.meta.url)),
  'utf8',
);

describe('Fehlklick-Hinweis (Layout)', () => {
  it('liegt über der Knopfzeile statt in ihr – ohne position: fixed', () => {
    const regel = /\.fehlklick\s*\{([^}]*)\}/.exec(scss)?.[1] ?? '';
    expect(regel).toMatch(/position:\s*absolute/);
    expect(regel).toMatch(/bottom:\s*100%/);
    expect(regel).not.toMatch(/fixed/);
    expect(regel).not.toMatch(/grid-column/);
  });

  it('der Fuß ist der Bezug der Überlagerung', () => {
    expect(/\.fuss\s*\{[^}]*position:\s*relative/.test(scss)).toBe(true);
  });
});
