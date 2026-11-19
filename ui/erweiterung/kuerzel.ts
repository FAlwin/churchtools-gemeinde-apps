/**
 * **Das Kürzel einer Erweiterung aus ihrer Bau-Adresse** (`base` = `/ccm/<Kürzel>/`, siehe
 * `viteErweiterung.ts`) – damit es nicht an zwei Stellen steht. Stand bis 14.10.2026 nur in der Musik-App
 * (`client/src/services/modus.ts`); der Dienstplaner braucht es für seinen Speicher (E4-3).
 */
export function kuerzelAusBasis(basis: string): string | null {
  const m = /^\/ccm\/([^/]+)\/$/.exec(basis);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * **Die volle Adresse einer Seite der Erweiterung – für außerhalb** (Mail, Beitrag, Verweis auf eine andere
 * Erweiterung): Instanz + `/ccm/<Kürzel>/` + Adresse in der Erweiterung (`#/sitzungen/…`, `#/abwesenheiten`; leer = die
 * Startseite). **Die eine Stelle dafür** – Protokolle (Beitrag), Dienstplaner (Mail „Erinnern“, Link zur Musik-App) und
 * künftige Mails bauen sie nicht noch einmal nach. `basis` ist die Instanz (`ctBasis()`), ein Schrägstrich am Ende stört nicht.
 */
export function erweiterungsLink(basis: string, kuerzel: string, adresse = ''): string {
  return `${basis.replace(/\/+$/, '')}/ccm/${encodeURIComponent(kuerzel)}/${adresse}`;
}
