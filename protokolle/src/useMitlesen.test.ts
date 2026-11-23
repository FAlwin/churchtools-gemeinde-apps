// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MITLESEN_MS, useMitlesen } from './useMitlesen';

/** Mitlesen (W16): Takt, Pause bei verdecktem Fenster, kein zweiter Abruf, solange einer läuft – mit Fake-Timern. */
let verdeckt = false;
beforeEach(() => {
  vi.useFakeTimers();
  verdeckt = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => verdeckt });
});
afterEach(() => {
  vi.useRealTimers();
});

const sichtbarkeit = (hidden: boolean) => {
  verdeckt = hidden;
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useMitlesen', () => {
  it('liest alle 10 Sekunden, solange es aktiv ist', async () => {
    expect(MITLESEN_MS).toBe(10_000);
    const lesen = vi.fn(() => Promise.resolve());
    renderHook(() => useMitlesen(true, lesen));
    expect(lesen).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(MITLESEN_MS - 1);
    expect(lesen).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(lesen).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(MITLESEN_MS * 2);
    expect(lesen).toHaveBeenCalledTimes(3);
  });

  it('liest nicht, wenn es nicht aktiv ist (man schreibt selbst, oder das Protokoll ist freigegeben)', async () => {
    const lesen = vi.fn(() => Promise.resolve());
    const { rerender } = renderHook(({ aktiv }) => useMitlesen(aktiv, lesen), {
      initialProps: { aktiv: false },
    });
    await vi.advanceTimersByTimeAsync(MITLESEN_MS * 3);
    expect(lesen).not.toHaveBeenCalled();
    rerender({ aktiv: true });
    await vi.advanceTimersByTimeAsync(MITLESEN_MS);
    expect(lesen).toHaveBeenCalledTimes(1);
    rerender({ aktiv: false });
    await vi.advanceTimersByTimeAsync(MITLESEN_MS * 3);
    expect(lesen).toHaveBeenCalledTimes(1);
  });

  it('pausiert, solange das Fenster verdeckt ist – und liest beim Zurückkommen sofort', async () => {
    const lesen = vi.fn(() => Promise.resolve());
    renderHook(() => useMitlesen(true, lesen));
    sichtbarkeit(true);
    await vi.advanceTimersByTimeAsync(MITLESEN_MS * 5);
    expect(lesen).not.toHaveBeenCalled();
    sichtbarkeit(false);
    expect(lesen).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(MITLESEN_MS);
    expect(lesen).toHaveBeenCalledTimes(2);
  });

  it('startet gar nicht erst, wenn das Fenster beim Öffnen verdeckt ist', async () => {
    verdeckt = true;
    const lesen = vi.fn(() => Promise.resolve());
    renderHook(() => useMitlesen(true, lesen));
    await vi.advanceTimersByTimeAsync(MITLESEN_MS * 3);
    expect(lesen).not.toHaveBeenCalled();
  });

  it('kein zweiter Abruf, solange einer noch läuft; ein Fehler hält den Takt nicht an', async () => {
    let fertig: (() => void) | null = null;
    const lesen = vi
      .fn<() => Promise<unknown>>()
      .mockImplementationOnce(() => new Promise<void>((r) => (fertig = r)))
      .mockImplementationOnce(() => Promise.reject(new Error('weg')))
      .mockImplementation(() => Promise.resolve());
    renderHook(() => useMitlesen(true, lesen));
    await vi.advanceTimersByTimeAsync(MITLESEN_MS * 3);
    expect(lesen).toHaveBeenCalledTimes(1);
    fertig!();
    await vi.advanceTimersByTimeAsync(MITLESEN_MS);
    expect(lesen).toHaveBeenCalledTimes(2); // dieser scheitert
    await vi.advanceTimersByTimeAsync(MITLESEN_MS);
    expect(lesen).toHaveBeenCalledTimes(3);
  });

  it('räumt beim Verlassen auf – kein Takt und kein Hörer bleibt zurück', async () => {
    const lesen = vi.fn(() => Promise.resolve());
    const { unmount } = renderHook(() => useMitlesen(true, lesen));
    unmount();
    await vi.advanceTimersByTimeAsync(MITLESEN_MS * 3);
    sichtbarkeit(false);
    expect(lesen).not.toHaveBeenCalled();
  });
});
