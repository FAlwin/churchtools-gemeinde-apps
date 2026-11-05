// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVollbild } from './useVollbild';

const element = { current: document.createElement('div') };

/** Den Browser so tun lassen, als könne er Vollbild (Computer, iPad) oder nicht (iPhone-Safari, jsdom). */
function browserKann(ja: boolean) {
  Object.defineProperty(document, 'fullscreenEnabled', { value: ja, configurable: true });
}

afterEach(() => {
  browserKann(false);
  vi.restoreAllMocks();
});

describe('useVollbild', () => {
  it('ohne Vollbild im Browser und ohne Ersatz: kein Knopf (wie bisher für Organigramm und Dienstplaner)', () => {
    browserKann(false);
    const { result } = renderHook(() => useVollbild(element));
    expect(result.current).toMatchObject({ kann: false, art: null, an: false });
    act(() => result.current.umschalten());
    expect(result.current.an).toBe(false);
  });

  it('iPhone mit `ersatz`: Knopf da, Umschalten und Beenden ändern nur `an` – kein Browser-Vollbild', () => {
    browserKann(false);
    const anfordern = vi.fn(() => Promise.resolve());
    element.current.requestFullscreen = anfordern;
    const { result } = renderHook(() => useVollbild(element, { ersatz: true }));
    expect(result.current).toMatchObject({ kann: true, art: 'ersatz', an: false });
    act(() => result.current.umschalten());
    expect(result.current.an).toBe(true);
    act(() => result.current.beenden());
    expect(result.current.an).toBe(false);
    expect(anfordern).not.toHaveBeenCalled();
  });

  it('Browser kann Vollbild: auch mit `ersatz` das echte Vollbild, `an` folgt dem Browser', () => {
    browserKann(true);
    const anfordern = vi.fn(() => Promise.resolve());
    element.current.requestFullscreen = anfordern;
    const { result } = renderHook(() => useVollbild(element, { ersatz: true }));
    expect(result.current).toMatchObject({ kann: true, art: 'echt' });
    act(() => result.current.umschalten());
    expect(anfordern).toHaveBeenCalledOnce();
    // Der Browser meldet das Vollbild (oder dessen Ende per Escape) – erst dann ist `an` gesetzt.
    Object.defineProperty(document, 'fullscreenElement', {
      value: element.current,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.an).toBe(true);
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.an).toBe(false);
  });
});
