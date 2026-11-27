import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Ein Fenster beginnt immer unterhalb des Unschärfe-Bands** (Alwin am iPad, 27.11.2026).
 *
 * In der installierten iOS-App liegt oben ein Band (`--band-unten`, sonst 0px). Seit #1174 beginnen alle Köpfe darunter;
 * das `Sheet` hatte mit Tastatur oben nur 8 px Rand – der Kopf („‹ Lied verknüpfen ✕“) stand im Band, weich und
 * schlecht lesbar. Gilt für alle Erweiterungen, weil `Sheet` gemeinsam ist. Es gibt keine zweite Unterkante: nur die
 * Variable, kein eigener Wert aus der Safe-Area (das hält `obenBand.test.ts` fest).
 */
const sheet = readFileSync(`${WURZEL}/ui/fenster/Sheet.module.scss`, 'utf8');

/** Der Rumpf einer Regel, deren Selektor genau so beginnt. */
const regel = (selektor: string) => {
  const start = sheet.indexOf(`${selektor} {`);
  expect(start, `${selektor} fehlt`).toBeGreaterThan(-1);
  return sheet.slice(start, sheet.indexOf('}', start));
};

describe('Fenster unter dem Band', () => {
  it('ohne Tastatur: oben mindestens --band-unten (zentriert, hohes Fenster)', () => {
    expect(regel('.overlay')).toMatch(
      /padding:\s*max\(16px,\s*var\(--band-unten\)\)\s+16px\s+16px;/,
    );
  });

  it('mit Tastatur (oben verankert): oben mindestens --band-unten', () => {
    expect(regel('.overlay[data-tastatur]')).toMatch(
      /padding:\s*max\(8px,\s*var\(--band-unten\)\)\s+16px\s+calc\(8px \+ var\(--kb, 0px\)\);/,
    );
  });

  it('das Handy-Vollbild bleibt ohne Rand – sein Kopf hält den Abstand selbst (--inhalt-pad-top)', () => {
    expect(sheet).toMatch(/\.overlayVoll,\s*\.overlayVoll\[data-tastatur\]\s*\{\s*padding:\s*0;/);
    expect(sheet).toContain('padding-top: max(16px, var(--inhalt-pad-top))');
  });
});
