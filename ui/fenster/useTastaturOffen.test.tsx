// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { TASTATUR_AB_PX, tastaturHoehe, useTastaturOffen } from './useTastaturOffen';

/** Lied-Editor (23.10.2026): Schreibansicht nur bei offener Bildschirmtastatur. */
class Ansicht extends EventTarget {
  height = 800;
  offsetTop = 0;
}
const echt = Object.getOwnPropertyDescriptor(window, 'visualViewport');
afterEach(() => {
  if (echt) Object.defineProperty(window, 'visualViewport', echt);
});
function ansicht(): Ansicht {
  const vv = new Ansicht();
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  return vv;
}

describe('tastaturHoehe', () => {
  it('Unterschied zwischen Fensterhöhe und sichtbarem Bereich, nie negativ', () => {
    const vv = ansicht();
    vv.height = 420;
    expect(tastaturHoehe(vv as unknown as VisualViewport, 800)).toBe(380);
    vv.height = 900;
    expect(tastaturHoehe(vv as unknown as VisualViewport, 800)).toBe(0);
  });
});

describe('useTastaturOffen', () => {
  it('offen erst ab der Schwelle – die schmale Leiste einer Hardware-Tastatur zählt nicht', () => {
    const vv = ansicht();
    const { result } = renderHook(() => useTastaturOffen());
    expect(result.current).toBe(false);
    act(() => {
      vv.height = 800 - (TASTATUR_AB_PX - 1);
      vv.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
    act(() => {
      vv.height = 400;
      vv.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);
    act(() => {
      vv.height = 800;
      vv.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });
});
