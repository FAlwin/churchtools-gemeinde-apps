import { loadEnv, type UserConfig } from 'vite';
import { cssBereich } from './cssBereich';
import { kopfInDenInhalt } from './kopfInDenInhalt';

/**
 * **Was jede ChurchTools-Erweiterung dieses Repos beim Bauen braucht** (#474) – an einer Stelle, damit
 * keine App eine Lehre vergisst (gemessen 07.10.2026, Plan `docs/entwicklung/plan-extension.md` §2a):
 *
 * - `base` = `/ccm/<Kürzel>/`: ChurchTools setzt `<base href>` auf die Instanz, relative Pfade zeigten
 *   ins Leere. Aus genau diesem Pfad liest `scripts/paket-erweiterung.mjs` das Kürzel wieder ab.
 * - eigener Ausgabeordner `dist-extension/` (den packt das Skript),
 * - `kopfInDenInhalt`: ChurchTools übernimmt nur den Inhalt der `index.html`,
 * - `cssBereich`: unsere globalen Stilregeln dürfen ChurchTools nicht treffen. **Nur EIN `css`-Schlüssel**
 *   – ein zweiter hatte das schon einmal still abgeschaltet; deshalb wird dies hier mit `mergeConfig`
 *   in die App-Konfiguration gemischt, nicht daneben geschrieben.
 *
 * Das Kürzel kommt aus `VITE_KEY` (Release: fest), sonst gilt `standardKuerzel`.
 */
export function erweiterungsBau(mode: string, standardKuerzel: string): UserConfig {
  const kuerzel = loadEnv(mode, process.cwd(), '').VITE_KEY || standardKuerzel;
  return {
    base: `/ccm/${kuerzel}/`,
    build: { outDir: 'dist-extension', emptyOutDir: true },
    plugins: [kopfInDenInhalt()],
    css: { postcss: { plugins: [cssBereich()] } },
  };
}
