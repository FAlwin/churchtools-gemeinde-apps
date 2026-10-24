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
import { globaleRegeln } from './globaleCss.mjs';

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
 * **Nichts Ladbares im Kopf** (#474): ChurchTools übernimmt nur den Inhalt der `index.html` – ein Skript
 * oder Stylesheet im `<head>` käme nie an, die Erweiterung bliebe leer. Das Plugin `kopfInDenInhalt`
 * (über `ui/erweiterung/viteErweiterung.ts`) verschiebt sie; fehlt es in einer App, bricht es hier ab.
 */
const kopf =
  /<head>([\s\S]*?)<\/head>/.exec(fs.readFileSync(path.join(quelle, 'index.html'), 'utf8'))?.[1] ??
  '';
if (/<script type="module"|<link rel="(?:stylesheet|modulepreload)"/.test(kopf)) {
  console.error(
    'Im <head> des gebauten index.html steht noch ein Skript oder Stylesheet – ChurchTools lädt es nicht.',
  );
  console.error(
    'Fehlt `erweiterungsBau` (ui/erweiterung/viteErweiterung.ts) in der Vite-Konfiguration der App?',
  );
  process.exit(1);
}
/**
 * **Nachsehen statt glauben (07.10.2026):** Im gebauten CSS darf keine Regel mehr auf die ganze Seite
 * zielen (`:root`, `html`, `body`, `*`, nackte Elemente) – sonst verbiegt sie ChurchTools' Menüs.
 * Umgeschrieben wird in `ui/erweiterung/cssBereich.ts`; ein zweiter `css`-Schlüssel in der
 * Vite-Konfiguration hatte das schon einmal still abgeschaltet, bei grünem Build. Deshalb hier am
 * Ergebnis geprüft, und das Packen bricht ab. Die Prüfung selbst steht seit 24.10.2026 in `globaleCss.mjs` (getestet).
 */
const assets = path.join(quelle, 'assets');
const funde = [];
for (const datei of fs.readdirSync(assets).filter((d) => d.endsWith('.css'))) {
  for (const t of globaleRegeln(fs.readFileSync(path.join(assets, datei), 'utf8')))
    funde.push(`${datei}: ${t}`);
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
