// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { StrictMode } from 'react';
import { renderHook } from '@testing-library/react';
import { useDirektLink } from './useDirektLink';

/** Der Direktlink aus dem Dienstplaner (E6-O O4): einmal lesen, dann aus der Adresse nehmen. */
const hashSetzen = (h: string) => window.history.replaceState(null, '', `/app/?v=1${h}`);

describe('useDirektLink', () => {
  it('liest Termin, Punkt und Tag – und nimmt den Link danach aus der Adresse', () => {
    hashSetzen('#/termin/142/punkt/196?am=2026-10-18');
    const { result } = renderHook(() => useDirektLink());
    expect(result.current).toEqual({ terminId: 142, punktId: 196, am: '2026-10-18' });
    // Ein Neuladen spränge sonst wieder hin; Pfad und Suchteil bleiben.
    expect(window.location.hash).toBe('');
    expect(window.location.pathname + window.location.search).toBe('/app/?v=1');
  });

  it('im StrictMode (Startwert zweimal) geht der Link nicht verloren', () => {
    hashSetzen('#/termin/5/punkt/9');
    const { result } = renderHook(() => useDirektLink(), { wrapper: StrictMode });
    expect(result.current).toEqual({ terminId: 5, punktId: 9 });
  });

  it('nur ein Termin (Knopf „Musik-App“ im Dienstplaner): ohne Punkt', () => {
    hashSetzen('#/termin/151?am=2026-11-01');
    const { result } = renderHook(() => useDirektLink());
    expect(result.current).toEqual({ terminId: 151, am: '2026-11-01' });
    expect(window.location.hash).toBe('');
  });

  it('ohne Direktlink: null, die Adresse bleibt', () => {
    hashSetzen('#/termine');
    const { result } = renderHook(() => useDirektLink());
    expect(result.current).toBeNull();
    expect(window.location.hash).toBe('#/termine');
  });
});
