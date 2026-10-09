/**
 * Woher die App erfährt, dass es eine neuere Version gibt – **einzige Quelle für Server UND
 * ChurchTools-Extension** (#337).
 *
 * Der Server fragt GitHub einmal für alle Geräte (`server/src/services/updateCheck.ts`); die Extension
 * hat keinen Server und fragt selbst (`client/src/services/updateApi.ts`). Gelesen wird die Antwort
 * hier, damit beide dasselbe daraus machen.
 */
import type { UpdateInfo } from '../types/index';

/** Das öffentliche Repo, dessen Releases die Versionen sind. */
export const RELEASE_REPO = 'FAlwin/churchtools-gemeinde-apps';

/** Die GitHub-Adresse für „neuestes veröffentlichtes Release" (ohne Vorabversionen). */
export const RELEASE_API_URL = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;

/** „Kein Hinweis" – bei Fehlern, ohne Release, offline. */
export const KEIN_UPDATE: UpdateInfo = { latest: null, tag: null, url: null };

/** Die GitHub-Antwort lesen: Tag `v2.3.0` → Version `2.3.0`, dazu der Link zur Release-Seite. */
export function updateInfoAus(json: { tag_name?: string; html_url?: string }): UpdateInfo {
  const tag = json.tag_name ?? null;
  return { latest: tag ? tag.replace(/^v/, '') : null, tag, url: json.html_url ?? null };
}
