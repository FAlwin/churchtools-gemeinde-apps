import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from '../design/quelltexte.testutil';

/**
 * **Die Knöpfe der Zeitraum-Leiste sind gleich hoch** (Alwin, 28.10.2026: „Zeitraum Fensterhöhe größer als andere – nicht
 * schön“). Zeitraum-Knopf (40 px), ‹ ＋ ＋ › (32 px) und Filter (34 px) standen in EINER Reihe mit drei festen Höhen. Jetzt
 * nehmen alle `--knopf-hoehe` – dieselbe Zahl wie alle übrigen Knöpfe (seit 28.10.2026). Dieser Test hält fest, dass
 * keiner wieder eine eigene Höhe bekommt; die Musik-App (Abwesenheiten) nutzt Zeitraum und Filter mit.
 */
const KNOEPFE: [datei: string, klasse: string][] = [
  ['ui/bedienung/ZeitraumKnopf.module.scss', 'knopf'],
  ['ui/bedienung/FilterKnopf.module.scss', 'knopf'],
  ['dienstplaner/src/Planen.module.scss', 'leistenKnopf'],
];

/** Der Rumpf der ersten Regel `.klasse { … }` auf oberster Ebene – ohne verschachtelte Blöcke. */
function regel(text: string, klasse: string): string {
  const start = text.search(new RegExp(`^\\.${klasse}\\s*\\{`, 'm'));
  if (start < 0) throw new Error(`.${klasse} nicht gefunden`);
  let tiefe = 0;
  let rumpf = '';
  for (const z of text.slice(text.indexOf('{', start))) {
    if (z === '{') tiefe++;
    if (z === '}' && --tiefe === 0) break;
    if (tiefe === 1 && z !== '{') rumpf += z;
  }
  return rumpf;
}

const hoehe = (rumpf: string) => /(?:^|[\s;])height\s*:\s*([^;]+);/.exec(rumpf)?.[1].trim();

describe('Zeitraum-Leiste: alle Knöpfe gleich hoch (28.10.2026)', () => {
  it.each(KNOEPFE)('%s .%s nimmt --knopf-hoehe', (datei, klasse) => {
    expect(hoehe(regel(readFileSync(join(WURZEL, datei), 'utf8'), klasse))).toBe(
      'var(--knopf-hoehe)',
    );
  });

  it('der Zeitraum-Knopf hat eine FESTE Breite – sonst springen ＋ › beim Klicken (Alwin, 30.10.2026)', () => {
    const rumpf = regel(
      readFileSync(join(WURZEL, 'ui/bedienung/ZeitraumKnopf.module.scss'), 'utf8'),
      'knopf',
    );
    expect(/(?:^|[\s;])width\s*:\s*\d+px\s*;/.test(rumpf)).toBe(true);
    expect(/min-width/.test(rumpf)).toBe(false);
  });

  it('die Prüfung selbst greift (Gegenprobe gegen die Erkennung)', () => {
    const fest =
      '.knopf {\n  min-height: 2px;\n  height: 40px;\n  &:hover {\n    height: 1px;\n  }\n}\n';
    expect(hoehe(regel(fest, 'knopf'))).toBe('40px');
  });
});
