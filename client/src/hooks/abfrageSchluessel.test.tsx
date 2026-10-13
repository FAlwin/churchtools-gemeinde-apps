// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * #492: Die Schlüssel des Zwischenspeichers stehen an einer Stelle (`abfrageSchluessel.ts`).
 *
 * Geprüft wird, was davon abhängt: dass Abruf, Vorladen und Erneuern wirklich DENSELBEN Eintrag
 * treffen – nicht nur, dass eine Funktion ein Array liefert.
 */
vi.mock('../services/churchtoolsApi', () => ({
  getSongChart: vi.fn(),
  getAgenda: vi.fn(),
}));

const api = await import('../services/churchtoolsApi');
const { schluessel, liedblattAbfrage, agendaAbfrage } = await import('./abfrageSchluessel');
const { useSongChart, useAgenda } = await import('./useServices');
const { useArrangementVorladen } = await import('./useArrangementUeberschreibung');

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  vi.mocked(api.getSongChart).mockReset();
  vi.mocked(api.getAgenda).mockReset();
});

describe('die Namen – Teil des gespeicherten Zwischenspeichers', () => {
  // Bewusst Literale: Der Zwischenspeicher liegt in IndexedDB. Ändert sich ein Name, findet die App
  // den Offline-Vorrat nicht mehr.
  it('bleiben, wie sie gespeichert wurden', () => {
    expect(schluessel.agenda(5)).toEqual(['agenda', 5]);
    expect(schluessel.termine()).toEqual(['services']);
    expect(schluessel.ich()).toEqual(['me']);
    expect(schluessel.liedblatt(3, 9)).toEqual(['song-chart', 3, 9]);
  });
});

describe('die engeren Schlüssel beginnen mit den weiteren', () => {
  it('Erneuern über den weiteren trifft den engeren', async () => {
    qc.setQueryData(schluessel.agenda(5), []);
    qc.setQueryData(schluessel.liedblatt(3, 9), {});
    qc.setQueryData(schluessel.termineVergangen(6), []);

    await qc.invalidateQueries({ queryKey: schluessel.agendaAlle() });
    await qc.invalidateQueries({ queryKey: schluessel.liedblaetter(3) });
    await qc.invalidateQueries({ queryKey: schluessel.termine() });

    expect(qc.getQueryState(schluessel.agenda(5))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(schluessel.liedblatt(3, 9))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(schluessel.termineVergangen(6))?.isInvalidated).toBe(true);
  });
});

describe('Liedblatt: Vorladen und Anzeigen teilen sich den Eintrag', () => {
  it('ein vorgeladenes Arrangement holt `useSongChart` nicht noch einmal', async () => {
    vi.mocked(api.getSongChart).mockResolvedValue({ id: 3 } as never);

    renderHook(() => useArrangementVorladen(3, [9], true), { wrapper });
    await waitFor(() => expect(qc.getQueryData(schluessel.liedblatt(3, 9))).toBeDefined());

    const { result } = renderHook(() => useSongChart({ songId: 3, arrangementId: 9 }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual({ id: 3 }));
    expect(api.getSongChart).toHaveBeenCalledTimes(1);
  });

  it('ohne Auswahl wird nichts geholt', () => {
    renderHook(() => useSongChart(null), { wrapper });
    expect(api.getSongChart).not.toHaveBeenCalled();
  });

  it('die Fabrik fragt genau das Arrangement an', async () => {
    vi.mocked(api.getSongChart).mockResolvedValue({} as never);
    await qc.fetchQuery(liedblattAbfrage(3, 9));
    expect(api.getSongChart).toHaveBeenCalledWith(3, 9);
  });
});

describe('Ablauf: Anzeigen und Offline-Vorrat teilen sich den Eintrag', () => {
  it('was der Offline-Vorrat holt, zeigt `useAgenda` ohne zweiten Abruf', async () => {
    vi.mocked(api.getAgenda).mockResolvedValue([{ id: 1 }] as never);
    await qc.fetchQuery(agendaAbfrage(5));

    const { result } = renderHook(() => useAgenda(5), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ id: 1 }]));
    expect(api.getAgenda).toHaveBeenCalledTimes(1);
  });

  it('der Offline-Vorrat holt trotzdem frisch (keine Frische-Zeit in der Fabrik)', async () => {
    vi.mocked(api.getAgenda).mockResolvedValue([] as never);
    await qc.fetchQuery(agendaAbfrage(5));
    await qc.fetchQuery(agendaAbfrage(5));
    expect(api.getAgenda).toHaveBeenCalledTimes(2);
  });

  it('ohne Termin wird nichts geholt', () => {
    renderHook(() => useAgenda(null), { wrapper });
    expect(api.getAgenda).not.toHaveBeenCalled();
  });
});
