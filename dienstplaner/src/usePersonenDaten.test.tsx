// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { GruppenStand } from '@shared/dienstplan/personenDaten';
import type { PersonenLader } from './ladePersonen';
import { usePersonenDaten } from './usePersonenDaten';

const da = (n: number): GruppenStand => ({
  art: 'da',
  mitglieder: Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `P${i + 1}`,
    bild: null,
    initialen: 'P',
  })),
  abwesenheiten: [],
});

describe('usePersonenDaten', () => {
  it('lädt die Gruppen und neu, sobald sich der Zeitraum ändert – der bisherige Stand bleibt, auch wenn das Neuladen scheitert', async () => {
    const lader = vi
      .fn<PersonenLader>()
      .mockResolvedValueOnce(new Map([[9, da(2)]]))
      .mockRejectedValueOnce(new ApiError(504, 'Zeitüberschreitung'));
    const { result, rerender } = renderHook(
      ({ bis }) => usePersonenDaten(lader, [9], { von: '2026-12-01', bis }),
      { initialProps: { bis: '2026-12-31' } },
    );
    expect(result.current.laedt).toBe(true);
    await waitFor(() => expect(result.current.daten.get(9)).toBeDefined());

    rerender({ bis: '2027-01-31' });
    await waitFor(() => expect(result.current.neuFehler).not.toBeNull());
    // Vorübergehend ist nicht ungültig: die Daten stehen noch da.
    expect(result.current.daten.get(9)).toBeDefined();
    expect(result.current.fehler).toBeNull();
    expect(lader).toHaveBeenLastCalledWith([9], '2026-12-01', '2027-01-31');
  });

  it('ohne Gruppen oder Lader wird nichts geladen', () => {
    const lader = vi.fn<PersonenLader>();
    renderHook(() => usePersonenDaten(lader, [], { von: '2026-12-01', bis: '2026-12-31' }));
    renderHook(() => usePersonenDaten(undefined, [9], { von: '2026-12-01', bis: '2026-12-31' }));
    expect(lader).not.toHaveBeenCalled();
  });

  it('nochmal(ids) holt nur diese Gruppen und führt sie in den Bestand ein; währenddessen sind sie „ladend“', async () => {
    const fehler: GruppenStand = { art: 'fehler', text: 'weg', nochmal: true };
    let fertig: (m: Map<number, GruppenStand>) => void = () => {};
    const lader = vi
      .fn<PersonenLader>()
      .mockResolvedValueOnce(
        new Map<number, GruppenStand>([
          [7, da(1)],
          [9, fehler],
        ]),
      )
      .mockImplementationOnce(() => new Promise((r) => (fertig = r)));
    const { result } = renderHook(() =>
      usePersonenDaten(lader, [7, 9], { von: '2026-12-01', bis: '2026-12-31' }),
    );
    await waitFor(() => expect(result.current.daten.get(9)).toEqual(fehler));

    let versuch: Promise<void> = Promise.resolve();
    act(() => {
      versuch = result.current.nochmal([9]);
    });
    expect(result.current.ladend.has(9)).toBe(true);
    await act(async () => {
      fertig(new Map([[9, da(3)]]));
      await versuch;
    });
    expect(result.current.ladend.has(9)).toBe(false);
    expect(lader).toHaveBeenLastCalledWith([9], '2026-12-01', '2026-12-31');
    expect(result.current.daten.get(9)).toMatchObject({ art: 'da' });
    expect(result.current.daten.get(7)).toMatchObject({ art: 'da' }); // der Rest blieb stehen
  });

  it('scheitert das Wiederholen (401), steht der Fehler an diesen Gruppen – ohne „Nochmal“, der Rest bleibt', async () => {
    const lader = vi
      .fn<PersonenLader>()
      .mockResolvedValueOnce(
        new Map<number, GruppenStand>([
          [7, da(1)],
          [9, { art: 'fehler', text: 'weg', nochmal: true }],
        ]),
      )
      .mockRejectedValueOnce(new ApiError(401, 'ab'));
    const { result } = renderHook(() =>
      usePersonenDaten(lader, [7, 9], { von: '2026-12-01', bis: '2026-12-31' }),
    );
    await waitFor(() => expect(result.current.daten.get(9)?.art).toBe('fehler'));
    await act(async () => {
      await result.current.nochmal([9]);
    });
    expect(result.current.daten.get(9)).toMatchObject({ art: 'fehler', nochmal: false });
    expect(result.current.daten.get(7)).toMatchObject({ art: 'da' });
  });
});
