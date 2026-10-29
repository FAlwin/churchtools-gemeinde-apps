import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Den Abstand oben rechnet nur `_variables.scss`** (Alwin am iPhone, 29.10.2026).
 *
 * In der installierten App legt iOS ein Unschärfe-Band über die oberen ~95 pt. Jeder Kopf beginnt deshalb mit
 * `--inhalt-pad-top` darunter. Der Lied-Editor stand als letzter noch mit `--bar-pad-top` direkt unter der Uhr – im
 * Band, weich und „zu hoch“; das Tempo-Menü rechnete seine Höhe mit einem Nachbau derselben alten Regel. Diese Prüfung
 * hält fest, dass niemand mehr selbst aus der Safe-Area oben rechnet.
 *
 * Ausgenommen: `client/src/main.tsx` (misst die Safe-Area für `--sat`) und das öffentliche Anmeldeformular – es läuft
 * auf der Webseite der Gemeinde, nie als App vom Home-Bildschirm.
 */
const ERLAUBT = ['ui/design/_variables.scss', 'client/src/main.tsx', 'ui/anmeldeformular/'];
const MUSTER = /--bar-pad-top\)|safe-area-inset-top|var\(--sat\b/;

const quellen = () =>
  ORDNER.flatMap((o) => dateien(o, /\.(scss|css|tsx?)$/))
    .filter((p) => !/\.test\.tsx?$/.test(p))
    .map((p) => relative(WURZEL, p));

describe('Abstand oben', () => {
  it('kein Kopf rechnet selbst aus der Safe-Area oben – alle über --inhalt-pad-top', () => {
    const treffer = quellen()
      .filter((p) => !ERLAUBT.some((e) => p.startsWith(e)))
      .filter((p) => MUSTER.test(readFileSync(`${WURZEL}/${p}`, 'utf8')));
    expect(treffer).toEqual([]);
  });

  it('die Prüfung sieht etwas (Gegenprobe: _variables.scss rechnet wirklich damit)', () => {
    expect(MUSTER.test(readFileSync(`${WURZEL}/ui/design/_variables.scss`, 'utf8'))).toBe(true);
    expect(quellen().length).toBeGreaterThan(100);
  });

  it('der Lied-Editor beginnt unter dem Band', () => {
    const editor = readFileSync(`${WURZEL}/client/src/components/ChordEditor.module.scss`, 'utf8');
    expect(editor).toContain('padding-top: var(--inhalt-pad-top)');
  });
});
