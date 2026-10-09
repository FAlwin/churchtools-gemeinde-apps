import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { cssBereich } from './src/buildHilfen/cssBereich';

/**
 * ChurchTools übernimmt von unserer `index.html` nur den **Inhalt** in die eigene Seite – der Kopf
 * mit `<script>` und `<link rel="stylesheet">` fällt weg (gemessen 07.10.2026, Plan §2a). Im
 * Extension-Build wandern sie deshalb ans Ende des Inhalts. Die Pfade sind über `base` ohnehin
 * absolut (`/ccm/<Kürzel>/…`) – relative zeigten wegen ChurchTools' `<base href>` ins Leere.
 */
function kopfInDenInhalt(): Plugin {
  return {
    name: 'ct-extension-kopf-in-den-inhalt',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const tags: string[] = [];
        const ohne = html.replace(
          /<head>([\s\S]*?)<\/head>/,
          (_m, kopf: string) =>
            `<head>${kopf.replace(
              /<script type="module"[^>]*><\/script>|<link rel="(?:stylesheet|modulepreload)"[^>]*>/g,
              (tag) => {
                tags.push(tag);
                return '';
              },
            )}</head>`,
        );
        // Inline-Skripte (der Start-Hinweis) verbietet die CSP von ChurchTools ohnehin – raus damit,
        // statt bei jedem Öffnen eine Fehlermeldung in der Konsole zu erzeugen.
        const ohneInline = ohne.replace(/<script>[\s\S]*?<\/script>/g, '');
        return ohneInline.replace('</body>', `${tags.join('\n')}\n</body>`);
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  /**
   * Zwei Auslieferungen aus einem Repo (Plan §4): `vite build` = PWA für den eigenen Server,
   * `vite build --mode extension` = ChurchTools-Extension unter `/ccm/<VITE_KEY>/`.
   */
  const istExtension = mode === 'extension';
  const kuerzel = loadEnv(mode, process.cwd(), '').VITE_KEY || 'musik-app';
  return {
    base: istExtension ? `/ccm/${kuerzel}/` : '/',
    resolve: {
      alias: [
        // geteilte Typen: @shared/... -> ../shared/...
        { find: '@shared', replacement: fileURLToPath(new URL('../shared', import.meta.url)) },
        // gemeinsame Oberflächen-Bausteine beider Apps (Design, Icons …): @ui/... -> ../ui/...
        // Dieselben Aliase stehen in vitest.config.ts und tsconfig.json – alle drei gleich halten.
        { find: '@ui', replacement: fileURLToPath(new URL('../ui', import.meta.url)) },
        ...(istExtension
          ? [
              // Extension: kein Service Worker (Plan §6) – der Update-Hook bekommt einen Ersatz.
              {
                find: 'virtual:pwa-register/react',
                replacement: fileURLToPath(new URL('./src/services/swOhne.ts', import.meta.url)),
              },
              // pdf.js-Worker als eigene Datei statt inline – ChurchTools verbietet Worker aus
              // `blob:` (pdfSetup.ts, #335).
              {
                find: /^\.\/pdfWorker$/,
                replacement: fileURLToPath(new URL('./src/pdfWorkerDatei.ts', import.meta.url)),
              },
            ]
          : []),
      ],
    },
    build: istExtension ? { outDir: 'dist-extension', emptyOutDir: true } : undefined,
    plugins: [
      react(),
      ...(istExtension
        ? [kopfInDenInhalt()]
        : [
            VitePWA({
              // 'prompt' statt 'autoUpdate': ein neuer Service Worker lädt die laufende App NICHT
              // automatisch mitten im Betrieb neu (störend im Gottesdienst). Updates kommen über den
              // Hinweis-Balken (useSwUpdate) bzw. beim nächsten Kaltstart. (Bewusste Entscheidung aus
              // v2.5.0 – NICHT wieder auf autoUpdate stellen.)
              registerType: 'prompt',
              includeAssets: ['favicon.ico', 'logo.png'],
              // Manifest wird zur Laufzeit vom Server geliefert (/api/manifest.webmanifest,
              // gebrandet pro Gemeinde). Das Plugin generiert daher KEIN statisches Manifest;
              // der <link rel="manifest"> steht fest in index.html.
              manifest: false,
              workbox: {
                // Neuer Service Worker aktiviert sich SOFORT (kein „wartender SW"), statt bis zum manuellen
                // Umschalten zu warten. Genau dieser Schwebezustand ließ die PWA auf iOS beim Kaltstart
                // OHNE Netz weiß bleiben: der wartende SW übernahm die Navigation nicht → Shell kam nicht aus
                // dem Cache. skipWaiting+clientsClaim beseitigt das; cleanupOutdatedCaches räumt alte
                // Precaches auf. Es wird KEIN automatischer Reload ausgelöst (registerType bleibt 'prompt') →
                // die laufende App lädt nie ungefragt mitten im Gottesdienst neu. (#32)
                skipWaiting: true,
                clientsClaim: true,
                cleanupOutdatedCaches: true,
                // Precache MUSS `.mjs` (+ Fonts/wasm) einschließen – sonst fehlt offline der pdf.js-Worker
                // (pdf.worker.min.mjs) und das Rendern der Charts scheitert mit „fake worker failed" (#32).
                globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff,woff2,wasm}'],
                // pdf.js-Chunks sind groß → Precache-Grenze anheben (Default 2 MiB).
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
                // Offline-Reserve (#32): hochgeladene Dokumente (PDF/Bild) laufzeit-cachen. Ihr Inhalt ist
                // pro fileId unveränderlich (Bearbeiten erzeugt neue Dateien) → CacheFirst. Die Daten-APIs
                // (Termine/Ablauf/ChordPro) werden NICHT hier, sondern über die React-Query-Persistenz
                // (IndexedDB) offline gehalten.
                runtimeCaching: [
                  {
                    urlPattern: /\/api\/songs\/\d+\/files\/\d+/,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'worship-files',
                      expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
                      cacheableResponse: { statuses: [200] },
                    },
                  },
                ],
              },
            }),
          ]),
    ],
    // Moderne Sass-API verwenden (vermeidet die „legacy-js-api"-Deprecation-Warnung)
    css: {
      preprocessorOptions: {
        scss: { api: 'modern-compiler' },
      },
      // Extension: globale Stilregeln nur im App-Bereich – sonst verbiegen sie ChurchTools
      // (07.10.2026, `src/buildHilfen/cssBereich.ts`). Die PWA bleibt unberührt.
      ...(istExtension ? { postcss: { plugins: [cssBereich()] } } : {}),
    },
    server: {
      port: 5173,
      // host: true -> auch im WLAN erreichbar (zum Testen auf Handy/Tablet)
      host: true,
      // Proxy: API-Aufrufe im Dev an das Express-Backend weiterreichen
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
