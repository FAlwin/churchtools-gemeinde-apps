/**
 * Die Gemeinde-Einstellungen der Server-Variante – in einer `site.json` auf dem Volume, ohne DB.
 * Fehlt die Datei, gelten die Standardwerte.
 *
 * Hier steht nur das Ablegen. Prüfen und Zusammensetzen stehen seit Phase 3b-4 in
 * `@shared/ct/einstellungen`: Die Erweiterung speichert dieselben Einstellungen in ChurchTools und
 * prüft sie mit derselben Regel (#335).
 */
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';
import {
  einstellungenAus,
  einstellungenZusammensetzen,
  type EinstellbareWerte,
} from '@shared/ct/einstellungen';
import { config } from '../config.js';
import { readJsonStore, writeJsonStore } from './jsonStore.js';

let cache: SiteConfig | null = null;

/** Nur für Tests: Zwischenspeicher leeren, damit das Einlesen der Datei geprüft werden kann. */
export function __resetForTests(): void {
  cache = null;
}

/**
 * Aktuelle Konfiguration (gecacht).
 *
 * Defaults gibt es NUR, wenn die Datei fehlt oder inhaltlich nicht zum Schema passt. Ein
 * **Lesefehler** (EACCES/EIO) oder beschädigtes JSON wirft jetzt (#273): Vorher fiel beides auf die
 * Defaults zurück, und das nächste Speichern eines Admins hätte Gemeindename, Links und
 * Gruppen-/Rollen-Zuweisungen durch die Defaults ersetzt.
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (cache) return cache;
  const raw = await readJsonStore<unknown>(config.siteConfigPath, 'Branding-Einstellungen');
  if (raw === null) {
    cache = { ...DEFAULT_SITE_CONFIG };
    return cache;
  }
  // Inhaltlich unpassend (z. B. handgeschriebene Datei) → Defaults, wie bisher.
  cache = einstellungenAus(raw) ?? { ...DEFAULT_SITE_CONFIG };
  return cache;
}

/** Schreibt die Konfiguration atomar (orgName + links + musicianGroupIds) und aktualisiert den Cache. */
export async function saveSiteConfig(
  next: Partial<EinstellbareWerte> & { orgName: string },
): Promise<SiteConfig> {
  const cfg = einstellungenZusammensetzen(next);
  await writeJsonStore(config.siteConfigPath, JSON.stringify(cfg, null, 2));
  cache = cfg; // erst nach erfolgreichem Schreiben (#273)
  return cache;
}
