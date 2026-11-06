import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dateien, WURZEL } from '../design/quelltexte.testutil';

/**
 * **Wo auf `useLaden` umgestellt ist, lädt niemand mehr von Hand** (#845, Scheibe 3). Ein neuer `useEffect` mit
 * `let aktuell = true` wäre wieder eine eigene Regel für späte Antworten und Fehler – genau die Kopien, die `useLaden`
 * ersetzt. Die Liste wächst mit jeder Scheibe; am Ende stehen alle Erweiterungen darin.
 */
const UMGESTELLT = ['ui', 'organigramm/src'];
const VON_HAND = /\blet (aktuell|aktiv) = true\b/;
const HOOK = join(WURZEL, 'ui/ct/useLaden.ts');

describe('useLaden statt handgeschriebener Ladeblöcke', () => {
  it('erkennt einen Ladeblock – die Regel steht EINMAL, im Hook selbst', () => {
    // Fände das Muster den Hook nicht, mäße der zweite Test nichts.
    expect(readFileSync(HOOK, 'utf8')).toMatch(VON_HAND);
  });

  it('in den umgestellten Ordnern lädt niemand mehr von Hand', () => {
    const vonHand = UMGESTELLT.flatMap((o) => dateien(o, /\.tsx?$/))
      .filter((p) => p !== HOOK && !/\.test\.tsx?$/.test(p))
      .filter((p) => VON_HAND.test(readFileSync(p, 'utf8')))
      .map((p) => relative(WURZEL, p));
    expect(vonHand).toEqual([]);
  });
});
