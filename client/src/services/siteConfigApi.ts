/** API-Aufrufe für das Laufzeit-Branding (White-Label). */
import type { SiteConfig } from '@shared/types/index';
import { apiFetch } from './api';
import { istExtension, ohneServer } from './ctRuntime';
import { gemeindeKonfiguration } from './ctLesen';

export function getSiteConfig(): Promise<SiteConfig> {
  // Extension: kein `site.json` – der Gemeindename kommt aus ChurchTools (`/api/info`, Plan §2a).
  if (istExtension) return gemeindeKonfiguration();
  return apiFetch<SiteConfig>('/api/site-config');
}

export function updateSiteConfig(cfg: SiteConfig): Promise<SiteConfig> {
  if (istExtension) return ohneServer('Das Einstellen der App');
  return apiFetch<SiteConfig>('/api/site-config', {
    method: 'PUT',
    body: JSON.stringify(cfg),
  });
}

interface CtGroup {
  id: number;
  name: string;
}

/** ChurchTools-Gruppen für das Admin-Dropdown „Musiker-Gruppe" (nur Admin). */
export function getGroups(): Promise<CtGroup[]> {
  if (istExtension) return ohneServer('Das Einstellen der App');
  return apiFetch<CtGroup[]>('/api/groups');
}

interface CtRole {
  /** groupTypeRoleId – wird in `noteRoles.view/manage` gespeichert. */
  id: number;
  name: string;
}

/** Rollen einer Gruppe für die „Rollen-Zuweisung" (nur Admin). */
export function getGroupRoles(groupId: number): Promise<CtRole[]> {
  if (istExtension) return ohneServer('Das Einstellen der App');
  return apiFetch<CtRole[]>(`/api/groups/${groupId}/roles`);
}
