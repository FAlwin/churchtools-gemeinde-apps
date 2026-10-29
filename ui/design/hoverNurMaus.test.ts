import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * **Hover-Farben nur mit Maus** (Alwin am iPhone, 29.10.2026).
 *
 * Ein Touch-Gerät hält `:hover` auf dem zuletzt angetippten Element fest, bis woanders hingetippt wird. In der
 * Liedleiste blieb so das vorher angetippte Lied hellblau – es sah aus wie gewählt. Bis zum 29.10. war das an 12 Stellen
 * abgesichert (`@media (hover: hover)`), an 72 nicht. Jetzt steht jede `:hover`-Regel in so einem Block; diese
 * Prüfung hält das fest.
 */
const WURZEL = fileURLToPath(new URL('../../', import.meta.url));
const ORDNER = [
  'client/src',
  'ui',
  'dienstplaner/src',
  'organigramm/src',
  'protokolle/src',
  'anmeldungen/src',
];

function dateien(ordner: string): string[] {
  const aus: string[] = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) aus.push(...dateien(pfad));
    else if (/\.(scss|css)$/.test(name)) aus.push(pfad);
  }
  return aus;
}

/** Zeilennummern (ab 1) der `:hover`-Regeln, die in keinem `@media (hover: hover)`-Block stehen. */
function ohneMausAbfrage(text: string): number[] {
  const offen: boolean[] = [];
  const treffer: number[] = [];
  text.split('\n').forEach((zeile, i) => {
    const code = zeile.split('//')[0];
    if (code.includes(':hover') && !offen.some(Boolean)) treffer.push(i + 1);
    for (const zeichen of code) {
      if (zeichen === '{') offen.push(/hover:\s*hover/.test(code));
      else if (zeichen === '}') offen.pop();
    }
  });
  return treffer;
}

describe('Hover nur mit Maus', () => {
  it('jede :hover-Regel steht in @media (hover: hover)', () => {
    const treffer = ORDNER.flatMap((o) => dateien(join(WURZEL, o))).flatMap((p) =>
      ohneMausAbfrage(readFileSync(p, 'utf8')).map((z) => `${relative(WURZEL, p)}:${z}`),
    );
    expect(treffer).toEqual([]);
  });

  it('die Prüfung erkennt eine ungeschützte Regel – und lässt eine geschützte durch', () => {
    expect(ohneMausAbfrage('.a {\n  &:hover {\n    color: red;\n  }\n}')).toEqual([2]);
    expect(ohneMausAbfrage('.a,\n.a:hover {\n  color: red;\n}')).toEqual([2]);
    expect(
      ohneMausAbfrage(
        '.a {\n  @media (hover: hover) {\n    &:hover {\n      color: red;\n    }\n  }\n}',
      ),
    ).toEqual([]);
    // Nach dem Block gilt der Schutz nicht mehr.
    expect(
      ohneMausAbfrage(
        '@media (hover: hover) {\n  .a:hover {\n    color: red;\n  }\n}\n.b:hover {\n}',
      ),
    ).toEqual([6]);
  });

  it('die Prüfung sieht die Dateien wirklich (Gegenprobe: es gibt geschützte Hover-Regeln)', () => {
    const alle = ORDNER.flatMap((o) => dateien(join(WURZEL, o)));
    expect(alle.length).toBeGreaterThan(100);
    const geschuetzt = alle.filter((p) => /hover:\s*hover/.test(readFileSync(p, 'utf8')));
    expect(geschuetzt.length).toBeGreaterThan(40);
  });
});
