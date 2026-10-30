// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DatenDatei } from '@shared/ct/personenAblage';
import {
  ABGLEICH_NACH_MS,
  MERK,
  useToDoEinstellungen,
  type Abgleich,
} from './useToDoEinstellungen';

/**
 * Einstellungen der To-Do-Übersicht je Benutzer (S7-3). Der Weg nach ChurchTools ist eine Attrappe (was er tut, prüft
 * `shared/ct/personenAblage.daten.test.ts`); hier: wann abgeglichen wird und dass im Gerät nie etwas verloren geht.
 * Fake-Timer: Sonst erledigte der echte Timer die Arbeit, die der Test dem Code zuschreibt.
 */
const datei = (felder: Record<string, [unknown, number]>): DatenDatei => ({
  v: 1,
  felder: Object.fromEntries(Object.entries(felder).map(([k, [w, t]]) => [k, { w, t }])),
});
const imGeraet = () => JSON.parse(localStorage.getItem(MERK) ?? 'null') as DatenDatei | null;
/** Eine ChurchTools-Attrappe, die zusammenführt wie die echte (jüngere gewinnt) und sich den Stand merkt. */
function dort(start: DatenDatei = datei({})) {
  let stand = start;
  const fn = vi.fn<Abgleich>((lokal) => {
    const felder = { ...stand.felder };
    for (const [k, f] of Object.entries(lokal.felder))
      if (!felder[k] || f.t >= felder[k].t) felder[k] = f;
    stand = { v: 1, felder };
    return Promise.resolve(stand);
  });
  return { fn, stand: () => stand };
}
let uhr = 1000;
const jetzt = () => uhr;
const fertig = () => act(() => vi.advanceTimersByTimeAsync(0));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  uhr = 1000;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe('useToDoEinstellungen', () => {
  it('beim Öffnen: Gerät sofort, dann aus ChurchTools zusammengeführt (das iPad hat inzwischen „Board“ gewählt)', async () => {
    localStorage.setItem(MERK, JSON.stringify(datei({ nach: ['person', 500] })));
    const d = dort(datei({ ansicht: ['board', 900] }));
    const { result } = renderHook(() => useToDoEinstellungen({ jetzt, abgleich: d.fn }));
    expect(result.current[0]).toMatchObject({ nach: 'person', ansicht: 'liste' });
    await fertig();
    expect(result.current[0]).toMatchObject({ nach: 'person', ansicht: 'board' });
    expect(imGeraet()!.felder.ansicht).toEqual({ w: 'board', t: 900 });
    expect(d.fn).toHaveBeenCalledTimes(1);
  });

  it('Änderung: sofort im Gerät, nach ChurchTools erst nach der Pause – viele Änderungen ein Abgleich', async () => {
    const d = dort();
    const { result } = renderHook(() => useToDoEinstellungen({ jetzt, abgleich: d.fn }));
    await fertig();
    d.fn.mockClear();
    act(() => result.current[1]({ sortierung: 'alpha' }));
    act(() => result.current[1]({ ansicht: 'board' }));
    expect(result.current[0]).toMatchObject({ sortierung: 'alpha', ansicht: 'board' });
    expect(imGeraet()!.felder.sortierung.w).toBe('alpha');
    await act(() => vi.advanceTimersByTimeAsync(ABGLEICH_NACH_MS - 1));
    expect(d.fn).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(d.fn).toHaveBeenCalledTimes(1);
    expect(d.stand().felder.ansicht.w).toBe('board');
  });

  it('ChurchTools antwortet nicht: alles bleibt im Gerät; die nächste Änderung holt es nach', async () => {
    const d = dort();
    d.fn.mockRejectedValueOnce(new Error('504')).mockRejectedValueOnce(new Error('504'));
    const { result } = renderHook(() => useToDoEinstellungen({ jetzt, abgleich: d.fn }));
    await fertig();
    act(() => result.current[1]({ sortierung: 'bis' }));
    await act(() => vi.advanceTimersByTimeAsync(ABGLEICH_NACH_MS));
    expect(result.current[0].sortierung).toBe('bis');
    expect(imGeraet()!.felder.sortierung.w).toBe('bis');
    act(() => result.current[1]({ ansicht: 'board' }));
    await act(() => vi.advanceTimersByTimeAsync(ABGLEICH_NACH_MS));
    expect(d.stand().felder).toMatchObject({ sortierung: { w: 'bis' }, ansicht: { w: 'board' } });
  });

  it('Änderung während eines laufenden Abgleichs: bleibt (jünger) und geht gleich danach mit', async () => {
    let loslassen: () => void = () => {};
    const d = dort();
    const echt = d.fn.getMockImplementation()!;
    d.fn.mockImplementationOnce(
      (lokal) => new Promise((ok) => (loslassen = () => ok(echt(lokal)))),
    );
    const { result } = renderHook(() => useToDoEinstellungen({ jetzt, abgleich: d.fn }));
    uhr = 2000;
    act(() => result.current[1]({ sortierung: 'manuell' }));
    await act(async () => {
      loslassen();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current[0].sortierung).toBe('manuell');
    expect(d.fn).toHaveBeenCalledTimes(2);
    expect(d.stand().felder.sortierung.w).toBe('manuell');
  });

  it('Seite weggelegt: Ausstehendes sofort, nicht erst nach der Pause', async () => {
    const d = dort();
    const { result } = renderHook(() => useToDoEinstellungen({ jetzt, abgleich: d.fn }));
    await fertig();
    d.fn.mockClear();
    act(() => result.current[1]({ ansicht: 'board' }));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await fertig();
    expect(d.fn).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('übernimmt einmal, was S7-1 im Gerät gemerkt hat – älter als alles, was anderswo gespeichert ist', async () => {
    localStorage.setItem('protokolle.todos.nach', JSON.stringify('person'));
    localStorage.setItem(
      'protokolle.todos.aus',
      JSON.stringify({ gruppen: ['194'], zustaendig: [] }),
    );
    const d = dort(datei({ nach: ['status', 5] }));
    const { result } = renderHook(() => useToDoEinstellungen({ jetzt, abgleich: d.fn }));
    expect(result.current[0]).toMatchObject({ nach: 'person', aus: { gruppen: ['194'] } });
    await fertig();
    expect(result.current[0].nach).toBe('status');
    expect(result.current[0].aus.gruppen).toEqual(['194']);
  });
});
