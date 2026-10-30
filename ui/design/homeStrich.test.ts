import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Den Home-Strich liest nur eine Stelle** (Messung mit Alwin, 29.10.2026).
 *
 * `env(safe-area-inset-bottom)` stimmt nicht überall – in der ChurchTools-App vom Home-Bildschirm ist es 0, obwohl der
 * Strich über dem Inhalt liegt. Bis zum 29.10. las ihn jede Stelle selbst (Reiterleiste, Fußleiste, Plus, Meldungen,
 * Fenster unten …); der Fehler steckte damit in vierzehn Formeln. Jetzt rechnet alles mit `--unten-strich`
 * (`_variables.scss`), gemessen in `ui/fenster/appHeight.ts`. Ausgenommen ist das öffentliche Anmeldeformular: Es läuft
 * auf der Webseite der Gemeinde, nie als App vom Home-Bildschirm.
 */
const ERLAUBT = ['ui/design/_variables.scss', 'ui/fenster/appHeight.ts', 'ui/anmeldeformular/'];

/** Stile und Quelltext aller Apps (aus `quelltexte.testutil.ts`, damit eine neue App von selbst dabei ist), ohne Tests. */
const alleDateien = () =>
  ORDNER.flatMap((o) => dateien(o, /\.(scss|css|tsx?)$/)).filter((p) => !/\.test\.tsx?$/.test(p));

describe('Home-Strich', () => {
  it('niemand liest env(safe-area-inset-bottom) selbst – alles über --unten-strich', () => {
    const treffer = alleDateien()
      .map((p) => relative(WURZEL, p))
      .filter((p) => !ERLAUBT.some((e) => p.startsWith(e)))
      .filter((p) => readFileSync(join(WURZEL, p), 'utf8').includes('safe-area-inset-bottom'));
    expect(treffer).toEqual([]);
  });

  it('die Prüfung findet etwas (Gegenprobe: die erlaubten Stellen lesen ihn wirklich)', () => {
    expect(readFileSync(join(WURZEL, 'ui/design/_variables.scss'), 'utf8')).toContain(
      'safe-area-inset-bottom',
    );
    expect(dateien('ui', /\.(scss|css|tsx?)$/).length).toBeGreaterThan(50);
  });

  it('das Plus steht über --plus-boden, nicht mit eigener Zahl', () => {
    const plus = readFileSync(join(WURZEL, 'ui/bedienung/SchwebePlus.module.scss'), 'utf8');
    expect(plus).toContain('bottom: calc(var(--plus-boden) + 16px)');
  });
});
