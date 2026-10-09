import { lokalSchreiben } from '../utils/lokalSpeicher';
// Einstellung „kommende Gottesdienste automatisch offline halten" (Default: an). In localStorage,
// damit sie ohne Server auskommt und offline lesbar ist.
const KEY = 'worship:offline-auto';

export function isOfflineAutoEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function setOfflineAutoEnabled(on: boolean): void {
  lokalSchreiben(KEY, on ? '1' : '0');
}
