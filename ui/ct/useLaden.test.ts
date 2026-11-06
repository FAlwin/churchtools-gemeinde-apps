// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ApiError } from './fehler';
import { fehlerMeldung } from './fehlerMeldung';
import { useLaden } from './useLaden';

/** Ein Versprechen, das der Test selbst einlöst – so ist die Reihenfolge der Antworten in seiner Hand. */
function offen<T>() {
  let ja!: (w: T) => void;
  let nein!: (e: unknown) => void;
  const p = new Promise<T>((a, b) => {
    ja = a;
    nein = b;
  });
  return { p, ja, nein };
}

describe('useLaden (#845)', () => {
  it('lädt beim Öffnen: erst „lädt“, dann die Daten', async () => {
    const a = offen<string>();
    const { result } = renderHook(() => useLaden(() => a.p, []));
    expect(result.current.stand).toEqual({ art: 'laedt' });
    await act(async () => a.ja('Daten'));
    expect(result.current.stand).toEqual({ art: 'fertig', daten: 'Daten' });
  });

  it('beschreibt einen Fehler mit fehlerMeldung – 401 ist nicht „Erneut versuchen“', async () => {
    const fehler = new ApiError(401, 'abgemeldet');
    const { result } = renderHook(() => useLaden(() => Promise.reject(fehler), []));
    await waitFor(() => expect(result.current.stand.art).toBe('fehler'));
    expect(result.current.stand).toEqual({ art: 'fehler', fehler: fehlerMeldung(fehler) });
    expect(result.current.stand.art === 'fehler' && result.current.stand.fehler.nochmal).toBe(
      false,
    );
  });

  it('ein Fehler beim Aufrufen selbst (nicht im Versprechen) ist auch ein Fehler', async () => {
    const { result } = renderHook(() =>
      useLaden((): Promise<string> => {
        throw new Error('kaputt');
      }, []),
    );
    await waitFor(() => expect(result.current.stand.art).toBe('fehler'));
  });

  it('eine späte Antwort zu alten deps zählt nicht', async () => {
    const alt = offen<string>();
    const neu = offen<string>();
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useLaden(() => (id === 1 ? alt.p : neu.p), [id]),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });
    expect(result.current.stand).toEqual({ art: 'laedt' });
    await act(async () => neu.ja('zu 2'));
    await act(async () => alt.ja('zu 1'));
    expect(result.current.stand).toEqual({ art: 'fertig', daten: 'zu 2' });
  });

  it('ein später FEHLER zu alten deps zählt auch nicht', async () => {
    const alt = offen<string>();
    const neu = offen<string>();
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useLaden(() => (id === 1 ? alt.p : neu.p), [id]),
      { initialProps: { id: 1 } },
    );
    rerender({ id: 2 });
    await act(async () => neu.ja('zu 2'));
    await act(async () => alt.nein(new Error('zu 1 gescheitert')));
    expect(result.current.stand).toEqual({ art: 'fertig', daten: 'zu 2' });
  });

  it('lädt neu, wenn sich deps ändern – und zeigt dabei wieder „lädt“', async () => {
    const laden = vi.fn((id: number) => Promise.resolve(`zu ${id}`));
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useLaden(() => laden(id), [id]),
      {
        initialProps: { id: 1 },
      },
    );
    await waitFor(() => expect(result.current.stand).toEqual({ art: 'fertig', daten: 'zu 1' }));
    rerender({ id: 1 });
    expect(laden).toHaveBeenCalledTimes(1);
    rerender({ id: 2 });
    expect(result.current.stand).toEqual({ art: 'laedt' });
    await waitFor(() => expect(result.current.stand).toEqual({ art: 'fertig', daten: 'zu 2' }));
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it('null heißt: nichts zu laden („aus“), ohne Aufruf', async () => {
    const laden = vi.fn(() => Promise.resolve('x'));
    const { result, rerender } = renderHook(
      ({ an }: { an: boolean }) => useLaden(() => (an ? laden() : null), [an]),
      { initialProps: { an: false } },
    );
    await waitFor(() => expect(result.current.stand).toEqual({ art: 'aus' }));
    expect(laden).not.toHaveBeenCalled();
    rerender({ an: true });
    await waitFor(() => expect(result.current.stand).toEqual({ art: 'fertig', daten: 'x' }));
  });

  it('neu() ist „Erneut versuchen“: fragt noch einmal und zeigt das Ergebnis', async () => {
    const laden = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Netz weg'))
      .mockResolvedValueOnce('wieder da');
    const { result } = renderHook(() => useLaden(laden, []));
    await waitFor(() => expect(result.current.stand.art).toBe('fehler'));
    act(() => result.current.neu());
    expect(result.current.stand).toEqual({ art: 'laedt' });
    await waitFor(() =>
      expect(result.current.stand).toEqual({ art: 'fertig', daten: 'wieder da' }),
    );
    expect(laden).toHaveBeenCalledTimes(2);
  });
});
