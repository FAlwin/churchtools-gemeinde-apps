// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEchtesVollbild } from './useEchtesVollbild';

/**
 * Das echte Vollbild der Erweiterung (08.10.2026). jsdom kennt die Fullscreen-API nicht – deshalb
 * wird sie hier von Hand nachgebaut, so wie sie sich im Browser zeigt: `fullscreenEnabled`, ein
 * `fullscreenElement` und das Ereignis `fullscreenchange`. Ob das Vollbild am iPad wirklich die
 * ChurchTools-Leiste verdeckt, prüft nur das Gerät (TF-EXT-11).
 */
let imVollbild: Element | null = null;
let root: HTMLElement;
const anfordern = vi.fn(() => Promise.resolve());
const beenden = vi.fn(() => Promise.resolve());

function browser(opts: { kann: boolean; webkit?: boolean }) {
  const d = document as unknown as Record<string, unknown>;
  for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) delete d[k];
  Object.defineProperty(document, opts.webkit ? 'webkitFullscreenEnabled' : 'fullscreenEnabled', {
    configurable: true,
    get: () => opts.kann,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => imVollbild,
  });
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: beenden });
}

function wechsel(element: Element | null) {
  imVollbild = element;
  document.dispatchEvent(new Event('fullscreenchange'));
}

beforeEach(() => {
  imVollbild = null;
  anfordern.mockClear();
  beenden.mockClear();
  root = document.createElement('div');
  root.id = 'root';
  (root as unknown as { requestFullscreen: unknown }).requestFullscreen = anfordern;
  document.body.appendChild(root);
});
afterEach(() => root.remove());

describe('useEchtesVollbild', () => {
  it('Erweiterung + Browser kann es: an → #root ins Vollbild, aus → wieder heraus', () => {
    browser({ kann: true });
    const { result } = renderHook(() => useEchtesVollbild(true, vi.fn()));
    result.current(true);
    expect(anfordern).toHaveBeenCalledTimes(1);
    wechsel(root);
    result.current(false);
    expect(beenden).toHaveBeenCalledTimes(1);
  });

  it('Homescreen-App bzw. Server-Variante (nicht erlaubt): kein Browser-Vollbild', () => {
    browser({ kann: true });
    const { result } = renderHook(() => useEchtesVollbild(false, vi.fn()));
    result.current(true);
    expect(anfordern).not.toHaveBeenCalled();
  });

  it('iPhone (Browser bietet es nicht an): nichts passiert, es bleibt beim Ausblenden der Leisten', () => {
    browser({ kann: false });
    const { result } = renderHook(() => useEchtesVollbild(true, vi.fn()));
    result.current(true);
    expect(anfordern).not.toHaveBeenCalled();
  });

  it('von außen verlassen (Esc, Wischgeste) → Leisten zurück; beim Betreten nicht', () => {
    browser({ kann: true });
    const verlassen = vi.fn();
    renderHook(() => useEchtesVollbild(true, verlassen));
    wechsel(root);
    expect(verlassen).not.toHaveBeenCalled();
    wechsel(null);
    expect(verlassen).toHaveBeenCalledTimes(1);
  });

  it('Blatt verlassen im Vollbild → Vollbild endet mit', () => {
    browser({ kann: true });
    const { unmount } = renderHook(() => useEchtesVollbild(true, vi.fn()));
    wechsel(root);
    unmount();
    expect(beenden).toHaveBeenCalledTimes(1);
  });

  it('Browser lehnt ab → die Ablehnung wird abgefangen, statt als Fehler durchzuschlagen', () => {
    browser({ kann: true });
    const abgelehnt = Promise.reject(new Error('nicht erlaubt'));
    const abgefangen = vi.spyOn(abgelehnt, 'catch');
    anfordern.mockReturnValueOnce(abgelehnt);
    const { result } = renderHook(() => useEchtesVollbild(true, vi.fn()));
    expect(() => result.current(true)).not.toThrow();
    expect(abgefangen).toHaveBeenCalled();
  });

  it('ältere iPad-Safari nur mit webkit-Vorsilbe: wird ebenso genutzt', () => {
    browser({ kann: true, webkit: true });
    const webkit = vi.fn();
    delete (root as unknown as Record<string, unknown>).requestFullscreen;
    (root as unknown as { webkitRequestFullscreen: unknown }).webkitRequestFullscreen = webkit;
    const { result } = renderHook(() => useEchtesVollbild(true, vi.fn()));
    result.current(true);
    expect(webkit).toHaveBeenCalledTimes(1);
  });
});
