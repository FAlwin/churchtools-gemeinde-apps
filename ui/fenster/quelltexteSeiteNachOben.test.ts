import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { ORDNER, WURZEL, dateien } from '../design/quelltexte.testutil';

/**
 * Kein schlichtes `window.scrollTo(0, 0)` mehr: In ChurchTools (`scroll-behavior: smooth` auf `html`) wird es zur
 * langsamen Animation – die Seite kroch nach dem Tippen ruckelnd zurück (18.11.2026). Immer `seiteNachOben()`.
 */
describe('Dokument-Scroll wird nur sofort zurückgeholt', () => {
  it('keine Datei ruft window.scrollTo(0, 0) direkt auf', () => {
    const funde = ORDNER.flatMap((o) => dateien(o, /\.tsx?$/))
      .filter((d) => !/\.test\.tsx?$/.test(d))
      .filter((d) => /window\.scrollTo\(\s*0\s*,\s*0\s*\)/.test(readFileSync(d, 'utf8')))
      .map((d) => relative(WURZEL, d));
    expect(funde).toEqual([]);
  });
});
