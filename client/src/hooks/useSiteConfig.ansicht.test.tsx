// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DEFAULT_SITE_CONFIG } from '@shared/types/index';

/**
 * Die Standard-Ansicht der Gemeinde wird auf dem Gerät gemerkt (07.10.2026) – aber nur aus GELADENEN
 * Daten. Die Abfrage startet mit den Vorgaben („Akkorde"); würden die gemerkt, setzte jeder Start
 * ohne Netz die Wahl der Gemeinde zurück – genau im Saal, wo das PDF gebraucht wird.
 */
vi.mock('../services/siteConfigApi', () => ({ getSiteConfig: vi.fn() }));

const api = await import('../services/siteConfigApi');
const { useSiteConfig } = await import('./useSiteConfig');
const { gemeindeAnsicht, merkeGemeindeAnsicht } = await import('../utils/standardAnsicht');

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useSiteConfig merkt die Standard-Ansicht', () => {
  it('geladen „PDF zuerst" → gemerkt', async () => {
    vi.mocked(api.getSiteConfig).mockResolvedValue({
      ...DEFAULT_SITE_CONFIG,
      standardAnsicht: 'dokument',
    });
    const { result } = renderHook(() => useSiteConfig(), { wrapper });
    await waitFor(() =>
      expect(result.current.isSuccess && result.current.dataUpdatedAt).toBeTruthy(),
    );
    await waitFor(() => expect(gemeindeAnsicht()).toBe('dokument'));
  });

  it('ohne Netz bleibt die gemerkte Wahl – die Vorgaben überschreiben sie nicht', async () => {
    merkeGemeindeAnsicht('dokument');
    vi.mocked(api.getSiteConfig).mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useSiteConfig(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(gemeindeAnsicht()).toBe('dokument');
  });
});
