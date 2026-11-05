import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { erweiterungsBau } from '../ui/erweiterung/viteErweiterung';

/**
 * Den Gebetsabend gibt es nur als ChurchTools-Erweiterung (Bauplan Gebetsabend, kein eigener Server). Gebaut wird mit
 * dem gemeinsamen Erweiterungs-Bau (`/ccm/gebetsabend/`, Kopf in den Inhalt, Stilregeln nur im App-Bereich, Dateinamen
 * mit Fingerabdruck – ChurchTools speichert `/ccm/…` 7 Tage zwischen, Messung S0). Die Tests laufen im
 * Client-Testlauf mit (`client/vitest.config.ts`).
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
      server: { port: 5193 },
    },
    erweiterungsBau(mode, 'gebetsabend'),
  ),
);
