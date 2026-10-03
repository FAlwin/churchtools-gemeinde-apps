// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { Ausschnitt, Blatt, Flaeche } from '../utils/zoomAusschnitt';

/**
 * Zoom-Ablage: Was wird gemerkt, was vergessen?
 *
 * Der Zoom-Knopf in der Kopfzeile setzt zurück UND vergisst – dort IST das die Absicht. Alles
 * andere (Blättern, Abgleich, Wiederkehr in die App) stellt den gespeicherten Wert wieder her.
 *
 * **Was hier NICHT mehr steht:** Bis v2.18 passte das Aus-/Einblenden der Leisten die Seite auch
 * gleich neu ein. Das war ein Missverständnis des ersten Berichts zu #319 – gewollt ist, dass das
 * Vollbild die Vergrößerung behält. Die Mechanik ist ersatzlos entfallen; dass die Seite ihren
 * Rahmen nicht überragt, macht der Pixel-Deckel in `PageDeck`.
 */
vi.mock('../services/annotations', () => ({ pushField: vi.fn() }));
vi.mock('../utils/deviceClass', () => ({ deviceClass: () => 'large' }));

const { useZoomPersistence } = await import('./useZoomPersistence');
const { ausschnittAus, transformAus, ZOOM_GRENZEN } = await import('../utils/zoomAusschnitt');

/** Eine Zoom-Ebene, die mitschreibt, ob sie zurückgesetzt wurde. */
function ebene() {
  const resetTransform = vi.fn();
  const setTransform = vi.fn();
  const ref = {
    current: {
      resetTransform,
      setTransform,
      instance: { transformState: { scale: 1.8, positionX: 0, positionY: 0 } },
    } as unknown as ReactZoomPanPinchRef,
  };
  return {
    ref: ref as MutableRefObject<ReactZoomPanPinchRef | null>,
    resetTransform,
    setTransform,
  };
}

type Geo = { flaeche: Flaeche; blatt: Blatt } | null;

function starte(zoomedSlots: [boolean, boolean] = [true, false], geo: Geo = null) {
  const a = ebene();
  const b = ebene();
  const args = {
    zoomKeyBaseFor: (p: number) => `worship_doczoom_song1_voriginal_${p}`,
    perView: 1,
    pageIndex: 0,
    transformRefs: [a.ref, b.ref],
    lastScale: { current: [1, 1] } as MutableRefObject<[number, number]>,
    gestureSlot: { current: null } as MutableRefObject<number | null>,
    zoomedSlots,
    geometrie: () => geo,
    letzterAusschnitt: { current: [null, null] } as MutableRefObject<
      [Ausschnitt | null, Ausschnitt | null]
    >,
  };
  return { ...renderHook(() => useZoomPersistence(args)), a, b, args };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.clearAllMocks());

describe('resetVisibleZoom – einpassen', () => {
  it('setzt die sichtbare Seite auf Einpassen zurück', () => {
    const { result, a } = starte();
    result.current.resetVisibleZoom();
    expect(a.resetTransform).toHaveBeenCalled();
  });

  it('lässt Seiten in Ruhe, die gar nicht vergrößert sind', () => {
    const { result, a } = starte([false, false]);
    result.current.resetVisibleZoom();
    expect(a.resetTransform).not.toHaveBeenCalled();
  });
});

/**
 * Einen gespeicherten Zoom über den ECHTEN Weg anlegen: `persistZoom` sichert nur während einer
 * laufenden Geste (`gestureSlot`) – genau so entsteht ein gespeicherter Zoom im Betrieb.
 *
 * Steht auf Modulebene, weil zwei Blöcke sie brauchen (seit #319 auch der zum Einpassen).
 */
function zoomSpeichern(
  result: { current: ReturnType<typeof useZoomPersistence> },
  args: { gestureSlot: { current: number | null } },
) {
  args.gestureSlot.current = 0; // Nutzer pincht gerade auf Slot 0
  result.current.persistZoom(0);
  args.gestureSlot.current = null; // Geste vorbei
  expect(result.current.loadZoom(0)).not.toBeNull();
}

