import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from '../design/quelltexte.testutil';

/**
 * **Jedes Fenster im ChurchTools-Aufbau** (E6-O, Entwurf `fenster-entwurf.html`, abgenommen 23.10.2026): Ein `Sheet`
 * bekommt den Kopf mit X und die Knöpfe rechts unten nur, wenn es `knoepfe` reicht (auch `null` für Fenster nur zum
 * Ansehen). Umgezogen wurde App für App (F1 #716, F2 #720, F3 #726, F4 #734, F5 #741); seit F5
 * gilt es für ALLE Apps – auch für jede neue (die Ordner kommen aus den Workspaces). Ein Fenster im alten Aufbau fällt
 * sofort auf.
 */

/** Die öffnenden `<Sheet …>`-Tags einer Datei – bis zur schließenden `>` außerhalb von `{…}`. */
function sheetTags(quelltext: string): { zeile: number; tag: string }[] {
  const out: { zeile: number; tag: string }[] = [];
  const muster = /<Sheet\b/g;
  let m: RegExpExecArray | null;
  while ((m = muster.exec(quelltext))) {
    let tiefe = 0;
    let i = m.index + m[0].length;
    for (; i < quelltext.length; i++) {
      const c = quelltext[i];
      if (c === '{') tiefe++;
      else if (c === '}') tiefe--;
      else if (c === '>' && tiefe === 0) break;
    }
    out.push({
      zeile: quelltext.slice(0, m.index).split('\n').length,
      tag: quelltext.slice(m.index, i + 1),
    });
  }
  return out;
}

/** Alle alten Fenster (ohne `knoepfe`) je App-Ordner. */
function alteFenster(): Map<string, string[]> {
  const funde = new Map<string, string[]>();
  for (const ordner of ORDNER) {
    for (const datei of dateien(ordner, /\.tsx$/)) {
      const rel = relative(WURZEL, datei);
      if (/\.test\.tsx$/.test(rel)) continue;
      for (const { zeile, tag } of sheetTags(readFileSync(datei, 'utf8'))) {
        if (!/\bknoepfe=/.test(tag)) {
          funde.set(ordner, [...(funde.get(ordner) ?? []), `${rel}:${zeile}`]);
        }
      }
    }
  }
  return funde;
}

describe('Fenster im ChurchTools-Aufbau (E6-O)', () => {
  it('keine App hat ein Fenster ohne `knoepfe`', () => {
    expect([...alteFenster().values()].flat()).toEqual([]);
  });

  it('kein Fenster nur zum Ansehen reicht noch eine Knopf-Beschriftung (02.11.2026)', () => {
    // Mit `knoepfe={null}` hat ein Fenster keine Fußzeile mehr – ein `cancelLabel` daneben wäre ein toter Rest, der so
    // aussieht, als stünde unten doch ein „Schließen“.
    const funde: string[] = [];
    for (const ordner of ORDNER) {
      for (const datei of dateien(ordner, /\.tsx$/)) {
        const rel = relative(WURZEL, datei);
        if (/\.test\.tsx$/.test(rel)) continue;
        for (const { zeile, tag } of sheetTags(readFileSync(datei, 'utf8'))) {
          if (/\bknoepfe=\{null\}/.test(tag) && /\bcancelLabel=/.test(tag))
            funde.push(`${rel}:${zeile}`);
        }
      }
    }
    expect(funde).toEqual([]);
  });

  it('kein „Zurück“-Knopf unten – zurück geht es mit „‹“ oben (02.11.2026)', () => {
    // Entwurf „Fenster mit Zurück“: Wechselt ein Fenster seine Seite, führt „‹“ vor dem Titel zurück (`Sheet zurueck`).
    // Ein „Zurück“ unten stand an der Stelle von „Abbrechen“ und sah in jeder App anders aus.
    const funde: string[] = [];
    for (const ordner of ORDNER) {
      for (const datei of dateien(ordner, /\.tsx$/)) {
        const rel = relative(WURZEL, datei);
        if (/\.test\.tsx$/.test(rel)) continue;
        const quelltext = readFileSync(datei, 'utf8');
        // Die Attribute dürfen `{…}` mit `>` darin enthalten (`onClick={() => …}`) – sonst fände das Muster fast nichts.
        for (const m of quelltext.matchAll(
          /<FensterKnopf\b(?:[^>{]|\{(?:[^{}]|\{[^{}]*\})*\})*>\s*Zurück\s*<\/FensterKnopf>/g,
        )) {
          funde.push(`${rel}:${quelltext.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    expect(funde).toEqual([]);
  });

  it('prüft alle Apps und `ui/` (sonst wäre der Test oben billig grün)', () => {
    expect(ORDNER).toEqual(
      expect.arrayContaining([
        'client/src',
        'dienstplaner/src',
        'anmeldungen/src',
        'organigramm/src',
        'protokolle/src',
        'gebetsabend/src',
        'ui',
      ]),
    );
  });

  it('findet ein Fenster ohne `knoepfe`, auch mehrzeilig und mit `>` in einem Ausdruck', () => {
    const quelle = [
      '<Sheet title="A" onClose={() => x > 1 && zu()}>',
      '<Sheet',
      '  title="B"',
      '  knoepfe={<FensterKnopf>Speichern</FensterKnopf>}',
      '>',
    ].join('\n');
    const tags = sheetTags(quelle);
    expect(tags.map((t) => t.zeile)).toEqual([1, 2]);
    expect(tags.map((t) => /\bknoepfe=/.test(t.tag))).toEqual([false, true]);
  });
});
