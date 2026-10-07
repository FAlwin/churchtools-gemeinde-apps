/** Fragt das Backend nach der neuesten veröffentlichten Version (für den Update-Hinweis). */
import type { UpdateInfo } from '@shared/types/index';
import { apiFetch } from './api';
import { istExtension } from './ctRuntime';

export function getUpdateInfo(): Promise<UpdateInfo> {
  // Extension: Die Version liefert ChurchTools mit dem Paket – es gibt nichts zu melden (Plan §6).
  if (istExtension) return Promise.resolve({ latest: null, tag: null, url: null });
  return apiFetch<UpdateInfo>('/api/update-check');
}
