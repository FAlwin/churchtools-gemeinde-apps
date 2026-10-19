// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

/**
 * #314: Der Hook ist absichtlich dünn – das Laden macht `loadAppLogo`. Geprüft wird deshalb genau
 * das, was die Hülle beiträgt:
 *
 *  - Sie **lädt nicht selbst**. Genau das war der Fehler: Das Vorladen stand zweimal von Hand
 *    daneben, obwohl es die Funktion längst gab, und nur die Funktion behandelt `onerror`.
 *  - Ein **fehlendes Logo hält nichts auf** – die PDF entsteht dann eben ohne.
 *  - Nach dem Verlassen wird **kein Zustand mehr gesetzt**.
 *  - Hat die Gemeinde das Logo **ausgeblendet** (19.10.2026), bleibt es weg – geprüft mit der echten Regel
 *    `logoZeigen`, nicht mit einer hier nachgebauten.
 */
const loadAppLogo = vi.fn();
vi.mock('../utils/logoAsset', async (echt) => ({
  ...(await echt<typeof import('../utils/logoAsset')>()),
  loadAppLogo: () => loadAppLogo(),
}));
let site: { liedblattLogo?: boolean } = {};
vi.mock('./useSiteConfig', () => ({ useSiteConfig: () => ({ data: site }) }));

const { useAppLogo } = await import('./useAppLogo');

afterEach(() => {
  vi.clearAllMocks();
  site = {};
});

describe('useAppLogo', () => {
  it('geht über loadAppLogo, statt das Vorladen ein drittes Mal hinzuschreiben', async () => {
    loadAppLogo.mockResolvedValue(null);
    renderHook(() => useAppLogo());
    await act(async () => {});
    expect(loadAppLogo).toHaveBeenCalledTimes(1);
  });

  it('liefert erst null und dann das geladene Bild', async () => {
    const bild = {} as HTMLImageElement;
    loadAppLogo.mockResolvedValue(bild);
    const { result } = renderHook(() => useAppLogo());
    expect(result.current).toBeNull();
    await act(async () => {});
    expect(result.current).toBe(bild);
  });

  it('bleibt bei null, wenn das Bild nicht geladen werden konnte – ohne hängen zu bleiben', async () => {
    loadAppLogo.mockResolvedValue(null);
    const { result } = renderHook(() => useAppLogo());
    await act(async () => {});
    expect(result.current).toBeNull();
  });

  it('setzt nach dem Verlassen keinen Zustand mehr', async () => {
    let aufloesen: (v: HTMLImageElement | null) => void = () => {};
    loadAppLogo.mockReturnValue(
      new Promise<HTMLImageElement | null>((r) => {
        aufloesen = r;
      }),
    );
    const warnungen = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useAppLogo());
    unmount();
    await act(async () => {
      aufloesen({} as HTMLImageElement);
    });
    expect(warnungen).not.toHaveBeenCalled();
    warnungen.mockRestore();
  });

  it('Gemeinde hat das Logo ausgeblendet: null – und es wird gar nicht erst geladen', async () => {
    site = { liedblattLogo: false };
    loadAppLogo.mockResolvedValue({});
    const { result } = renderHook(() => useAppLogo());
    await act(async () => {});
    expect(result.current).toBeNull();
    expect(loadAppLogo).not.toHaveBeenCalled();
  });

  it('folgt dem Schalter sofort: aus → weg, wieder an → wieder da', async () => {
    const bild = {} as HTMLImageElement;
    loadAppLogo.mockResolvedValue(bild);
    const { result, rerender } = renderHook(() => useAppLogo());
    await act(async () => {});
    expect(result.current).toBe(bild);
    site = { liedblattLogo: false };
    rerender();
    expect(result.current).toBeNull();
    site = { liedblattLogo: true };
    rerender();
    await act(async () => {});
    expect(result.current).toBe(bild);
  });
});
