// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schluessel } from './abfrageSchluessel';
import { render, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AgendaItem } from '@shared/types/index';

const api = vi.hoisted(() => ({ markSetlistSeen: vi.fn() }));
vi.mock('../services/churchtoolsApi', async (orig) => ({
  ...(await orig<typeof import('../services/churchtoolsApi')>()),
  markSetlistSeen: api.markSetlistSeen,
}));

const { useMarkSeenAfterShown } = await import('./useSetlistLiveSync');

/**
 * „Gesehen" nach dem Anzeigen statt beim Verlassen (Alwin, 12.10.2026): In der Erweiterung verlässt man
 * meist die ganze ChurchTools-Seite – dann lief das alte Merken nie, und dieselben Änderungen kamen beim
 * nächsten Öffnen wieder.
 */
const punkt = (over: Partial<AgendaItem>) => ({ id: 1, title: 'A', ...over }) as AgendaItem;

function zeige(start: Parameters<typeof useMarkSeenAfterShown>[0], qc = new QueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook((p: Parameters<typeof useMarkSeenAfterShown>[0]) => useMarkSeenAfterShown(p), {
    wrapper,
    initialProps: start,
  });
}

const BASIS = {
  eventId: 7,
  angezeigt: true,
  items: [punkt({ changed: true, neu: true })],
  stand: 1000,
  laedt: false,
};

beforeEach(() => api.markSetlistSeen.mockReset().mockResolvedValue({ ok: true }));

/**
 * Das Merken läuft über eine Mutation, also verzögert. Ein „wurde NICHT aufgerufen" direkt nach dem
 * Rendern wäre immer grün – erst nach einer kurzen Pause sagt es etwas (Gegenprobe 12.10.2026).
 */
const ruhe = () => new Promise((r) => setTimeout(r, 30));

describe('useMarkSeenAfterShown', () => {
  it('merkt einen angezeigten Stand mit Änderungen als gesehen', async () => {
    zeige(BASIS);
    await vi.waitFor(() => expect(api.markSetlistSeen).toHaveBeenCalledWith(7));
  });

  it('nach dem Merken trägt auch der gespeicherte Ablauf keine Markierungen mehr', async () => {
    // Sonst brachte ein Neuladen binnen 30 s (Erweiterung: kurz eine andere ChurchTools-Seite) denselben
    // Hinweis aus dem Speicher noch einmal – im Browser gefunden, 12.10.2026.
    const qc = new QueryClient();
    const items = [
      punkt({ changed: true, neu: true }),
      punkt({ id: 9, title: 'Weg', removed: true }),
    ];
    qc.setQueryData(schluessel.agenda(7), items);
    zeige({ ...BASIS, items }, qc);
    await vi.waitFor(() =>
      expect(qc.getQueryData(schluessel.agenda(7))).toEqual([
        expect.objectContaining({ id: 1, changed: false, neu: false }),
      ]),
    );
  });

  it('nicht, solange noch geladen wird – das Angezeigte ist dann der alte Stand aus dem Speicher', async () => {
    zeige({ ...BASIS, laedt: true });
    await ruhe();
    expect(api.markSetlistSeen).not.toHaveBeenCalled();
  });

  it('nicht im Liederheft – dort steht nur ein Hinweis, die Schildchen hat niemand gesehen', async () => {
    zeige({ ...BASIS, angezeigt: false });
    await ruhe();
    expect(api.markSetlistSeen).not.toHaveBeenCalled();
  });

  it('denselben Abruf nur einmal – auch wenn neu gerendert wird', async () => {
    const { rerender } = zeige(BASIS);
    await vi.waitFor(() => expect(api.markSetlistSeen).toHaveBeenCalledTimes(1));
    rerender({ ...BASIS, items: [...BASIS.items] });
    rerender({ ...BASIS, stand: 2000 });
    await vi.waitFor(() => expect(api.markSetlistSeen).toHaveBeenCalledTimes(2));
  });

  it('nichts zu quittieren (alles schon gesehen) → kein Schreiben', async () => {
    zeige({ ...BASIS, items: [punkt({ changed: false })] });
    await ruhe();
    expect(api.markSetlistSeen).not.toHaveBeenCalled();
  });

  it('noch gar kein Gesehen-Stand → einmal merken, damit spätere Änderungen erkannt werden', async () => {
    zeige({ ...BASIS, items: [punkt({})] });
    await vi.waitFor(() => expect(api.markSetlistSeen).toHaveBeenCalledWith(7));
  });

  it('noch kein Gesehen-Stand, verdrahtet wie in der App: genau EIN Schreiben, keine Schleife (#555)', async () => {
    // Die Fälle oben reichen die Props von Hand herein – so blieb unbemerkt, dass das eigene
    // `setQueryData` nach dem Merken einen neuen „Stand" erzeugt. Mit `changed` noch `undefined` hielt
    // der Effekt das wieder für „noch nie gesehen" und speicherte erneut, ~6-mal pro Sekunde
    // (gemessen in der Test-Instanz, 14.10.2026). Hier also wie in `App.tsx`: Daten und Stand aus der Abfrage.
    const qc = new QueryClient();
    function MitAbfrage() {
      const q = useQuery({
        queryKey: schluessel.agenda(7),
        queryFn: () => Promise.resolve([punkt({}), punkt({ id: 2, title: 'B' })]),
        staleTime: Infinity,
      });
      useMarkSeenAfterShown({
        eventId: 7,
        angezeigt: true,
        items: q.data,
        stand: q.dataUpdatedAt,
        laedt: q.isFetching,
      });
      return null;
    }
    render(
      <QueryClientProvider client={qc}>
        <MitAbfrage />
      </QueryClientProvider>,
    );
    await vi.waitFor(() => expect(api.markSetlistSeen).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 150));
    expect(api.markSetlistSeen).toHaveBeenCalledTimes(1);
  });

  it('ein entfernter Punkt allein reicht zum Quittieren', async () => {
    zeige({ ...BASIS, items: [punkt({ changed: false }), punkt({ id: 9, removed: true })] });
    await vi.waitFor(() => expect(api.markSetlistSeen).toHaveBeenCalled());
  });
});
