import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * **Jedes Polster für den Home-Strich braucht sein schmales Gegenstück in der Erweiterung.**
 *
 * Am 13.10.2026 wurde das Reiter-Polster in den ChurchTools-Erweiterungen schmal gemacht (dort läuft die App im
 * Browser, das Polster für den Home-Strich wäre „verschenkter Platz“, Alwin). Die Fußleiste des Liedblatts hatte
 * dieselbe Regel – sie wurde nicht mitgezogen und kostete 36 px Blatt, gefunden erst mit der Messung B0
 * (28.10.2026). Dieser Test hält fest: Jedes `--…-polster` in `:root` hat ein Gegenstück im `.ct-extension`-Block.
 */
const QUELLE = readFileSync(fileURLToPath(new URL('./_variables.scss', import.meta.url)), 'utf8');

/** Die `--…-polster`-Namen, die in ALLEN Blöcken mit diesem Kopf gesetzt werden (`:root` steht mehrmals da). */
function polsterIn(quelle: string, kopf: RegExp): string[] {
  const namen: string[] = [];
  for (const treffer of quelle.matchAll(new RegExp(kopf.source, 'gm'))) {
    const start = treffer.index;
    const ende = quelle.indexOf('\n}', start);
    const block = quelle.slice(start, ende < 0 ? undefined : ende);
    namen.push(...[...block.matchAll(/^\s*(--[a-z-]+-polster)\s*:/gm)].map((m) => m[1]));
  }
  return namen;
}

describe('Polster für den Home-Strich (Messung B0)', () => {
  const imRoot = polsterIn(QUELLE, /^:root \{/m);
  const inErweiterung = polsterIn(QUELLE, /^\.ct-extension,\n\.ct-extension \* \{/m);

  it('es gibt Polster – sonst prüfte der Test nichts', () => {
    expect(imRoot).toContain('--reiter-polster');
    expect(imRoot).toContain('--blatt-fuss-polster');
  });

  it('jedes Polster ist in der Erweiterung schmal gesetzt', () => {
    expect(imRoot.filter((p) => !inErweiterung.includes(p))).toEqual([]);
  });

  it('die Fußleiste des Liedblatts nutzt ihr Polster – keine eigene Formel daneben', () => {
    const blatt = readFileSync(
      fileURLToPath(new URL('../../client/src/pages/ChordChart.module.scss', import.meta.url)),
      'utf8',
    );
    const ftr = blatt.slice(blatt.indexOf('.ftr {'), blatt.indexOf('\n}', blatt.indexOf('.ftr {')));
    expect(ftr).toContain('padding-bottom: var(--blatt-fuss-polster)');
    expect(ftr).not.toContain('safe-area-inset-bottom');
  });

  it('die Erkennung greift (Gegenprobe gegen einen Block ohne Gegenstück)', () => {
    const quelle =
      ':root {\n  --a-polster: 1px;\n  --b-polster: 2px;\n}\n.ct-extension,\n.ct-extension * {\n  --a-polster: 0;\n}\n';
    expect(polsterIn(quelle, /^:root \{/m)).toEqual(['--a-polster', '--b-polster']);
    expect(polsterIn(quelle, /^\.ct-extension,\n\.ct-extension \* \{/m)).toEqual(['--a-polster']);
  });
});
