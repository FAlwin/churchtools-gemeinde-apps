import { vi } from 'vitest';

/**
 * Der Anschluss an die Personen-Dateien **ohne Netz** – für Tests, die die ganze App zeigen: „Meine Anzeige“ (L4-5) gleicht beim
 * Öffnen mit ChurchTools ab; hier antwortet es nie. Die Wahl bleibt dann im Gerät (das prüft `MeineAnzeigeAnschluss.test.tsx`).
 * Einbinden: `vi.mock('@ui/ct/ablagePort', async () => ({ ablagePort: (await import('./ablageOffline.testutil')).ablagePortOffline }))`.
 */
export const ablagePortOffline = {
  meineId: vi.fn(() => Promise.reject(new Error('offline'))),
  lesen: vi.fn(),
  datei: vi.fn(),
  hochladen: vi.fn(),
  loeschen: vi.fn(),
  fehler: (status: number, meldung: string) => Object.assign(new Error(meldung), { status }),
  istKeinRecht: () => false,
  istNichtGefunden: () => false,
};
