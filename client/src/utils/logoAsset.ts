// App-Logo für die PDF-Kopfzeile der Akkord-Charts. Als Data-URI INLINE ins Bundle gebacken
// (?inline), NICHT als loser public-Pfad: eine lose Datei wird vom Offline-Cache nicht sicher
// getroffen (nur gehashte Bundle-Assets werden präzise precacht) → offline fehlte das Logo (#32).
// Inline = kein Abruf, online wie offline sofort verfügbar. ~16 KB im Bundle (vernachlässigbar).
import type { SiteConfig } from '@shared/types/index';
import logoTightUrl from '../assets/logo-tight.png?inline';

export { logoTightUrl };

/** Lädt das App-Logo als HTMLImageElement (aus der eingebetteten Data-URI → immer verfügbar). */
export function loadAppLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = logoTightUrl;
  });
}

/**
 * **Kommt das Logo aufs Liedblatt?** (Alwin, 19.10.2026: der Admin entscheidet für die Gemeinde.) Die eine
 * Regel für Anzeige, Teilen, Liederheft und Vorschau – fehlt die Einstellung (Bestand, noch nicht geladen),
 * ja.
 */
export function logoZeigen(site: Pick<SiteConfig, 'liedblattLogo'> | undefined): boolean {
  return site?.liedblattLogo !== false;
}
