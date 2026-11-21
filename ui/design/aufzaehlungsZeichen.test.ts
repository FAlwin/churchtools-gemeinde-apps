import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUFZAEHLUNG } from '../../shared/protokolle/aufzaehlung';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Aufzählungszeichen: Editor, Lese-Ansicht und PDF gleich** (Protokolle W11, Alwin 21.11.2026: • ◦ –). Das PDF ruft
 * `aufzaehlungsZeichen` selbst; Editor und Lese-Ansicht stellen die Zeichen in SCSS ein und können die Funktion nicht
 * importieren. Steht eine Ebene dort anders, zeigt das Blatt andere Zeichen als das Papier – genau das waren vor W11 drei
 * verschiedene Regeln. Liest die SCSS-Dateien als Text: Vitest liefert `.scss` in Tests leer aus.
 */
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), 'utf8');

/** Die Zeichen des Editors: `--bn-bullet-marker: '…'` in der Reihenfolge der Ebenen. */
function editorZeichen(scss: string): string[] {
  return [...scss.matchAll(/--bn-bullet-marker:\s*'([^']*)'/g)].map((m) => m[1]);
}

/** Die Zeichen der Lese-Ansicht: `ul.aufzaehlungN { list-style-type: '… ' }` – je Ebene das Zeichen ohne den Abstand. */
function ansichtZeichen(scss: string): string[] {
  return [...scss.matchAll(/ul\.aufzaehlung(\d)\s*\{\s*list-style-type:\s*'([^']*)'/g)]
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map((m) => m[2].trim());
}

describe('Aufzählungszeichen der Protokolle (W11)', () => {
  it('der Editor trägt • ◦ – wie die Funktion', () => {
    expect(editorZeichen(lies('protokolle/src/DokumentEditor.scss'))).toEqual([...AUFZAEHLUNG]);
  });

  it('die Lese-Ansicht trägt • ◦ – wie die Funktion', () => {
    expect(ansichtZeichen(lies('protokolle/src/ProtokollAnsicht.module.scss'))).toEqual([
      ...AUFZAEHLUNG,
    ]);
  });

  it('die Erkennung greift (Gegenprobe) – sonst wäre der Vergleich leer gegen leer', () => {
    expect(editorZeichen(".a { --bn-bullet-marker: '•'; }\n.b { --bn-bullet-marker: '▪'; }")).toEqual([
      '•',
      '▪',
    ]);
    expect(
      ansichtZeichen("ul.aufzaehlung1 { list-style-type: '◦ '; } ul.aufzaehlung0 { list-style-type: '• '; }"),
    ).toEqual(['•', '◦']);
    expect(editorZeichen('')).toEqual([]);
    expect(ansichtZeichen('')).toEqual([]);
  });
});
