import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, compileString, type FileImporter } from 'sass';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **`@extend` darf die eigenen Angaben nicht verlieren** (Fund L1, live 12.11.2026): `.besuchHinweis` erweiterte
 * `.alteHinweis` und setzte selbst einen blauen Hintergrund – stand aber VOR `.alteHinweis`. Sass hängt den Selektor an
 * die Regel der erweiterten Klasse an, die steht danach, also gewann deren Rot. Tests, Build und Abnahme blieben grün;
 * gesehen hat es erst der Blick in Live. Geprüft wird das übersetzte CSS: Für jede Klasse, die `@extend` nutzt, muss
 * jede Angabe aus ihrer eigenen Regel auch die sein, die am Ende gilt.
 */

const ALIAS: Record<string, string> = { '@ui/': 'ui', '@shared/': 'shared' };
const importers: FileImporter<'sync'>[] = [
  {
    findFileUrl(url: string) {
      for (const [a, ordner] of Object.entries(ALIAS))
        if (url.startsWith(a)) return pathToFileURL(join(WURZEL, ordner, url.slice(a.length)));
      return null;
    },
  },
];

/** Klassen auf oberster Ebene, die `@extend` nutzen – nur einfache Klassen, so wie sie hier vorkommen. */
function erweiternde(scss: string): string[] {
  return [...scss.matchAll(/^(\.[\w-]+)\s*\{[^}]*?@extend\s+\.[\w-]+/gm)].map((m) => m[1]);
}

/** Angaben einer erweiternden Klasse, die im übersetzten CSS gegen eine spätere Regel verlieren. */
function verlorene(css: string, klasse: string): string[] {
  const regeln = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    sel: m[1].split(',').map((x) => x.trim()),
    angaben: m[2]
      .split(';')
      .map((d) => d.split(':'))
      .filter((d) => d.length > 1)
      .map(([k, ...v]) => [k.trim(), v.join(':').trim()] as const),
  }));
  const eigene = new Map<string, string>();
  const zuletzt = new Map<string, string>();
  for (const r of regeln) {
    if (!r.sel.includes(klasse)) continue;
    for (const [k, v] of r.angaben) {
      zuletzt.set(k, v);
      if (r.sel.length === 1) eigene.set(k, v);
    }
  }
  return [...eigene]
    .filter(([k, v]) => zuletzt.get(k) !== v)
    .map(([k, v]) => `${klasse} { ${k}: ${v} }`);
}

const MIT_EXTEND = ORDNER.flatMap((o) => dateien(o, /\.scss$/)).filter(
  (f) => erweiternde(readFileSync(f, 'utf8')).length > 0,
);

describe('@extend: die eigenen Angaben gewinnen (Fund L1)', () => {
  it('es gibt Dateien mit @extend – sonst prüfte der Test nichts', () => {
    expect(MIT_EXTEND.map((f) => relative(WURZEL, f))).toContain(
      'dienstplaner/src/Planen.module.scss',
    );
  });

  it.each(MIT_EXTEND.map((f) => [relative(WURZEL, f), f]))('%s', (_, f) => {
    const css = compile(f, { importers }).css;
    expect(erweiternde(readFileSync(f, 'utf8')).flatMap((k) => verlorene(css, k))).toEqual([]);
  });

  it('die Prüfung selbst greift: steht die erweiternde Klasse davor, verliert ihr Hintergrund', () => {
    const basis = '.alt { padding: 4px; background: red; }';
    const neu = '.neu { @extend .alt; background: blue; }';
    expect(verlorene(compileString(`${neu}\n${basis}`).css, '.neu')).toEqual([
      '.neu { background: blue }',
    ]);
    expect(verlorene(compileString(`${basis}\n${neu}`).css, '.neu')).toEqual([]);
  });
});
