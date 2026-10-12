import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { erweiterungsBau } from '../ui/erweiterung/viteErweiterung';

/**
 * Die Anmeldungen gibt es nur als ChurchTools-Erweiterung (#474) – kein eigener Server, keine PWA.
 * Gebaut wird deshalb immer mit dem gemeinsamen Erweiterungs-Bau (`/ccm/anmeldungen/`, Kopf in den
 * Inhalt, Stilregeln nur im App-Bereich). Die Tests laufen im Client-Testlauf mit
 * (`client/vitest.config.ts`), wie die von `ui/` und `shared/`.
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
      server: { port: 5176 },
    },
    erweiterungsBau(mode, 'anmeldungen'),
  ),
);
