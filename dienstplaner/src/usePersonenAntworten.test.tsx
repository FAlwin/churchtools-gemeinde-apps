// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { KEINE_ANTWORTEN, type PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import { antwortBereinigt } from '@shared/dienstplan/verfuegbarkeit';
import type { AntwortenLader } from './ladeAntworten';
import { usePersonenAntworten } from './usePersonenAntworten';

const DA: PersonenAntworten = {
  jePerson: new Map([[5, { '20': antwortBereinigt({ a: 'ja', tag: '2026-10-18' }) }]]),
  sichtbar: new Set([4]),
};

afterEach(cleanup);

describe('usePersonenAntworten', () => {
  it('lädt für die Dienstgruppen; ohne Gruppen oder Lader gibt es nichts zu laden', async () => {
    const lader = vi.fn<AntwortenLader>(() => Promise.resolve(DA));
    const { result } = renderHook(() => usePersonenAntworten(lader, [4, 3]));
    await waitFor(() => expect(result.current.antworten).toBe(DA));
    expect(lader).toHaveBeenCalledWith([4, 3]);
    const leer = renderHook(() => usePersonenAntworten(lader, []));
    expect(leer.result.current.antworten).toBe(KEINE_ANTWORTEN);
    expect(lader).toHaveBeenCalledTimes(1);
  });

  it('Neuladen scheitert vorübergehend: die bisherigen Antworten bleiben, der Fehler steht daneben', async () => {
    const lader = vi
      .fn<AntwortenLader>()
      .mockResolvedValueOnce(DA)
      .mockRejectedValueOnce(new ApiError(503, 'Gerade nicht'));
    const { result, rerender } = renderHook(({ ids }) => usePersonenAntworten(lader, ids), {
      initialProps: { ids: [4] },
    });
    await waitFor(() => expect(result.current.antworten).toBe(DA));
    rerender({ ids: [4, 3] }); // andere Dienstgruppen → neu laden
    await waitFor(() => expect(result.current.neuFehler).not.toBeNull());
    expect(result.current.antworten).toBe(DA); // nicht „keine Antworten“
    expect(result.current.fehler).toBeNull();
    expect(result.current.neuFehler?.nochmal).toBe(true);
    expect(result.current.neuFehler?.text).toMatch(/Antworten aus „Verfügbarkeit“/);
  });

  it('der erste Abruf scheitert: kein Bestand – leer (nichts sichtbar) und ein Fehler; 401 ohne „nochmal“', async () => {
    // Der Lader muss stabil sein (App: `useCallback`) – ein neuer je Zeichnen lüde endlos.
    const vorlaeufig = vi.fn<AntwortenLader>(() => Promise.reject(new ApiError(504, 'x')));
    const a = renderHook(() => usePersonenAntworten(vorlaeufig, [4]));
    await waitFor(() => expect(a.result.current.fehler).not.toBeNull());
    expect(a.result.current.antworten.sichtbar.size).toBe(0);
    expect(a.result.current.fehler?.nochmal).toBe(true);
    const ab = vi.fn<AntwortenLader>(() => Promise.reject(new ApiError(401, 'x')));
    const b = renderHook(() => usePersonenAntworten(ab, [4]));
    await waitFor(() => expect(b.result.current.fehler).not.toBeNull());
    expect(b.result.current.fehler?.nochmal).toBe(false);
  });
});
