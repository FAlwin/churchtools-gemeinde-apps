import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * **Was nur für unsere installierte App gilt, braucht in den Erweiterungen sein Gegenstück.**
 *
 * `@media (display-mode: standalone)` sollte unsere eigene App vom Home-Bildschirm treffen: Sie zeichnet hinter die
 * Statusleiste, die Köpfe beginnen unter dem Unschärfe-Band von iOS. Dieselbe Abfrage trifft aber auch die
 * ChurchTools-App vom Home-Bildschirm – mit fester Leiste oben und ohne Band. Dort standen die Köpfe aller
 * Erweiterungen 36px unter der Leiste im Leeren (Alwin, 28.10.2026). Dieser Test hält fest: Jede Variable, die ein
 * Standalone-Block setzt, ist im `.ct-extension`-Block zurückgesetzt.
 */
const QUELLE = readFileSync(fileURLToPath(new URL('./_variables.scss', import.meta.url)), 'utf8');

/** Der Rumpf des Blocks, dessen `{` an `start` oder danach kommt – mit verschachtelten Klammern. */
function rumpf(quelle: string, start: number): string {
  const auf = quelle.indexOf('{', start);
  let tiefe = 0;
  for (let i = auf; i < quelle.length; i++) {
    if (quelle[i] === '{') tiefe++;
    if (quelle[i] === '}' && --tiefe === 0) return quelle.slice(auf + 1, i);
  }
  return quelle.slice(auf + 1);
}

function variablenIn(block: string): string[] {
  return [...block.matchAll(/^\s*(--[a-z-]+)\s*:/gm)].map((m) => m[1]);
}

/** Alle Variablen, die irgendein `@media (display-mode: standalone …)`-Block setzt. */
function standaloneVariablen(quelle: string): string[] {
  const namen = new Set<string>();
  for (const treffer of quelle.matchAll(/@media \(display-mode: standalone\)/g)) {
    for (const name of variablenIn(rumpf(quelle, treffer.index))) namen.add(name);
  }
  return [...namen];
}

function erweiterungsVariablen(quelle: string): string[] {
  const start = quelle.search(/^\.ct-extension,\n\.ct-extension \* \{/m);
  return start < 0 ? [] : variablenIn(rumpf(quelle, start));
}

describe('Standalone-Regeln und die Erweiterungen', () => {
  it('es gibt Standalone-Regeln – sonst prüfte der Test nichts', () => {
    expect(standaloneVariablen(QUELLE)).toContain('--inhalt-pad-top');
  });

  it('jede Standalone-Variable ist in der Erweiterung zurückgesetzt', () => {
    const inErweiterung = erweiterungsVariablen(QUELLE);
    expect(standaloneVariablen(QUELLE).filter((v) => !inErweiterung.includes(v))).toEqual([]);
  });

  it('die Erkennung greift (Gegenprobe gegen einen Block ohne Gegenstück)', () => {
    const quelle =
      '.ct-extension,\n.ct-extension * {\n  --a: 0;\n}\n' +
      '@media (display-mode: standalone) {\n  @supports (x: y) {\n    :root {\n      --a: 1px;\n      --b: 2px;\n    }\n  }\n}\n';
    expect(standaloneVariablen(quelle)).toEqual(['--a', '--b']);
    expect(erweiterungsVariablen(quelle)).toEqual(['--a']);
  });
});
