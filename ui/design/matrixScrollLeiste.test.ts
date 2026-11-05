import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Die Scroll-Leisten der Matrix sind immer sichtbar** (E9-3, Alwin 05.11.2026, Entwurf `e9-zeitraum-scrollen.html`
 * Variante A): macOS blendet sie aus, bis man scrollt – ohne seitliches Mausrad sah man nie, dass die Matrix rechts
 * weitergeht. Mit eigener Gestalt (`::-webkit-scrollbar` mit Höhe) zeigen Chrome und Safari sie dauerhaft. Ob sie im
 * Browser wirklich Platz einnimmt, prüft die Abnahme; hier nur, dass die Regel am Rollbereich der Tabelle steht.
 */
const scss = readFileSync(join(WURZEL, 'dienstplaner/src/Planen.module.scss'), 'utf8');

/** Der Rumpf von `.rahmen { … }` auf oberster Ebene – bis zur schließenden Klammer derselben Tiefe. */
function rahmen(text: string): string {
  const start = text.search(/^\.rahmen\s*\{/m);
  if (start < 0) return '';
  let tiefe = 0;
  for (let i = text.indexOf('{', start); i < text.length; i++) {
    if (text[i] === '{') tiefe++;
    if (text[i] === '}' && --tiefe === 0) return text.slice(start, i + 1);
  }
  return '';
}

describe('Matrix: Scroll-Leisten immer sichtbar (E9-3)', () => {
  it('der Rollbereich `.rahmen` gibt der Leiste eine eigene Gestalt – waagerecht mit Höhe', () => {
    const r = rahmen(scss);
    expect(r).toMatch(/overflow:\s*auto/);
    expect(r).toMatch(/&::-webkit-scrollbar\s*\{[^}]*height:\s*\d+px/);
    expect(r).toMatch(/&::-webkit-scrollbar-thumb\s*\{[^}]*background:/);
  });

  it('die Prüfung selbst greift (Gegenprobe gegen die Erkennung)', () => {
    expect(
      rahmen('.rahmen {\n  overflow: auto;\n}\n.plan { &::-webkit-scrollbar { height: 9px; } }'),
    ).not.toMatch(/webkit-scrollbar/);
  });
});
