import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **„Neu anlegen“ ist am Handy das schwebende grüne Plus – nie ein grünes Quadrat im Kopf** (R3, Alwin 20.11.2026).
 *
 * In der Test-Instanz zeigten „Neues To-Do“ (Protokolle) und „Neue Veranstaltung“ (Anmeldungen) am Handy ein grünes
 * Quadrat: Beide Seiten hatten `<KopfKnopf neu …>` selbst gesetzt, ohne den Handy-Zweig, den `useNeuAnlegen` und
 * `HinzufuegenMenue` schon mitbringen. Danach fanden sich vier weitere Stellen mit demselben Fehler (Nachweis-Art, Regel,
 * „Von Hand“, „Neuer Bereich“).
 *
 * Der grüne Knopf (`neu`) darf deshalb nur noch in `ui/bedienung` selbst gesetzt werden – von `useNeuAnlegen`
 * (eine Aktion) und `HinzufuegenMenue` (ein Menü). Jede Seite nimmt einen der beiden. Wer wirklich einen grünen Knopf
 * außerhalb braucht (z. B. in einem Fenster), schreibt hier eine begründete Ausnahme dazu – nie eine stille.
 */
const AUSNAHMEN: Record<string, string> = {};

/** Alle `<KopfKnopf …>`-Marken eines Quelltexts, samt Klammern `{ }` (Pfeilfunktionen enthalten `>`). */
function kopfKnopfMarken(text: string): string[] {
  const marken: string[] = [];
  for (const m of text.matchAll(/<KopfKnopf(?=[\s>/])/g)) {
    let tiefe = 0;
    let ende = m.index + m[0].length;
    for (; ende < text.length; ende++) {
      const z = text[ende];
      if (z === '{') tiefe++;
      else if (z === '}') tiefe--;
      else if (z === '>' && tiefe === 0) break;
    }
    marken.push(text.slice(m.index, ende + 1));
  }
  return marken;
}

/** Hat die Marke das Attribut `neu` (allein, `neu={…}`)? Texte in Anführungszeichen und `{ }` zählen nicht. */
export function hatNeu(marke: string): boolean {
  const ohneWerte = marke
    .replace(/"[^"]*"|'[^']*'/g, '""')
    .replace(/\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g, '{}');
  return /\sneu(?=[\s=/>])/.test(ohneWerte);
}

describe('„Neu“ ist grün am Rechner und schwebend am Handy', () => {
  it('der Prüfer erkennt das Attribut (Gegenprobe gegen einen stillen Test)', () => {
    expect(hatNeu('<KopfKnopf neu label="x" />')).toBe(true);
    expect(hatNeu('<KopfKnopf\n  label="Neu"\n  neu\n  onClick={() => neu()}\n/>')).toBe(true);
    expect(hatNeu('<KopfKnopf neu={true} label="x" />')).toBe(true);
    expect(hatNeu('<KopfKnopf label="Neu anlegen" title="neu" onClick={() => neu()} />')).toBe(
      false,
    );
  });

  it('`KopfKnopf neu` steht nur in ui/bedienung – sonst gibt es am Handy ein grünes Quadrat', () => {
    const funde: string[] = [];
    for (const ordner of ORDNER) {
      for (const datei of dateien(ordner, /\.tsx$/)) {
        const pfad = relative(WURZEL, datei);
        if (/\.test\.tsx$/.test(pfad) || pfad.startsWith('ui/bedienung/') || AUSNAHMEN[pfad])
          continue;
        const anzahl = kopfKnopfMarken(readFileSync(datei, 'utf8')).filter(hatNeu).length;
        if (anzahl > 0) funde.push(`${pfad} (${anzahl}×)`);
      }
    }
    expect(
      funde,
      'Grüner Neu-Knopf ohne Handy-Zweig: nimm `useNeuAnlegen` (eine Aktion) oder `HinzufuegenMenue` (ein Menü) aus ui/bedienung.',
    ).toEqual([]);
  });
});
