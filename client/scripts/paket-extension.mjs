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
