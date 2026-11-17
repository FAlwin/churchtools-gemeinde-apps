// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { isTourDone, markTourDone } from '../utils/onboarding';
import { useTourSobaldDa } from './useTourSobaldDa';

/**
 * Die Einführung startet erst, wenn ihr Ziel da ist, und nur einmal. **Fake-Timer:** Mit echten Timern ließe sich nicht
 * unterscheiden, ob das Suchen läuft oder die Zeit nur vergeht.
 */
const TOUR = 'test-tour-v1';
const SELEKTOR = '[data-tour="test-ziel"]';

function zielAnlegen() {
  const el = document.createElement('div');
  el.dataset.tour = 'test-ziel';
  document.body.appendChild(el);
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useTourSobaldDa', () => {
  it('wartet, bis das Ziel da ist – dann startet sie', () => {
    const { result } = renderHook(() => useTourSobaldDa(TOUR, SELEKTOR));
    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current.aktiv).toBe(false);
    zielAnlegen();
    act(() => void vi.advanceTimersByTime(600));
    expect(result.current.aktiv).toBe(true);
  });

  it('schließen verbucht sie als gesehen und beendet sie', () => {
    zielAnlegen();
    const { result } = renderHook(() => useTourSobaldDa(TOUR, SELEKTOR));
    act(() => void vi.advanceTimersByTime(400));
    expect(result.current.aktiv).toBe(true);
    act(() => result.current.schliessen());
    expect(result.current.aktiv).toBe(false);
    expect(isTourDone(TOUR)).toBe(true);
  });

  it('schon gesehen: startet nie – und sucht gar nicht erst', () => {
    markTourDone(TOUR);
    zielAnlegen();
    const { result } = renderHook(() => useTourSobaldDa(TOUR, SELEKTOR));
    act(() => void vi.advanceTimersByTime(20_000));
    expect(result.current.aktiv).toBe(false);
  });

  it('kommt das Ziel nie (kein Recht, Ladefehler): still – und nicht als gesehen verbucht, sie kommt beim nächsten Mal', () => {
    const { result } = renderHook(() => useTourSobaldDa(TOUR, SELEKTOR));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(result.current.aktiv).toBe(false);
    expect(isTourDone(TOUR)).toBe(false);
    // Die Suche hat aufgehört: Ein spätes Ziel startet sie nicht mehr.
    zielAnlegen();
    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current.aktiv).toBe(false);
  });

  it('wechselt der Schlüssel (Liste ↔ Vorlage), beginnt die Suche von vorn und die alte Einführung endet', () => {
    zielAnlegen();
    const { result, rerender } = renderHook(({ k }) => useTourSobaldDa(TOUR, SELEKTOR, k), {
      initialProps: { k: 'liste' },
    });
    act(() => void vi.advanceTimersByTime(400));
    expect(result.current.aktiv).toBe(true);
    rerender({ k: 'vorlage' });
    expect(result.current.aktiv).toBe(false);
    act(() => void vi.advanceTimersByTime(400));
    expect(result.current.aktiv).toBe(true);
  });
});
