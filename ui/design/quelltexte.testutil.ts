import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Die Quelltexte aller Apps für Dauerprüfungen (feste Werte, Behelfszeichen) – EINE Stelle, damit eine neue
 * Prüfung nicht ihre eigene Liste der Ordner führt und eine neue App vergisst.
 */
export const WURZEL = fileURLToPath(new URL('../..', import.meta.url));
// Alle Apps aus den Workspaces des Repos (+ ui/) – eine neue App ist so automatisch dabei, ohne dass jemand diese
// Liste nachziehen muss (am 22.10.2026 kam „Protokolle“ parallel dazu und wäre sonst ungeprüft geblieben).
const WORKSPACES = (
  JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')) as { workspaces: string[] }
).workspaces;
export const ORDNER = [...WORKSPACES.map((w) => `${w}/src`), 'ui'];

export function dateien(ordner: string, endungen: RegExp): string[] {
  const voll = join(WURZEL, ordner);
  if (!existsSync(voll)) return [];
  const out: string[] = [];
  const lauf = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        if (name !== 'node_modules' && name !== 'dist' && !name.startsWith('dist-')) lauf(p);
      } else if (endungen.test(name)) out.push(p);
    }
  };
  lauf(voll);
  return out;
}
