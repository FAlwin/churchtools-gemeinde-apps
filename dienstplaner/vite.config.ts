import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { erweiterungsBau } from '../ui/erweiterung/viteErweiterung';

/**
 * Der Dienstplaner gibt es vorerst nur als ChurchTools-Erweiterung (Bauplan E2, Schwerpunkt Erweiterung;
 * die NAS-App kommt später). Gebaut wird mit dem gemeinsamen Erweiterungs-Bau (`/ccm/dienstplaner/`,
 * Kopf in den Inhalt, Stilregeln nur im App-Bereich). Die Tests laufen im Client-Testlauf mit
 * (`client/vitest.config.ts`), wie die von `ui/`, `shared/` und `anmeldungen/`.
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
      server: { port: 5178 },
    },
    erweiterungsBau(mode, 'dienstplaner'),
  ),
);
