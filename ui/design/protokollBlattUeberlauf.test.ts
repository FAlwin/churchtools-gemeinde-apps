import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Der Protokoll-Kasten schneidet nichts ab** (Alwin 21.11.2026, Live-Fund nach protokolle-v1.5.0): `.blatt` im Editor
 * nimmt `card-list`, und das setzt `overflow: hidden`. Stand ein To-Do ganz unten, wurde das Aufklapp-Feld „Wer kümmert
 * sich?“ (ebenso „Bis“ und das Termin-Datum) am unteren Rand des Kastens abgeschnitten – die meisten Namen waren nicht
 * erreichbar. Vitest liefert `.scss` leer aus, darum wird die Datei als Text gelesen.
 */
const scss = readFileSync(join(WURZEL, 'protokolle/src/ProtokollSchreiben.module.scss'), 'utf8');

/** Der Rumpf der ersten Regel `.blatt { … }` (ohne verschachtelte Regeln). */
function blattRegel(text: string): string {
  const start = text.indexOf('.blatt {');
  expect(start, '.blatt fehlt').toBeGreaterThanOrEqual(0);
  let tiefe = 0;
  for (let i = text.indexOf('{', start); i < text.length; i++) {
    if (text[i] === '{') tiefe++;
    if (text[i] === '}' && --tiefe === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

describe('Protokoll-Kasten im Editor', () => {
  it('nimmt card-list, hebt dessen overflow: hidden aber wieder auf (danach, damit es gewinnt)', () => {
    const regel = blattRegel(scss);
    const mixin = regel.indexOf('@include m.card-list');
    const sichtbar = regel.search(/\n\s*overflow:\s*visible;/);
    expect(mixin).toBeGreaterThanOrEqual(0);
    expect(sichtbar, 'overflow: visible fehlt in .blatt').toBeGreaterThan(mixin);
  });
});
