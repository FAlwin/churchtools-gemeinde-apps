/** Fragt das Backend nach der neuesten veröffentlichten Version (für den Update-Hinweis). */
import type { UpdateInfo } from '@shared/types/index';
import { apiFetch } from './api';
import { istExtension } from './ctRuntime';
import { KEIN_UPDATE, RELEASE_API_URL, updateInfoAus } from '@shared/update/index';

export function getUpdateInfo(): Promise<UpdateInfo> {
  if (istExtension) return neuesteVersionVonGitHub();
  return apiFetch<UpdateInfo>('/api/update-check');
}

/**
 * Extension (#337, Alwin am 07.10.2026): Es gibt keinen Server, der für alle Geräte fragt – also fragt
 * der Browser GitHub selbst. Die Sicherheitsregeln von ChurchTools erlauben das (`connect-src *`). Wie
 * oft, regelt `useUpdateCheck` (höchstens alle 6 Stunden je Gerät – weit unter GitHubs 60/Stunde).
 * Jeder Fehler heißt schlicht „kein Hinweis"; ein Update-Hinweis ist kein Grund für eine Fehlermeldung.
 */
async function neuesteVersionVonGitHub(): Promise<UpdateInfo> {
  try {
    const res = await fetch(RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return KEIN_UPDATE;
    return updateInfoAus((await res.json()) as { tag_name?: string; html_url?: string });
  } catch {
    return KEIN_UPDATE;
  }
}
