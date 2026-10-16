// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMedienAbfrage } from './useMedienAbfrage';

afterEach(() => vi.unstubAllGlobals());

describe('useMedienAbfrage', () => {
  it('folgt der Abfrage, wenn sie umschlägt, und meldet sich beim Abbauen ab', () => {
    let trifft = false;
    let melde: () => void = () => {};
    const ab = vi.fn();
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() {
        return trifft;
      },
      media: q,
      addEventListener: (_: string, f: () => void) => (melde = f),
      removeEventListener: ab,
    }));
    const { result, unmount } = renderHook(() => useMedienAbfrage('(max-width: 759px)'));
    expect(result.current).toBe(false);
    trifft = true;
    act(() => melde());
    expect(result.current).toBe(true);
    unmount();
    expect(ab).toHaveBeenCalled();
  });

  it('ältere Safari (nur addListener) folgt ebenfalls; ganz ohne Anmelden kein Absturz (A6-2b)', () => {
    let trifft = false;
    let melde: () => void = () => {};
    const ab = vi.fn();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return trifft;
      },
      addListener: (f: () => void) => (melde = f),
      removeListener: ab,
    }));
    const { result, unmount } = renderHook(() => useMedienAbfrage('(pointer: coarse)'));
    trifft = true;
    act(() => melde());
    expect(result.current).toBe(true);
    unmount();
    expect(ab).toHaveBeenCalled();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(renderHook(() => useMedienAbfrage('(pointer: coarse)')).result.current).toBe(true);
  });

  it('ohne matchMedia gilt die Vorgabe', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useMedienAbfrage('(x)', true)).result.current).toBe(true);
    expect(renderHook(() => useMedienAbfrage('(x)')).result.current).toBe(false);
  });
});