describe('resetVisibleZoom – merken oder vergessen', () => {
  it('vergisst den gespeicherten Zoom – das ist die Absicht des Zoom-Knopfs', () => {
    const { result, args } = starte();
    zoomSpeichern(result, args);
    result.current.resetVisibleZoom();
    expect(result.current.loadZoom(0)).toBeNull();
  });
});

/**
 * #420: Der Zoom wird als Ausschnitt des Blatts gemerkt und so wieder angewendet – nicht über die
 * gespeicherten Pixel. Geprüft gegen die Erzeuger (`ausschnittAus`/`transformAus`), nicht gegen
 * hingeschriebene Zahlen.
 */
describe('Ausschnitt statt Pixel (#420)', () => {
  const KEY = 'worship_doczoom_song1_voriginal_0_dlarge1';
  const hoch: Geo = { flaeche: { w: 820, h: 1000 }, blatt: { x: 56.5, y: 0, w: 707, h: 1000 } };
  const voll: Geo = { flaeche: { w: 820, h: 1180 }, blatt: { x: 0, y: 10, w: 820, h: 1160 } };

  it('merkt sich beim Sichern die Stelle auf dem Blatt (fx/fy) neben den Pixeln', () => {
    const { result, a, args } = starte([true, false], hoch);
    (a.ref.current as unknown as { instance: unknown }).instance = {
      transformState: { scale: 2, positionX: -400, positionY: -600 },
    };
    args.gestureSlot.current = 0;
    result.current.persistZoom(0);
    const gespeichert = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Record<string, number>;
    const erwartet = ausschnittAus({ x: -400, y: -600, scale: 2 }, hoch.flaeche, hoch.blatt)!;
    expect(gespeichert).toMatchObject({ x: -400, y: -600, scale: 2 });
    expect(gespeichert.fx).toBeCloseTo(erwartet.fx, 9);
    expect(gespeichert.fy).toBeCloseTo(erwartet.fy, 9);
    expect(args.letzterAusschnitt.current[0]?.fx).toBeCloseTo(erwartet.fx, 9);
  });

  it('wendet einen Ausschnitt auf einer ANDEREN Fläche so an, dass dieselbe Stelle in der Mitte steht', () => {
    localStorage.setItem(KEY, JSON.stringify({ x: -400, y: -600, scale: 2, fx: 0.49, fy: 0.55 }));
    const { result, a } = starte([true, false], voll);
    result.current.restoreVisibleZoom();
    const t = transformAus({ fx: 0.49, fy: 0.55 }, 2, voll.flaeche, voll.blatt, ZOOM_GRENZEN);
    expect(a.setTransform).toHaveBeenCalledWith(t.x, t.y, t.scale, 0);
  });

  it('begrenzt einen ALTEN Eintrag ohne fx/fy am Rand, statt das Blatt abzuschneiden', () => {
    // Ein Pixel-Zoom von einer breiteren Fläche: x weit jenseits des Randes dieser Fläche.
    localStorage.setItem(KEY, JSON.stringify({ x: -5000, y: 0, scale: 2 }));
    const { result, a } = starte([true, false], hoch);
    result.current.restoreVisibleZoom();
    const [x] = a.setTransform.mock.calls[0] as [number, number, number, number];
    expect(x).toBe(hoch.flaeche.w * (1 - 2));
  });

  it('ohne vermessenes Blatt bleibt es bei den gespeicherten Pixeln', () => {
    localStorage.setItem(KEY, JSON.stringify({ x: -10, y: -20, scale: 2, fx: 0.5, fy: 0.5 }));
    const { result, a } = starte([true, false], null);
    result.current.restoreVisibleZoom();
    expect(a.setTransform).toHaveBeenCalledWith(-10, -20, 2, 0);
  });
});
