import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Einmal geändert, überall geändert** (Alwin, 22.10.2026, #654): Rundungen stehen nur in `_variables.scss`
 * (`--r-card`, `--r-tile`, `--r-ctrl`, `--r-dialog`). Beim Umstieg auf den Look der ChurchTools-Weboberfläche
 * standen 181 Rundungen fest im Code – die Werte zu ändern hätte Knöpfe und Kacheln gar nicht erreicht.
 * Dieser Test hält das fest: Eine feste Rundung ab 4 px fällt auf, außer
 * - Kapseln/Kreise (`999px`, `50%`) und Haarfeines unter 4 px,
 * - Rechnungen auf einem Wert (`calc(var(--r-ctrl) + 2px)`),
 * - Zeilen mit dem Vermerk „bewusst fest“ und einem Grund (z. B. der Handy-Rahmen in der Vorschau, die
 *   Knopfformen, die man im Anmeldeformular auswählt).
 */
const AUSNAHMEN = new Set(['ui/design/_variables.scss']);

/** Feste Rundungen in einer Zeile: Zahlen ≥ 4 px im Wert einer `…radius`-Angabe, ohne `calc(`. */
function festeRundung(zeile: string): boolean {
  if (/bewusst fest/.test(zeile)) return false;
  const m =
    /border(?:-[a-z]+)*-radius\s*:\s*([^;]+)/.exec(zeile) ??
    /borderRadius\s*:\s*(['"]?[^,}\n]+)/.exec(zeile);
  if (!m || m[1].includes('calc(') || m[1].includes('var(')) return false;
  // Pixelwerte – und in Komponenten die nackte Zahl (`borderRadius: 8` heißt in React 8 px). Prozent zählt nicht.
  const zahlen = [...m[1].matchAll(/(\d+)px/g), ...m[1].matchAll(/^\s*(\d+)\s*$/g)].map((z) =>
    Number(z[1]),
  );
  return zahlen.some((n) => n >= 4 && n < 999);
}

describe('Rundungen nur über die gemeinsamen Werte (#654)', () => {
  it('keine feste Rundung ab 4 px außerhalb von _variables.scss', () => {
    const funde: string[] = [];
    for (const ordner of ORDNER) {
      for (const datei of dateien(ordner, /\.(scss|tsx|ts)$/)) {
        const rel = relative(WURZEL, datei);
        if (AUSNAHMEN.has(rel) || /\.test\.tsx?$/.test(rel)) continue;
        readFileSync(datei, 'utf8')
          .split('\n')
          .forEach((zeile, i) => {
            if (festeRundung(zeile)) funde.push(`${rel}:${i + 1}  ${zeile.trim()}`);
          });
      }
    }
    expect(funde).toEqual([]);
  });

  it('jede App des Repos wird geprüft (auch neu dazugekommene)', () => {
    for (const app of [
      'client',
      'anmeldungen',
      'dienstplaner',
      'organigramm',
      'protokolle',
      'formular',
    ]) {
      expect(ORDNER).toContain(`${app}/src`);
    }
  });

  it('die Prüfung selbst greift (Gegenprobe gegen die Erkennung)', () => {
    expect(festeRundung('  border-radius: 10px;')).toBe(true);
    expect(festeRundung('  border-top-left-radius: 12px;')).toBe(true);
    expect(festeRundung('  border-radius: 6px 6px 0 0;')).toBe(true);
    expect(festeRundung("    borderRadius: '5px',")).toBe(true);
    expect(festeRundung('            borderRadius: 8,')).toBe(true);
    expect(festeRundung('  border-radius: var(--r-card);')).toBe(false);
    expect(festeRundung('  border-radius: calc(var(--r-ctrl) + 2px);')).toBe(false);
    expect(festeRundung('  border-radius: 999px;')).toBe(false);
    expect(festeRundung('  border-radius: 50%;')).toBe(false);
    expect(festeRundung('  border-radius: 3px;')).toBe(false);
    expect(festeRundung('  border-radius: 32px; // bewusst fest: Handy-Rahmen')).toBe(false);
  });
});
