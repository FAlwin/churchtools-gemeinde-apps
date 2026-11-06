// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { LiedZugriffKontext, type LiedZugriff } from './liedZugriff';
import { useLiedtextSuche } from './liedDaten';

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
