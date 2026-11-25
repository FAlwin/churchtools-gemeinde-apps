import { vi } from 'vitest';
import type { TauschPort } from '@shared/dienstplan/tausch';

/**
 * Der Tausch-Anschluss **ohne Netz** – für alle Tests, die die App oder die Startseite zeigen. `useTausch` lädt beim Öffnen
 * Einteilungen und Eingang über `./tauschPort`; der echte Port ginge übers Netz, scheiterte („fetch failed“) und warnte
 * manchmal erst, wenn die Testumgebung schon geschlossen war (`EnvironmentTeardownError`, CI auf main rot). Hier antwortet
 * er sofort mit leeren Listen. Eingebunden ist er für den ganzen Testlauf in `client/src/test-setup.ts`; wer den Port
 * bewusst prüft, setzt in seiner Datei ein eigenes `vi.mock('./tauschPort', …)` (das gewinnt, siehe `MeineTeilen.test.tsx`).
 */
export const tauschPortOffline: TauschPort = {
  einteilungen: vi.fn(() => Promise.resolve([])),
  kandidaten: vi.fn(() => Promise.resolve([])),
  ausgang: vi.fn(() => Promise.resolve([])),
  eingang: vi.fn(() => Promise.resolve([])),
  anfragen: vi.fn(() => Promise.reject(new Error('offline'))),
  zurueckziehen: vi.fn(() => Promise.reject(new Error('offline'))),
  annehmen: vi.fn(() => Promise.reject(new Error('offline'))),
  ablehnen: vi.fn(() => Promise.reject(new Error('offline'))),
};
