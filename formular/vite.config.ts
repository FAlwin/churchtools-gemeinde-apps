import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Das öffentliche Formular (#474) – eine statische Seite, die für alle Gemeinden an EINER Adresse liegt
 * (GitHub Pages des Projekts, Bauplan §2). Relative Pfade (`base: './'`), damit sie unter
 * `…github.io/churchtools-gemeinde-apps/` genauso läuft wie lokal. Keine Erweiterung, also ohne den
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
