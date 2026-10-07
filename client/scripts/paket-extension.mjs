#!/usr/bin/env node
/**
 * Packt den Extension-Build als ZIP für ChurchTools (#335): Ordner `dist/` mit dem Inhalt von
 * `dist-extension/` – so nimmt ChurchTools ihn an (gemessen 07.10.2026, Plan §2a). Ergebnis:
 * `client/releases/<VITE_KEY>-<Version>.zip`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quelle = path.join(client, 'dist-extension');
if (!fs.existsSync(path.join(quelle, 'index.html'))) {
  console.error('dist-extension/index.html fehlt – erst `vite build --mode extension`.');
  process.exit(1);
}
/**
 * **Nachsehen statt glauben (07.10.2026):** Im gebauten CSS darf keine Regel mehr auf die ganze Seite
 * zielen (`:root`, `html`, `body`, `*`, nackte Elemente) – sonst verbiegt sie ChurchTools' Menüs.
 * Umgeschrieben wird in `src/buildHilfen/cssBereich.ts`; ein zweiter `css`-Schlüssel in der
 * Vite-Konfiguration hatte das schon einmal still abgeschaltet, bei grünem Build. Deshalb hier am
 * Ergebnis geprüft, und das Packen bricht ab.
 */
const assets = path.join(quelle, 'assets');
const funde = [];
for (const datei of fs.readdirSync(assets).filter((d) => d.endsWith('.css'))) {
  const css = fs
    .readFileSync(path.join(assets, datei), 'utf8')
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  for (const regel of css.match(/[^{}]+\{/g) ?? []) {
    const selektor = regel.slice(0, -1).trim();
    if (selektor.startsWith('@')) continue;
    for (const teil of selektor.split(',')) {
      const t = teil.trim();
      if (t.startsWith('html[data-theme') && t.includes(':is(#root')) continue;
      if (
        /^(:root|html|body|\*|:[a-z-]+|[a-z][a-z0-9]*)(\b|$)/.test(t) &&
        !t.startsWith(':is(#root')
      ) {
        funde.push(`${datei}: ${t}`);
      }
    }
  }
}
if (funde.length > 0) {
  console.error('Globale CSS-Regeln im Extension-Build (würden ChurchTools verändern):');
  for (const f of funde.slice(0, 10)) console.error(`  ${f}`);
  process.exit(1);
}

const kuerzel = process.env.VITE_KEY || 'musik-app';
const version = (process.env.VITE_APP_VERSION || 'dev').replace(/[^\w.-]/g, '');
const ziel = path.join(client, 'releases', `${kuerzel}-${version}.zip`);
fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.rmSync(ziel, { force: true });

// In einem Zwischenordner als `dist/` ablegen, damit der ZIP genau diesen Ordner enthält.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-extension-'));
try {
  fs.cpSync(quelle, path.join(tmp, 'dist'), { recursive: true });
  execFileSync('zip', ['-qr', ziel, 'dist', '-x', '*.map', '*.DS_Store'], { cwd: tmp });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`ChurchTools-Extension gepackt: ${path.relative(client, ziel)}`);
