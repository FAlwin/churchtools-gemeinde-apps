/**
 * **Das Kürzel einer Erweiterung aus ihrer Bau-Adresse** (`base` = `/ccm/<Kürzel>/`, siehe
 * `viteErweiterung.ts`) – damit es nicht an zwei Stellen steht. Stand bis 14.10.2026 nur in der Musik-App
 * (`client/src/services/modus.ts`); der Dienstplaner braucht es für seinen Speicher (E4-3).
 */
export function kuerzelAusBasis(basis: string): string | null {
  const m = /^\/ccm\/([^/]+)\/$/.exec(basis);
  return m ? decodeURIComponent(m[1]) : null;
}
