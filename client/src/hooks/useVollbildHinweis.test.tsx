// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVollbildHinweis } from './useVollbildHinweis';
import { HINT_VOLLBILD_KNOPF, isTourDone } from '../utils/onboarding';

/** Der einmalige Hinweis auf den Vollbild-Knopf (v2.32.0, Release-Routine Schritt 2). */
beforeEach(() => localStorage.clear());

describe('useVollbildHinweis', () => {
  it('erscheint genau einmal, sobald die App bereit ist', () => {
    const toast = vi.fn();
    const { rerender } = renderHook(({ b }) => useVollbildHinweis(b, toast), {
      initialProps: { b: false },
    });
    expect(toast).not.toHaveBeenCalled();
    rerender({ b: true });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(isTourDone(HINT_VOLLBILD_KNOPF)).toBe(true);
    renderHook(() => useVollbildHinweis(true, toast));
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('nicht bereit (Server-App, Einführung läuft) → kein Hinweis und nichts gemerkt', () => {
    const toast = vi.fn();
    renderHook(() => useVollbildHinweis(false, toast));
    expect(toast).not.toHaveBeenCalled();
    expect(isTourDone(HINT_VOLLBILD_KNOPF)).toBe(false);
  });
});
