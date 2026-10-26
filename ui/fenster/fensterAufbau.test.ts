import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from '../design/quelltexte.testutil';

/**
 * **Jedes Fenster im ChurchTools-Aufbau** (E6-O, Entwurf `fenster-entwurf.html`, abgenommen 23.10.2026): Ein `Sheet`
 * bekommt den Kopf mit X und die Knöpfe rechts unten nur, wenn es `knoepfe` reicht (auch `null` für Fenster nur zum
 * Ansehen). Umgezogen wird App für App (F1 #716, F2 #720, F3 #726, F4 Anmeldungen). Dieser Test hält fest, was schon umgezogen ist –
 * ein neues Fenster im alten Aufbau fällt sofort auf.
 *
 * `NOCH_NICHT_UMGEZOGEN` schrumpft mit F5. Steht eine App darin, die gar kein altes Fenster mehr hat, schlägt der
 * zweite Test an: dann gehört sie aus der Liste.
 */
const NOCH_NICHT_UMGEZOGEN = new Set(['organigramm/src', 'protokolle/src']);

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
  it('umgezogene Apps haben kein Fenster ohne `knoepfe` mehr', () => {
    const funde = [...alteFenster()]
      .filter(([ordner]) => !NOCH_NICHT_UMGEZOGEN.has(ordner))
      .flatMap(([, stellen]) => stellen);
    expect(funde).toEqual([]);
  });

  it('die Liste der noch nicht umgezogenen Apps ist ehrlich – jede hat noch alte Fenster', () => {
    const alt = alteFenster();
    for (const ordner of NOCH_NICHT_UMGEZOGEN) {
      expect(ORDNER).toContain(ordner);
      expect(alt.get(ordner)?.length ?? 0).toBeGreaterThan(0);
    }
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
