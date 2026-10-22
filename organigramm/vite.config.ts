import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { erweiterungsBau } from '../ui/erweiterung/viteErweiterung';

/**
 * Das Organigramm gibt es nur als ChurchTools-Erweiterung (Bauplan Organigramm, Entscheidung 22.10.2026: keine
 * NAS-App). Gebaut wird mit dem gemeinsamen Erweiterungs-Bau (`/ccm/organigramm/`, Kopf in den Inhalt,
 * Stilregeln nur im App-Bereich). Die Tests laufen im Client-Testlauf mit (`client/vitest.config.ts`).
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
      server: { port: 5191 },
    },
    erweiterungsBau(mode, 'organigramm'),
  ),
);
