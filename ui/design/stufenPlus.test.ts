import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Zwei Arten von „+“** (R3/R10, „Ruhige Bedienung“ B8): grün gefüllt = etwas Neues anlegen, gestrichelt und leise = hier
 * fehlt etwas. Die Farbe ist der Unterschied – deshalb liest dieser Test die Stile, nicht die Bausteine: `SchwebePlus` (der
 * grüne Kreis am Handy) muss dieselbe Variable nehmen wie der grüne Knopf am Rechner (`KopfKnopf neu`), und das leise Feld
 * darf nie eine Farbe oder Fläche bekommen.
 */
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8');
const hintergrund = (scss: string, regel: string) =>
  new RegExp(`\\.${regel}\\s*\\{[^}]*?background:\\s*(var\\(--[a-z-]+\\))`).exec(scss)?.[1];

describe('Zwei Arten von „+“', () => {
  it('das grüne Plus am Handy ist grün wie „Neu“ am Rechner – dieselbe Variable, kein blauer Rest', () => {
    const plus = lies('ui/bedienung/SchwebePlus.module.scss');
    const kopf = lies('ui/bedienung/KopfKnopf.module.scss');
    expect(hintergrund(kopf, 'neu')).toBe('var(--green)');
    expect(hintergrund(plus, 'plus')).toBe(hintergrund(kopf, 'neu'));
    // Auch der Schatten: ein blauer Schatten unter einem grünen Kreis wäre ein halber Fix.
    expect(plus).not.toMatch(/--blue/);
  });

  it('das leise „+“ ist gestrichelt, ohne Fläche und ohne Grün', () => {
    const q = lies('ui/bedienung/LeisesPlus.module.scss');
    expect(q).toMatch(/border:\s*1px dashed/);
    expect(q).toMatch(/\.feld\s*\{[^}]*background:\s*none/);
    expect(q).not.toMatch(/--green/);
  });
});
