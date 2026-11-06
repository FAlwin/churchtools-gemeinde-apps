import { execFileSync } from 'node:child_process';
import { relative, isAbsolute } from 'node:path';

/**
 * **Fremde Dev-Server vor dem E2E-Lauf erkennen.** Lokal übernimmt Playwright einen Server, der schon auf seinem Port
 * läuft (`reuseExistingServer`) – auch den einer anderen Arbeitskopie. Dann testet der Lauf still fremden Code (am
 * 06.11.2026 zweimal passiert, aufgefallen nur durch `lsof`). Diese Prüfung fragt je Port, aus welchem Ordner der
 * Server läuft: aus dieser Arbeitskopie → weiter mitbenutzen wie bisher; aus einer anderen → laut abbrechen.
 */

/**
 * Welche der belegten Ports gehören NICHT zu `wurzel`? Ein Ordner, der sich nicht lesen ließ (`null`, etwa ein Prozess
 * eines anderen Nutzers), zählt als fremd – lieber laut als still.
 *
 * @param {{ port: number; ordner: string | null }[]} belegt
 * @param {string} wurzel
 * @returns {{ port: number; ordner: string | null }[]}
 */
export function fremdeAus(belegt, wurzel) {
  return belegt.filter(({ ordner }) => {
    if (ordner === null) return true;
    const weg = relative(wurzel, ordner);
    return weg.startsWith('..') || isAbsolute(weg);
  });
}

/**
 * Wer lauscht auf den Ports, und aus welchem Ordner? Über `lsof` (macOS, Linux). `null` = `lsof` fehlt, es lässt sich
 * nicht prüfen.
 *
 * @param {number[]} ports
 * @param {(befehl: string, args: string[]) => string} [lsof]
 * @returns {{ port: number; ordner: string | null }[] | null}
 */
export function belegtAuf(
  ports,
  lsof = (befehl, args) => execFileSync(befehl, args, { encoding: 'utf8' }),
) {
  /** @type {{ port: number; ordner: string | null }[]} */
  const belegt = [];
  for (const port of ports) {
    let pids;
    try {
      pids = lsof('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
        .split('\n')
        .filter(Boolean);
    } catch (e) {
      if (/** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT') return null;
      // `lsof` endet mit 1, wenn niemand lauscht – der Port ist frei.
      continue;
    }
    for (const pid of new Set(pids)) {
      let ordner = null;
      try {
        const zeile = lsof('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'])
          .split('\n')
          .find((z) => z.startsWith('n'));
        ordner = zeile ? zeile.slice(1) : null;
      } catch {
        ordner = null;
      }
      belegt.push({ port, ordner });
    }
  }
  return belegt;
}

/**
 * Bricht ab, wenn auf einem der Ports ein Server aus einem anderen Ordner läuft – mit Port und Ordner in der Meldung.
 *
 * @param {number[]} ports
 * @param {string} wurzel
 * @param {(befehl: string, args: string[]) => string} [lsof]
 */
export function pruefeFremdeServer(ports, wurzel, lsof) {
  const belegt = belegtAuf(ports, lsof);
  if (belegt === null) {
    console.warn('[e2e] `lsof` fehlt – ob auf den Ports fremde Dev-Server laufen, ist ungeprüft.');
    return;
  }
  // `wurzel` ist `__dirname` – Node nennt dort schon den echten Pfad wie `lsof` (auch über einen Symlink, geprüft).
  const fremd = fremdeAus(belegt, wurzel);
  if (fremd.length === 0) return;
  const liste = fremd
    .map(({ port, ordner }) => `  Port ${port}: ${ordner ?? '(Ordner nicht lesbar)'}`)
    .join('\n');
  throw new Error(
    `E2E abgebrochen: Auf diesen Ports läuft ein Server aus einem anderen Ordner als ${wurzel}:\n${liste}\n` +
      'Playwright würde ihn still mittesten. Warte, bis der andere Lauf fertig ist, oder stoppe den Server.',
  );
}
