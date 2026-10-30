import { describe, expect, it } from 'vitest';
import { seiteInDerMitte } from './scrollPosition';

/**
 * **Welche Seite im Scroll-Modus gilt** (Scheibe B4, 30.10.2026): die in der Bildmitte – am Rand die erste bzw. letzte.
 * Gemessen im Test mit zehn kurzen Liedern: Ganz unten war das vorletzte gewählt, weil das letzte die Bildmitte nie
 * erreichte.
 */
// Zehn Seiten zu je 223 px, sichtbar 620 px – wie im E2E-Stub am Handy (gesamt 2230).
const OBEN = Array.from({ length: 10 }, (_, i) => i * 223);
const SICHT = 620;
const GESAMT = 2230;

describe('seiteInDerMitte', () => {
  it('in der Mitte des Inhalts: die Seite in der Bildmitte', () => {
    // y 1115 → Mitte 1425 → Seite 6 (1338–1561).
    expect(seiteInDerMitte(OBEN, 1115, SICHT, GESAMT)).toBe(6);
  });

  it('ganz unten: die letzte Seite, auch wenn sie die Bildmitte nie erreicht', () => {
    // y 1610 → Mitte 1920 → nach der Mitte-Regel Seite 8; das letzte Lied (2007–2230) kommt nie in die Mitte.
    expect(seiteInDerMitte(OBEN, GESAMT - SICHT, SICHT, GESAMT)).toBe(9);
  });

  it('ganz oben: die erste Seite, auch wenn sie kürzer ist als eine halbe Bildschirmhöhe', () => {
    expect(seiteInDerMitte(OBEN, 0, SICHT, GESAMT)).toBe(0);
  });

  it('ein Pixel vor dem Ende gilt noch die Mitte-Regel', () => {
    expect(seiteInDerMitte(OBEN, GESAMT - SICHT - 5, SICHT, GESAMT)).toBe(8);
  });

  it('ohne Seiten: 0', () => {
    expect(seiteInDerMitte([], 0, SICHT, 0)).toBe(0);
  });
});
