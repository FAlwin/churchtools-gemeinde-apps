import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Das Gewählte eines Umschalters ist blau umrandet – an EINER Stelle geregelt** (Variante B, Alwin 30.10.2026).
 *
 * Im Tempo-Fenster fand Alwin nicht, wo der sichtbare Puls an ist: Gewählt war nur eine Stufe heller grau. Mehrere
 * Stellen hatten sich deshalb längst selbst geholfen und `border-color: var(--blue)` / `color: var(--blue-ink)` über den
 * gemeinsamen Baustein geschrieben – jede ein bisschen anders. Jetzt macht `auswahlKnopfAn` das für alle, und diese
 * Prüfung hält fest, dass das alte Grau (`--seg-on`) nicht zurückkommt und niemand die Regel wieder nachbaut.
 */
const MIXINS = `${WURZEL}/ui/design/_mixins.scss`;
const alleStile = () => ORDNER.flatMap((o) => dateien(o, /\.(scss|css)$/));

function rumpf(text: string, mixin: string): string {
  const start = text.indexOf(`@mixin ${mixin} {`);
  return start < 0 ? '' : text.slice(start, text.indexOf('\n}', start));
}

describe('Auswahl in Umschaltern', () => {
  it('auswahlKnopfAn: blauer Rand, zart blaue Fläche, blaue Schrift', () => {
    const r = rumpf(readFileSync(MIXINS, 'utf8'), 'auswahlKnopfAn');
    expect(r).toContain('border-color: var(--blue);');
    expect(r).toContain('background: var(--blue-soft);');
    expect(r).toContain('color: var(--blue-ink);');
  });

  it('das alte Grau `--seg-on` gibt es nirgends mehr', () => {
    const treffer = alleStile().filter((p) => readFileSync(p, 'utf8').includes('--seg-on'));
    expect(treffer).toEqual([]);
  });

  it('niemand schreibt Rand oder Schrift der Auswahl nach dem Baustein noch einmal selbst', () => {
    const doppelt = alleStile().filter((p) =>
      /@include (?:m\.)?auswahlKnopfAn;\n\s*(?:border-color: var\(--blue\)|color: var\(--blue-ink\));/.test(
        readFileSync(p, 'utf8'),
      ),
    );
    expect(doppelt).toEqual([]);
  });

  it('die Prüfung sieht etwas (Gegenprobe: der Baustein wird wirklich benutzt)', () => {
    const nutzer = alleStile().filter((p) => readFileSync(p, 'utf8').includes('auswahlKnopfAn;'));
    expect(nutzer.length).toBeGreaterThanOrEqual(8);
  });
});
