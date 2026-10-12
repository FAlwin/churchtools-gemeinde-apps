#!/usr/bin/env node
/**
 * Packt den Extension-Build als ZIP für ChurchTools (#335): Ordner `dist/` mit dem Inhalt von
 * `dist-extension/` – so nimmt ChurchTools ihn an (gemessen 07.10.2026, Plan §2a). Ergebnis:
 * `<App>/releases/<Kürzel>-<Version>.zip`.
 *
 * **Für jede Erweiterung dieses Repos** (#474, vorher `client/scripts/paket-extension.mjs`): Aufgerufen
 * im Ordner der App (`node ../scripts/paket-erweiterung.mjs`, npm setzt ihn bei `-w <app>`). Das
 * Kürzel wird aus dem gebauten `index.html` abgelesen (`/ccm/<Kürzel>/`, gesetzt über `base` in der
 * Vite-Konfiguration der App) – damit steht es nicht ein zweites Mal hier.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const app = process.cwd();
const quelle = path.join(app, 'dist-extension');
if (!fs.existsSync(path.join(quelle, 'index.html'))) {
  console.error(
    `${path.basename(app)}/dist-extension/index.html fehlt – erst \`vite build --mode extension\`.`,
  );
  process.exit(1);
}
const kuerzelFund = /["']\/ccm\/([^/"']+)\//.exec(
  fs.readFileSync(path.join(quelle, 'index.html'), 'utf8'),
);
if (!kuerzelFund) {
  console.error('Im gebauten index.html steht kein Pfad /ccm/<Kürzel>/ – ist `base` gesetzt?');
  process.exit(1);
}
const kuerzel = kuerzelFund[1];
/**
 * **Nachsehen statt glauben (07.10.2026):** Im gebauten CSS darf keine Regel mehr auf die ganze Seite
 * zielen (`:root`, `html`, `body`, `*`, nackte Elemente) – sonst verbiegt sie ChurchTools' Menüs.
 * Umgeschrieben wird in `ui/erweiterung/cssBereich.ts`; ein zweiter `css`-Schlüssel in der
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
      if (t.startsWith('html[data-theme') && t.includes(':where(#root')) continue;
      // Erlaubt: der App-Bereich (`:where(#root…`) und unsere Elemente außerhalb davon
      // (`:where([data-gemeinde-app])`, die Schrift des Einführungs-Overlays) – beide treffen ChurchTools nicht.
      if (
        /^(:root|html|body|\*|:[a-z-]+|[a-z][a-z0-9]*)(\b|$)/.test(t) &&
        !t.startsWith(':where(#root') &&
        // `BEREICH_ATTRIBUT` aus cssBereich.ts – ändert es sich dort, bricht das Packen hier laut ab.
        !t.startsWith(':where([data-gemeinde-app])')
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

const version = (process.env.VITE_APP_VERSION || 'dev').replace(/[^\w.-]/g, '');
const ziel = path.join(app, 'releases', `${kuerzel}-${version}.zip`);
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
console.log(`ChurchTools-Extension gepackt: ${path.relative(app, ziel)}`);
