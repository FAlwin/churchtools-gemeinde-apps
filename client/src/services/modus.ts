/**
 * Läuft die App als ChurchTools-Extension – und wo ist ChurchTools? (#334, #335)
 *
 * **Die einzige Stelle, die `import.meta.env.MODE` liest.** Bewusst ohne jeden Import: Auch
 * `reachability.ts` braucht die Antwort, und `api` → `reachability` → `ctRuntime` → `api` wäre ein
 * Kreis, in dem `ApiError` beim Laden noch nicht existiert.
 */

/** Läuft dieser Build als ChurchTools-Extension? (`vite build --mode extension`) */
export const istExtension: boolean = import.meta.env.MODE === 'extension';

declare global {
  interface Window {
    /** Setzt ChurchTools auf seinen Extension-Seiten (gemessen 07.10.2026: `https://<instanz>/`). */
    settings?: { base_url?: string };
  }
}

/** Adresse der ChurchTools-Instanz, ohne abschließenden Schrägstrich. */
export function ctBasis(): string {
  const url = window.settings?.base_url ?? window.location.origin;
  return url.replace(/\/+$/, '');
}

/**
 * Das Kürzel der Erweiterung (`/ccm/<Kürzel>/`) – daran findet die App ihr Modul in ChurchTools
 * (`GET /api/custommodules`, Feld `shorty`). Abgelesen an der Bau-Adresse (`vite.config.ts`, `base`),
 * damit es nicht an zwei Stellen steht. `null` außerhalb der Erweiterung.
 */
export function erweiterungsKuerzel(): string | null {
  if (!istExtension) return null;
  const m = /^\/ccm\/([^/]+)\/$/.exec(import.meta.env.BASE_URL);
  return m ? decodeURIComponent(m[1]) : null;
}
