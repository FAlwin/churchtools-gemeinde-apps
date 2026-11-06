// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { LiedZugriffKontext, type LiedZugriff } from './liedZugriff';
import {
  arrangementListenErneuern,
  liedSchluessel,
  useArrangementAendern,
  useLiedAendern,
  useLiedAnlegen,
  useLiedtextSuche,
} from './liedDaten';

/**
 * Die Abfragen der Liedwahl über den Liedzugriff (LW1a, 06.11.2026).
 *
 * **Ohne Liedtext-Suche im Liedzugriff läuft keine Anfrage** – in ChurchTools-Erweiterungen gibt es sie nicht (#300).
 * Vorher sorgte `funktionen.liedtextSuche` nur dafür, dass das Angebot fehlt; die Abfrage selbst hätte über
 * `ohneServer` mit einem Fehler geendet. Jetzt bleibt sie aus, auch wenn ein Aufrufer sie einschaltet.
 */
function mit(zugriff: Partial<LiedZugriff>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <LiedZugriffKontext.Provider value={zugriff as LiedZugriff}>
        {children}
      </LiedZugriffKontext.Provider>
    </QueryClientProvider>
  );
}

describe('useLiedtextSuche', () => {
  it('fragt nicht, wenn der Liedzugriff keine Liedtext-Suche hat', () => {
    const { result } = renderHook(() => useLiedtextSuche('gnade', true), { wrapper: mit({}) });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fragt über den Liedzugriff, wenn es sie gibt', () => {
    const suche = vi.fn(() => Promise.resolve([]));
    renderHook(() => useLiedtextSuche('gnade', true), { wrapper: mit({ liedtextSuche: suche }) });
    expect(suche).toHaveBeenCalledWith('gnade');
  });
});

/**
 * Was nach einer Änderung neu geladen wird (LW1b-2, 06.11.2026). Bis dahin stand das in `useServices` und war nur dort
 * zu sehen; jetzt teilt es sich auf: Liederliste, Stammdaten und Arrangements erneuert `liedDaten` für alle Apps, den
 * Rest meldet es der App über `nachAenderung`. Fehlt einer der beiden Teile, zeigt die App einen alten Stand.
 */
describe('Ändern und Anlegen – was danach neu geladen wird (LW1b-2)', () => {
  function aufbau(zugriff: Partial<LiedZugriff>) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const neu = vi.spyOn(qc, 'invalidateQueries');
    const nachAenderung = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <LiedZugriffKontext.Provider
          value={{ ...zugriff, nachAenderung } as unknown as LiedZugriff}
        >
          {children}
        </LiedZugriffKontext.Provider>
      </QueryClientProvider>
    );
    const schluessel = () => neu.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    return { qc, wrapper, nachAenderung, schluessel };
  }

  it('Lied ändern: frischer Stand in die Stammdaten, Liederliste neu, die App meldet ihre Speicher', async () => {
    const stand = { name: 'Treu (neu)' };
    const { qc, wrapper, nachAenderung, schluessel } = aufbau({
      liedAendern: vi.fn(() => Promise.resolve(stand)) as unknown as LiedZugriff['liedAendern'],
    });
    const { result } = renderHook(() => useLiedAendern(7), { wrapper });
    await result.current.mutateAsync({ name: 'Treu (neu)' });
    expect(qc.getQueryData(liedSchluessel.liedStammdaten(7))).toBe(stand);
    expect(schluessel()).toEqual([liedSchluessel.liederliste()]);
    expect(nachAenderung).toHaveBeenCalledWith(qc, { art: 'lied', songId: 7 });
  });

  it('Arrangement ändern: Arrangements und Liederliste neu, die App meldet ihre Speicher', async () => {
    const { qc, wrapper, nachAenderung, schluessel } = aufbau({
      arrangementAendern: vi.fn(() =>
        Promise.resolve({}),
      ) as unknown as LiedZugriff['arrangementAendern'],
    });
    const { result } = renderHook(() => useArrangementAendern(7), { wrapper });
    await result.current.mutateAsync({ arrangementId: 70, auftrag: {} });
    expect(schluessel()).toEqual([liedSchluessel.arrangements(7), liedSchluessel.liederliste()]);
    expect(nachAenderung).toHaveBeenCalledWith(qc, { art: 'arrangement', songId: 7 });
  });

  it('dieselbe Regel für die übrigen Arrangement-Änderungen der App (Anlegen, Standard, Löschen)', () => {
    const qc = new QueryClient();
    const neu = vi.spyOn(qc, 'invalidateQueries');
    const nachAenderung = vi.fn();
    arrangementListenErneuern(qc, { nachAenderung } as unknown as LiedZugriff, 9);
    expect(neu.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey)).toEqual([
      liedSchluessel.arrangements(9),
      liedSchluessel.liederliste(),
    ]);
    expect(nachAenderung).toHaveBeenCalledWith(qc, { art: 'arrangement', songId: 9 });
  });

  it('Lied anlegen: nur die Liederliste neu – nicht die Statistik, und keinen zweiten Versuch', async () => {
    const anlegen = vi.fn(() => Promise.reject(new Error('Zeitüberschreitung')));
    const { wrapper, nachAenderung, schluessel } = aufbau({
      liedAnlegen: anlegen,
    });
    const { result } = renderHook(() => useLiedAnlegen(), { wrapper });
    await expect(result.current.mutateAsync({} as never)).rejects.toThrow('Zeitüberschreitung');
    // Ein zweiter Durchlauf legte ein zweites Lied an (#322).
    expect(anlegen).toHaveBeenCalledTimes(1);
    expect(schluessel()).toEqual([]);

    anlegen.mockImplementationOnce(() => Promise.resolve({ songId: 1, arrangementId: 2 } as never));
    await result.current.mutateAsync({} as never);
    expect(schluessel()).toEqual([liedSchluessel.liederliste()]);
    expect(nachAenderung).not.toHaveBeenCalled();
  });
});
