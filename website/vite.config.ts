import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { erweiterungsBau } from '../ui/erweiterung/viteErweiterung';

/**
 * Die Website gibt es nur als ChurchTools-Erweiterung (Bauplan Website, kein eigener Server). Gebaut wird mit dem
 * gemeinsamen Erweiterungs-Bau (`/ccm/website/`, Kopf in den Inhalt, Stilregeln nur im App-Bereich, Dateinamen mit
 * Fingerabdruck). Die Tests laufen im Client-Testlauf mit (`client/vitest.config.ts`).
 *
 * Das Stylesheet der Website (`shared/website/website.css`) wird NICHT als CSS importiert, sondern als Text (`?raw`):
 * Es gehört in die Vorschau-Seite, nicht in die Oberfläche der Erweiterung – und der Erweiterungs-Bau schriebe seine
 * Regeln (`:root`, `body` …) sonst auf den App-Bereich um (`cssBereich`).
 */
export default defineConfig(({ mode }) =>
  mergeConfig(
    {
      plugins: [react()],
      resolve: {
        alias: [
          { find: '@shared', replacement: fileURLToPath(new URL('../shared', import.meta.url)) },
          { find: '@ui', replacement: fileURLToPath(new URL('../ui', import.meta.url)) },
        ],
      },
      css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
      server: { port: 5194 },
    },
    erweiterungsBau(mode, 'website'),
  ),
);
