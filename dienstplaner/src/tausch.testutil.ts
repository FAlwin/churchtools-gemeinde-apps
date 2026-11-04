import { vi } from 'vitest';
import type { Eingang } from '@shared/dienstplan/tausch';
import type { Tausch } from './useTausch';

/** Ein Tausch-Zustand zum Einstecken in Startseite und „Dienste“ (E7-3) – nichts läuft, kein Stand, Eingang wählbar. */
export function tauschAttrappe(eingang: Eingang[] = []): Tausch {
  return {
    stand: () => null,
    eingang,
    getauscht: [],
    dienstZu: () => 'Gesang',
    laeuft: () => null,
    fehler: () => null,
    kandidaten: vi.fn(() => Promise.resolve([])),
    anfragen: vi.fn(() => Promise.resolve(true)),
    zurueckziehen: vi.fn(() => Promise.resolve()),
    annehmen: vi.fn(() => Promise.resolve()),
    ablehnen: vi.fn(() => Promise.resolve()),
    meldung: null,
  };
}

export const EINE_TAUSCHANFRAGE: Eingang = {
  id: 6,
  von: 'Spike Musiker',
  bekomme: { eventId: 166, termin: 'Messung', beginn: '2027-01-10T09:00:00Z' },
  gebe: { einteilung: 1026, eventId: 163, termin: 'Gottesdienst', beginn: '2026-11-15T09:00:00Z' },
};
