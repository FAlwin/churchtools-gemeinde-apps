import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * **Den Home-Strich liest nur eine Stelle** (Messung mit Alwin, 29.10.2026).
 *
 * `env(safe-area-inset-bottom)` stimmt nicht überall – in der ChurchTools-App vom Home-Bildschirm ist es 0, obwohl der
 * Strich über dem Inhalt liegt. Bis zum 29.10. las ihn jede Stelle selbst (Reiterleiste, Fußleiste, Plus, Meldungen,
 * Fenster unten …); der Fehler steckte damit in vierzehn Formeln. Jetzt rechnet alles mit `--unten-strich`
 * (`_variables.scss`), gemessen in `ui/fenster/appHeight.ts`. Ausgenommen ist das öffentliche Anmeldeformular: Es läuft
 * auf der Webseite der Gemeinde, nie als App vom Home-Bildschirm.
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
const ERLAUBT = ['ui/design/_variables.scss', 'ui/fenster/appHeight.ts', 'ui/anmeldeformular/'];

function dateien(ordner: string): string[] {
  const aus: string[] = [];
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) aus.push(...dateien(pfad));
    else if (/\.(scss|css|tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)) aus.push(pfad);
  }
  return aus;
}

describe('Home-Strich', () => {
  it('niemand liest env(safe-area-inset-bottom) selbst – alles über --unten-strich', () => {
    const treffer = ORDNER.flatMap((o) => dateien(join(WURZEL, o)))
      .map((p) => relative(WURZEL, p))
      .filter((p) => !ERLAUBT.some((e) => p.startsWith(e)))
      .filter((p) => readFileSync(join(WURZEL, p), 'utf8').includes('safe-area-inset-bottom'));
    expect(treffer).toEqual([]);
  });

  it('die Prüfung findet etwas (Gegenprobe: die erlaubten Stellen lesen ihn wirklich)', () => {
    expect(readFileSync(join(WURZEL, 'ui/design/_variables.scss'), 'utf8')).toContain(
      'safe-area-inset-bottom',
    );
    expect(dateien(join(WURZEL, 'ui')).length).toBeGreaterThan(50);
  });

  it('das Plus steht über --plus-boden, nicht mit eigener Zahl', () => {
    const plus = readFileSync(join(WURZEL, 'ui/bedienung/SchwebePlus.module.scss'), 'utf8');
    expect(plus).toContain('bottom: calc(var(--plus-boden) + 16px)');
  });
});
