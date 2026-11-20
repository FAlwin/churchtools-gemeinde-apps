import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SCHRIFT_LADER } from '../../website/src/schriftLader';
import { SCHRIFTEN } from './schriften';

/**
 * **Wächter: Schriftliste und Schriftdateien gehören zusammen** (Bauplan Website W3a-3, E-W15). Die Dateien in
 * `shared/website/schriften/` sind die EINE Quelle – für die Vorschau (`website/src/schriftLader.ts`) und später für den
 * Bau-Dienst (W5). Dieser Test hält fest, dass nichts auseinanderläuft:
 *  - jede Schrift der Liste hat ihre Datei, und keine Datei steht ohne Eintrag da;
 *  - jede Datei ist wirklich WOFF2 (Kennung `wOF2`) und bleibt unter der Größengrenze;
 *  - jede Datei hat ihre Zeile in `QUELLEN.md` und ihren Lizenztext (der mitgeliefert werden muss);
 *  - die Lade-Tabelle der Vorschau deckt genau die Liste ab.
 */
const ORDNER = join(__dirname, 'schriften');
/** Eine Datei über dieser Größe wäre ein Versehen (etwa der volle Zeichensatz statt Latin) – sie landet in jedem Bündel. */
const MAX_BYTES = 120 * 1024;

const dateien = readdirSync(ORDNER)
  .filter((d) => d.endsWith('.woff2'))
  .sort();
const quellen = readFileSync(join(ORDNER, 'QUELLEN.md'), 'utf8');

/** `caveat-var.woff2` → `caveat`, `caveat-brush.woff2` → `caveat-brush`: so heißt das Paket, dessen Lizenz daneben liegt. */
const paketVon = (datei: string) => datei.replace(/(-var)?\.woff2$/, '');

describe('Schriftdateien (Wächter)', () => {
  it('jede Schrift der Liste hat ihre Datei – und `datei` ist ein einfacher Dateiname', () => {
    for (const s of SCHRIFTEN) {
      expect(s.datei, s.name).toMatch(/^[a-z0-9-]+\.woff2$/);
      expect(existsSync(join(ORDNER, s.datei)), `${s.name}: ${s.datei} fehlt`).toBe(true);
    }
  });

  it('keine .woff2 ohne Eintrag in der Liste', () => {
    expect(dateien).toEqual(SCHRIFTEN.map((s) => s.datei).sort());
  });

  it('die Liste hat keine Doppelten (Name, Familie, Datei)', () => {
    for (const feld of ['name', 'familie', 'datei'] as const)
      expect(new Set(SCHRIFTEN.map((s) => s[feld])).size, feld).toBe(SCHRIFTEN.length);
  });

  it.each(dateien)('%s ist eine WOFF2-Datei unter der Größengrenze', (datei) => {
    const inhalt = readFileSync(join(ORDNER, datei));
    expect(inhalt.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(statSync(join(ORDNER, datei)).size).toBeLessThanOrEqual(MAX_BYTES);
  });

  it.each(dateien)('%s hat eine Zeile in QUELLEN.md', (datei) => {
    expect(quellen).toMatch(new RegExp(`^\\| ${datei.replace('.', '\\.')}\\s+\\|`, 'm'));
  });

  it('QUELLEN.md führt nichts auf, was es nicht gibt', () => {
    const genannt = [...quellen.matchAll(/^\| ([a-z0-9-]+\.woff2)\s+\|/gm)].map((m) => m[1]).sort();
    expect(genannt).toEqual(dateien);
  });

  it.each(dateien)('%s hat ihren Lizenztext daneben – und der passt zur Angabe in QUELLEN.md', (datei) => {
    const lizenz = join(ORDNER, `${paketVon(datei)}.LICENSE.txt`);
    expect(existsSync(lizenz), `${paketVon(datei)}.LICENSE.txt fehlt`).toBe(true);
    const text = readFileSync(lizenz, 'utf8');
    const zeile = quellen.split('\n').find((z) => z.startsWith(`| ${datei} `)) ?? '';
    if (zeile.includes('Apache 2.0')) expect(text).toMatch(/Apache License/);
    else {
      expect(zeile).toContain('SIL OFL 1.1');
      expect(text).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/i);
    }
  });

  it('jeder Lizenztext gehört zu einer Schrift der Liste (keine übrig gebliebene Lizenz)', () => {
    const lizenzen = readdirSync(ORDNER)
      .filter((d) => d.endsWith('.LICENSE.txt'))
      .map((d) => d.replace('.LICENSE.txt', ''))
      .sort();
    expect(lizenzen).toEqual([...new Set(SCHRIFTEN.map((s) => paketVon(s.datei)))].sort());
  });
});

describe('Lade-Tabelle der Vorschau (website/src/schriftLader.ts)', () => {
  it('deckt genau die Liste ab – keine Schrift ohne Lader, kein Lader ohne Schrift', () => {
    expect(Object.keys(SCHRIFT_LADER).sort()).toEqual(SCHRIFTEN.map((s) => s.datei).sort());
  });
});
