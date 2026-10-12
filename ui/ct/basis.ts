/**
 * Wo ist ChurchTools? – für jede Erweiterung dieses Repos (#474, aus `client/src/services/modus.ts`
 * hierher gezogen). Bewusst ohne jeden Import, damit es von überall geladen werden kann.
 */

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
