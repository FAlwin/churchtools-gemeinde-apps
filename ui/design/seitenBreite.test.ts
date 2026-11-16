import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Eine Breite für alle Seiten** (Alwin, 16.11.2026: „warum wird nicht die komplette Fensterbreite genutzt?“ –
 * „ich fände es nicht cool, wenn es unterschiedlich breit ist. Auch in verschiedenen Erweiterungen. Sollte schon
 * einheitlich sein.“). Vorher begrenzte der gemeinsame Rahmen auf 1120 px, der Gebetsabend auf 672 px und die
 * Protokoll-Seiten jede für sich auf 720–820 px. Matrix und „Personen“ hatten dadurch auf großen Bildschirmen nur
 * die Hälfte des Platzes.
 *
 * Dieser Test hält fest: Eine feste Höchstbreite ab 600 px (`max-width: 1120px`) fällt auf. Was schmaler ist (Menüs,
 * Hinweiskästen, Felder), darf bleiben. Fließtext begrenzt `--lese-breite` aus `_variables.scss`. Ausnahmen tragen den
 * Vermerk „bewusst fest“ mit Grund in derselben Zeile (z. B. eine Vollbild-Ansicht, die nicht im Seitenrahmen steht).
 */
const AB_PX = 600;

function festeSeitenbreite(zeile: string): boolean {
  if (/bewusst fest/.test(zeile)) return false;
  const m = /^\s*max-width\s*:\s*(\d+)px\s*;/.exec(zeile);
  return !!m && Number(m[1]) >= AB_PX;
}

describe('eine Seitenbreite für alle Erweiterungen (16.11.2026)', () => {
  it('keine feste Höchstbreite ab 600 px in den Stildateien', () => {
    const funde: string[] = [];
    for (const ordner of ORDNER) {
      for (const datei of dateien(ordner, /\.scss$/)) {
        const rel = relative(WURZEL, datei);
        readFileSync(datei, 'utf8')
          .split('\n')
          .forEach((zeile, i) => {
            if (festeSeitenbreite(zeile)) funde.push(`${rel}:${i + 1}  ${zeile.trim()}`);
          });
      }
    }
    expect(funde).toEqual([]);
  });

  it('erkennt eine feste Seitenbreite, lässt Schmales, Rechnungen und Vermerke durch', () => {
    expect(festeSeitenbreite('  max-width: 1120px;')).toBe(true);
    expect(festeSeitenbreite('  max-width: 600px;')).toBe(true);
    expect(festeSeitenbreite('  max-width: 560px;')).toBe(false);
    expect(festeSeitenbreite('  max-width: var(--lese-breite);')).toBe(false);
    expect(festeSeitenbreite('  max-width: calc(100vw - 48px);')).toBe(false);
    expect(festeSeitenbreite('  max-width: 1200px; // bewusst fest: Vollbild')).toBe(false);
  });
});
