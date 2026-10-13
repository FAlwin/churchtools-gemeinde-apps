/** API-Aufrufe für das Laufzeit-Branding (White-Label). */
import type { Kalender, SiteConfig } from '@shared/types/index';
import { apiFetch } from './api';
import { istExtension } from './ctRuntime';
import { einstellungenSpeichern } from './ctEinstellungen';
import { gemeindeKonfiguration, gruppen, kalender, rollen } from './ctLesen';
import { teilenEinrichten } from './ctTeilen';

export function getSiteConfig(): Promise<SiteConfig> {
  // Extension: kein `site.json` – Name aus ChurchTools, der Rest aus den Daten der Erweiterung (3b-4).
  if (istExtension) return gemeindeKonfiguration();
  return apiFetch<SiteConfig>('/api/site-config');
}

export async function updateSiteConfig(cfg: SiteConfig): Promise<SiteConfig> {
  if (istExtension) {
    // Gibt es Team-Gruppen, braucht es das Verzeichnis „Wer teilt" – angelegt vom Admin, weil Musiker
    // in ChurchTools meist keine Kategorien anlegen dürfen. VOR dem Speichern: Scheitert es, ist auch
    // nichts gespeichert, und die Meldung sagt, warum (#335, 3b-4b).
    if (cfg.musicianGroupIds.length > 0) await teilenEinrichten();
    return einstellungenSpeichern(cfg);
  }
  return apiFetch<SiteConfig>('/api/site-config', {
    method: 'PUT',
    body: JSON.stringify(cfg),
  });
}

interface CtGroup {
  id: number;
  name: string;
}

/** ChurchTools-Kalender für „Termine ohne Ablauf" (nur Admin, 13.10.2026). */
export function getKalender(): Promise<Kalender[]> {
  if (istExtension) return kalender();
  return apiFetch<Kalender[]>('/api/kalender');
}

/** ChurchTools-Gruppen für das Admin-Dropdown „Musiker-Gruppe" (nur Admin). */
export function getGroups(): Promise<CtGroup[]> {
  if (istExtension) return gruppen();
  return apiFetch<CtGroup[]>('/api/groups');
}

interface CtRole {
  /** groupTypeRoleId – wird in `noteRoles.view/manage` gespeichert. */
  id: number;
  name: string;
}

/** Rollen einer Gruppe für die „Rollen-Zuweisung" (nur Admin). */
export function getGroupRoles(groupId: number): Promise<CtRole[]> {
  if (istExtension) return rollen(groupId);
  return apiFetch<CtRole[]>(`/api/groups/${groupId}/roles`);
}
