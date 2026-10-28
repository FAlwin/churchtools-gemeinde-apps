import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Editoren in Tests nur über `einhaengen()`** (`editorTest.testutil.ts`). Ein Test, der einen echten Editor selbst
 * einhängt (`e.mount(document.createElement('div'))`) und nie wieder aus, lässt die CI wackeln: Ein später Zeitgeber
 * von ProseMirror fasst nach dem Abbau von jsdom `document` an (#744). Der Helfer stand zuerst nur in einer Testdatei,
 * der nächste Test (`abschnittZiehen.test.ts`) baute das Einhängen nach – am 28.10.2026 wackelte die CI erneut.
 * Diese Prüfung hält fest: Kein Test und keine Test-Hilfe ruft `.mount(` selbst auf, außer dem Helfer.
 */
const HELFER = 'protokolle/src/editorTest.testutil.ts';
// Der Helfer selbst und diese Prüfung (ihre Beispiele für die Gegenprobe) – sonst niemand.
const AUSNAHMEN = new Set([HELFER, 'ui/design/editorEinhaengen.test.ts']);

// Die Apps (`<app>/src`) und ui/ aus der gemeinsamen Liste – dazu shared/, dessen Tests nicht unter `src/` liegen.
const TEST_ORDNER = [...ORDNER, 'shared'];

/** Ein eigenes Einhängen in einer Zeile: `.mount(` als Aufruf, nicht als Teil eines längeren Namens. */
function eigenesEinhaengen(zeile: string): boolean {
  return /\.mount\s*\(/.test(zeile);
}

describe('Editoren in Tests nur über einhaengen() (#744)', () => {
  it('kein Test hängt einen Editor selbst ein', () => {
    const funde: string[] = [];
    for (const ordner of TEST_ORDNER) {
      for (const datei of dateien(ordner, /\.(test|testutil)\.tsx?$/)) {
        const rel = relative(WURZEL, datei);
        if (AUSNAHMEN.has(rel)) continue;
        readFileSync(datei, 'utf8')
          .split('\n')
          .forEach((zeile, i) => {
            if (eigenesEinhaengen(zeile)) funde.push(`${rel}:${i + 1}  ${zeile.trim()}`);
          });
      }
    }
    expect(funde).toEqual([]);
  });

  it('die Ordner gibt es, und der Helfer liegt, wo die Ausnahme ihn erwartet', () => {
    for (const ordner of ['protokolle/src', 'ui', 'shared'])
      expect(dateien(ordner, /\.test\.tsx?$/).length).toBeGreaterThan(0);
    expect(readFileSync(join(WURZEL, HELFER), 'utf8')).toContain('export function einhaengen');
  });

  it('die Prüfung selbst greift (Gegenprobe gegen die Erkennung)', () => {
    expect(eigenesEinhaengen("  e.mount(document.createElement('div'));")).toBe(true);
    expect(eigenesEinhaengen('  editor.mount (el);')).toBe(true);
    expect(eigenesEinhaengen('  einhaengen(editor);')).toBe(false);
    expect(eigenesEinhaengen('  const { unmount } = render(<Ansicht />);')).toBe(false);
    expect(eigenesEinhaengen('  e.unmount();')).toBe(false);
  });
});
