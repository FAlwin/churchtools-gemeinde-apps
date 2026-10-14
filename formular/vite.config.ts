import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Das öffentliche Formular (#474) – eine statische Seite, die jede Gemeinde auf ihren eigenen Webspace legt.
 * Relative Pfade (`base: './'`), damit sie auf dem Webspace jeder Gemeinde läuft – in der Wurzel einer Subdomain
 * genauso wie in einem Unterordner (Alwin, 14.10.2026: jede Gemeinde ihre eigene Adresse). Keine Erweiterung, also ohne den
 * Erweiterungs-Bau.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@shared', replacement: fileURLToPath(new URL('../shared', import.meta.url)) },
      { find: '@ui', replacement: fileURLToPath(new URL('../ui', import.meta.url)) },
    ],
  },
  css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  server: { port: 5177 },
});
