// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTermineFilter, setTermineFilter } from './devicePrefs';
import { clearDeviceData } from './clearDeviceData';

/** Filter der Terminliste (05.11.2026): auf dem Gerät gemerkt, nicht im Konto (Entscheidung Alwin). */
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Filter der Terminliste', () => {
  it('nichts gemerkt → null (dann gilt der Startwert)', () => {
    expect(getTermineFilter()).toBeNull();
  });

  it('merkt sich ausgeblendete Kalender und „auch ohne Ablauf“', () => {
    setTermineFilter({ aus: [7], ohneAblauf: [2, 5] });
    expect(getTermineFilter()).toEqual({ aus: [7], ohneAblauf: [2, 5] });
  });

  it('kaputter Wert → null, kein Fehler', () => {
    localStorage.setItem('worship:termine-filter', '{kaputt');
    expect(getTermineFilter()).toBeNull();
    localStorage.setItem('worship:termine-filter', '"text"');
    expect(getTermineFilter()).toBeNull();
  });

  it('übersteht das Abmelden – eine Vorliebe des Geräts', async () => {
    setTermineFilter({ aus: [7], ohneAblauf: [] });
    await clearDeviceData();
    expect(getTermineFilter()).toEqual({ aus: [7], ohneAblauf: [] });
  });
});
