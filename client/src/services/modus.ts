/**
 * Läuft die App als ChurchTools-Extension – und wo ist ChurchTools? (#334, #335)
 *
 * **Die einzige Stelle, die `import.meta.env.MODE` liest.** Bewusst ohne Import aus der App: Auch
 * `reachability.ts` braucht die Antwort, und `api` → `reachability` → `ctRuntime` → `api` wäre ein
 * Kreis, in dem `ApiError` beim Laden noch nicht existiert.
 */
import { kuerzelAusBasis } from '@ui/erweiterung/kuerzel';

/** Läuft dieser Build als ChurchTools-Extension? (`vite build --mode extension`) */
export const istExtension: boolean = import.meta.env.MODE === 'extension';

/** Adresse der ChurchTools-Instanz – die Regel teilen sich alle Erweiterungen (#474). */
export { ctBasis } from '@ui/ct/basis';

/**
 * Das Kürzel der Erweiterung (`/ccm/<Kürzel>/`) – daran findet die App ihr Modul in ChurchTools
 * (`GET /api/custommodules`, Feld `shorty`). Abgelesen an der Bau-Adresse (`vite.config.ts`, `base`),
 * damit es nicht an zwei Stellen steht. `null` außerhalb der Erweiterung.
 */
export function erweiterungsKuerzel(): string | null {
  if (!istExtension) return null;
  return kuerzelAusBasis(import.meta.env.BASE_URL);
}
