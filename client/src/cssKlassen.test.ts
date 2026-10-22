import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * **Jede benutzte CSS-Klasse muss es geben** (13.10.2026).
 *
 * Eine Klasse aus einem CSS-Modul, die in der Stildatei fehlt, ergibt `undefined` – kein Build, kein
 * Lint und kein Test merkt es, das Element steht einfach ungestylt da. So passiert beim Zusammenführen:
 * Die Terminliste zog ihre Datumskachel nach `ui/bedienung/DatumKachel` um und nahm `.dateBadge`,
 * `.day`, `.month` mit; die gleichzeitig gebaute Zeile „Kein Ablauf" benutzte sie weiter.
 *
 * Geprüft wird jede Datei der Apps und von `ui/`: `import x from '….module.scss'` und jede Nutzung
 * `x.name` bzw. `x['name']`. Dynamische Zugriffe (`x[variable]`) prüft der Test nicht.
 */
const WURZEL = resolve(__dirname, '../..');
const ORDNER = ['client/src', 'ui', 'dienstplaner/src', 'anmeldungen/src', 'sitzungen/src'];

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    if (n === 'node_modules' || n === 'dist') return [];
    if (statSync(p).isDirectory()) return dateien(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

/** Alle Klassennamen einer SCSS-Datei (großzügig: auch in Verschachtelungen und `:has()`). */
function klassen(scss: string): Set<string> {
  const ohneKommentare = scss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return new Set([...ohneKommentare.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]));
}

function pfadZu(datei: string, modul: string): string {
  if (modul.startsWith('@ui/')) return join(WURZEL, 'ui', modul.slice(4));
  return resolve(dirname(datei), modul);
}

function fehlende(): string[] {
  const funde: string[] = [];
  for (const ordner of ORDNER) {
    for (const datei of dateien(join(WURZEL, ordner))) {
      const text = readFileSync(datei, 'utf8');
      for (const imp of text.matchAll(/import (\w+) from '([^']+\.module\.scss)';/g)) {
        const [, name, modul] = imp;
        const vorhanden = klassen(readFileSync(pfadZu(datei, modul), 'utf8'));
        const nutzungen = [
          ...text.matchAll(new RegExp(`\\b${name}\\.([A-Za-z_]\\w*)`, 'g')),
          ...text.matchAll(new RegExp(`\\b${name}\\[['"]([\\w-]+)['"]\\]`, 'g')),
        ].map((m) => m[1]);
        for (const k of new Set(nutzungen)) {
          if (!vorhanden.has(k)) funde.push(`${datei.slice(WURZEL.length + 1)}: ${name}.${k}`);
        }
      }
    }
  }
  return funde;
}

describe('CSS-Module', () => {
  it('jede benutzte Klasse steht in ihrer Stildatei', () => {
    expect(fehlende()).toEqual([]);
  });

  it('der Test findet überhaupt etwas (sonst wäre er leer grün)', () => {
    const scss = klassen('.a { .b, &.c {} } // .kommentar\n/* .auch */ .d:has(.e) {}');
    expect([...scss].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
