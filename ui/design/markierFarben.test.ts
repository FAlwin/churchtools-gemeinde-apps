import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Markier-Farben: Blatt, Leiste und Lese-Ansicht gleich** (Protokolle K3a). Wo die Protokolle von BlockNotes Farben
 * abweichen (Gelb = unser Textmarker `--markiert`), steht das in `protokolle/src/farben.ts` (`EIGENE_HINTERGRUENDE`) –
 * und der Editor bekommt es über `DokumentEditor.scss`. Steht eine Abweichung nur auf einer Seite, färbt das Blatt
 * anders als Leiste und Lese-Ansicht. Liest beide als Text: Vitest liefert `.scss` in Tests leer aus.
 */
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8');

function eigeneHintergruende(ts: string): Record<string, string> {
  const block = /EIGENE_HINTERGRUENDE[^=]*=\s*\{([^}]*)\}/.exec(ts)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
}

function editorAbweichungen(scss: string): Record<string, string> {
  return Object.fromEntries(
    [...scss.matchAll(/--bn-colors-highlights-([a-z]+)-background:\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

describe('Markier-Farben der Protokolle (K3a)', () => {
  it('jede Abweichung von BlockNote steht in farben.ts UND im Editor-Stil – mit demselben Wert', () => {
    const ts = eigeneHintergruende(lies('protokolle/src/farben.ts'));
    const scss = editorAbweichungen(lies('protokolle/src/DokumentEditor.scss'));
    expect(scss).toEqual(ts);
  });

  it('die Erkennung greift (Gegenprobe) – sonst wäre der Vergleich oben leer gegen leer', () => {
    expect(eigeneHintergruende(lies('protokolle/src/farben.ts'))).toEqual({
      yellow: 'var(--markiert)',
    });
    expect(editorAbweichungen('.x {\n  --bn-colors-highlights-red-background: #f00;\n}')).toEqual({
      red: '#f00',
    });
  });
});

describe('Textmarker auf Papier (Protokolle S6-3a)', () => {
  it('MARKIERT_PAPIER ist `--markiert` der hellen Farben auf Weiß gemischt', () => {
    const scss = lies('ui/design/_farben.scss');
    const m = /--markiert:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(scss);
    expect(m).not.toBeNull();
    const [r, g, b, a] = [1, 2, 3, 4].map((i) => Number(m![i]));
    const gemischt = [r, g, b].map((c) => Math.round(255 - a * (255 - c)));
    const papier = /MARKIERT_PAPIER: Rgb = \[(\d+), (\d+), (\d+)\]/.exec(
      lies('protokolle/src/farben.ts'),
    );
    expect(papier).not.toBeNull();
    expect([1, 2, 3].map((i) => Number(papier![i]))).toEqual(gemischt);
  });
});
