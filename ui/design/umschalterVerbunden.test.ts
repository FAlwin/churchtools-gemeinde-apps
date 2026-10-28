import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, WURZEL } from './quelltexte.testutil';

/**
 * **Jeder Umschalter des Organigramms auf einer Schiene** (`Segment … verbunden`): so hoch wie alle Knöpfe der Reihe,
 * und die Beschriftung bricht nicht um. Im Reiter war das seit dem 28.10.2026 so („Neue Gliederung“ stand in zwei
 * Zeilen) – in der Präsentation fehlte es noch: „Neue Gliederung | Heute“ war dort 41 statt 38 px hoch, zweizeilig
 * (Test-Instanz am iPad-Querformat, 1024 px, 28.10.2026). Diese Prüfung hält es für jede Stelle fest.
 */
function umschalter(): { stelle: string; verbunden: boolean }[] {
  const out: { stelle: string; verbunden: boolean }[] = [];
  for (const datei of dateien('organigramm/src', /\.tsx$/)) {
    if (/\.test\.tsx$/.test(datei)) continue;
    const text = readFileSync(datei, 'utf8');
    for (const m of text.matchAll(/<Segment\b([\s\S]*?)\/>/g)) {
      const zeile = text.slice(0, m.index).split('\n').length;
      out.push({
        stelle: `${relative(WURZEL, datei)}:${zeile}`,
        verbunden: /\bverbunden\b/.test(m[1]),
      });
    }
  }
  return out;
}

describe('Umschalter im Organigramm', () => {
  it('jeder steht auf einer Schiene (`verbunden`)', () => {
    const alle = umschalter();
    // Gegenprobe gegen die Erkennung: Es gibt sie wirklich (Reiter, Präsentation, Bereiche, Plan/Umbau).
    expect(alle.length).toBeGreaterThanOrEqual(5);
    expect(alle.filter((u) => !u.verbunden).map((u) => u.stelle)).toEqual([]);
  });
});
