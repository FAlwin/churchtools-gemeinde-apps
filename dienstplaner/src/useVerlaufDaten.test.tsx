// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { endeStelle, liveListe } from '@shared/ct/liveAgenda';
import { wechselAus, zusammenfuehren, type Wechsel } from '@shared/ct/liveVerlauf';
import { schnittSchluessel } from '@shared/ct/liveRueckblick';
import type { CtAgendaItem } from '@shared/ct/typen';
import { schnittKurz, useVerlaufDaten } from './useVerlaufDaten';
import type { ladeAlleVerlaeufe } from './ladeVerlauf';

const liste = liveListe(
  [
    { id: 1, title: 'Begrüßung', type: 'normal', duration: 600 },
    { id: 2, title: 'Lied', type: 'song', duration: 300, song: { title: 'X' } },
  ] as CtAgendaItem[],
  7,
);
const verlauf = (schritte: [number, number][]): Wechsel[] =>
  schritte.reduce<Wechsel[]>(
    (acc, [s, sek]) => zusammenfuehren(acc, [wechselAus(liste, s, 1_800_000_000_000 + sek * 1000)]),
    [],
  );
const BEENDET = verlauf([
  [1, 0],
  [2, 480],
  [endeStelle(liste), 780],
]);

type Laden = typeof ladeAlleVerlaeufe;
const mit = (r: Awaited<ReturnType<Laden>>) => vi.fn<Laden>(() => Promise.resolve(r));

describe('useVerlaufDaten', () => {
  it('liefert die Verläufe und den daraus gerechneten Schnitt', async () => {
    const laden = mit({ ok: true, termine: new Map([[7, { wechsel: BEENDET, ausnahmen: [] }]]) });
    const { result } = renderHook(() => useVerlaufDaten(true, laden));
    await waitFor(() => expect(result.current.termine).not.toBeNull());
    expect(result.current.schnitt?.get(schnittSchluessel('Begrüßung', false)!)).toEqual({
      sek: 480,
      n: 1,
    });
    expect(schnittKurz(result.current.schnitt, 'Begrüßung', false)).toBe('Ø 8:00');
    expect(schnittKurz(result.current.schnitt, 'Gebet', false)).toBeNull();
    expect(schnittKurz(result.current.schnitt, 'Irgendein Lied', true)).toBe('Ø 5:00');
  });

  it('ausgeschaltet („Meine Anzeige“): es wird gar nicht gelesen', () => {
    const laden = mit({ ok: true, termine: new Map() });
    const { result } = renderHook(() => useVerlaufDaten(false, laden));
    expect(laden).not.toHaveBeenCalled();
    expect(result.current.termine).toBeNull();
  });

  it('ein Fehler beim Lesen: keine Daten, kein Absturz', async () => {
    const laden = mit({ ok: false, grund: 'voruebergehend' });
    const { result } = renderHook(() => useVerlaufDaten(true, laden));
    await waitFor(() => expect(laden).toHaveBeenCalled());
    expect(result.current.termine).toBeNull();
    expect(result.current.schnitt).toBeNull();
    expect(schnittKurz(result.current.schnitt, 'Begrüßung', false)).toBeNull();
  });

  it('`neuLesen` liest neu; die alten Daten bleiben dabei stehen', async () => {
    let fertig: (r: Awaited<ReturnType<Laden>>) => void = () => {};
    const laden = vi
      .fn<Laden>()
      .mockResolvedValueOnce({
        ok: true,
        termine: new Map([[7, { wechsel: BEENDET, ausnahmen: [] }]]),
      })
      .mockImplementationOnce(() => new Promise((r) => (fertig = r)));
    const { result } = renderHook(() => useVerlaufDaten(true, laden));
    await waitFor(() => expect(result.current.termine).not.toBeNull());
    act(() => result.current.neuLesen());
    expect(laden).toHaveBeenCalledTimes(2);
    expect(result.current.termine).not.toBeNull();
    await act(async () => fertig({ ok: true, termine: new Map() }));
    await waitFor(() => expect(result.current.termine?.size).toBe(0));
  });

  it('`setzeTermin` ersetzt den Verlauf eines Termins sofort', async () => {
    const laden = mit({ ok: true, termine: new Map([[7, { wechsel: BEENDET, ausnahmen: [] }]]) });
    const { result } = renderHook(() => useVerlaufDaten(true, laden));
    await waitFor(() => expect(result.current.termine).not.toBeNull());
    act(() =>
      result.current.setzeTermin(7, {
        wechsel: BEENDET,
        ausnahmen: [{ punkt: null, zeit: 1, aus: true }],
      }),
    );
    expect(result.current.termine?.get(7)?.ausnahmen).toHaveLength(1);
    // Der Termin ist ausgenommen: der Schnitt rechnet ihn nicht mehr
    expect(result.current.schnitt?.size).toBe(0);
  });
});
