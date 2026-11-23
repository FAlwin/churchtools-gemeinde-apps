import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Die Live-Liste überlappt nicht mehr** (Gottesdienst 22.11.2026, Live-Ansicht 2 L4-1): `.punkt` hatte
 * `48px minmax(0,1fr) auto` und `.werKlein` `white-space: nowrap` – die Namensspalte nahm ihre volle Breite und drückte den
 * Titel auf fast 0; am Handy liefen die Namen aus dem Bild. Jetzt hat der Titel Vorrang (3 : 2), die Namen brechen um, am
 * Handy stehen sie unter dem Titel. jsdom rechnet kein Layout und Vitest liefert `.scss` leer aus – darum die Regeln als
 * Text.
 */
const scss = readFileSync(join(WURZEL, 'dienstplaner/src/LiveAnsicht.module.scss'), 'utf8');
const nachbar = readFileSync(join(WURZEL, 'ui/ablauf/NachbarKnopf.module.scss'), 'utf8');

/** Der Rumpf der ersten Regel mit diesem Kopf, bis zur schließenden Klammer in Spalte 0 bzw. Einrückung. */
function regel(text: string, kopf: string): string {
  const start = text.indexOf(`${kopf} {`);
  expect(start, `${kopf} fehlt`).toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf('\n}', start));
}

describe('Live-Liste: Titel vor Namen', () => {
  it('der Titel hat Vorrang vor den Namen: 48px · 3fr · 2fr', () => {
    expect(regel(scss, '.punkt')).toMatch(
      /grid-template-columns:\s*48px minmax\(0, 3fr\) minmax\(0, 2fr\)/,
    );
  });

  it('Namen brechen um und laufen nicht aus dem Bild (kein nowrap, rechtsbündig)', () => {
    const wer = regel(scss, '.werKlein');
    expect(wer).not.toMatch(/nowrap/);
    expect(wer).toMatch(/overflow-wrap:\s*anywhere/);
    expect(wer).toMatch(/text-align:\s*right/);
    expect(wer).toMatch(/min-width:\s*0/);
  });

  it('am Handy stehen die Namen unter dem Titel (eine Spalte neben der Zeit)', () => {
    const handy = scss.slice(scss.indexOf('@media (max-width: 759px)'));
    expect(handy).toMatch(/\.punkt\s*{[^}]*grid-template-columns:\s*44px minmax\(0, 1fr\)/);
    expect(handy).toMatch(/\.werKlein\s*{[^}]*grid-column:\s*2/);
  });
});

describe('Live-Steuerleiste unten (A11)', () => {
  it('„Weiter“ ist der eine gefüllte Knopf: blau gefüllt (R1)', () => {
    const haupt = regel(nachbar, '.haupt');
    expect(haupt).toMatch(/background:\s*var\(--blue\)/);
    expect(haupt).toMatch(/color:\s*#fff/);
  });

  it('die Leiste hält den Home-Strich frei (`--unten-strich`, nie env(safe-area-inset-bottom))', () => {
    const fuss = regel(scss, '.fuss');
    expect(fuss).toMatch(/var\(--unten-strich\)/);
    expect(fuss).not.toMatch(/safe-area-inset/);
  });

  it('am Handy bleibt der Strich frei (auch in der Handy-Regel)', () => {
    const handy = scss.slice(scss.lastIndexOf('@media (max-width: 759px)'));
    expect(handy).toMatch(/\.fuss\s*{[^}]*var\(--unten-strich\)/);
  });
});
