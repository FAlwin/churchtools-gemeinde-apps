// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePlaetzeFrisch } from './usePlaetzeFrisch';

/** Plan und Entwürfe als Objekte – der Hook erkennt „neu geladen“ an einem ANDEREN Objekt. */
interface Stand {
  plan: { n: number };
  daten: { n: number } | null;
}

function aufbauen(anfang: Stand = { plan: { n: 1 }, daten: { n: 1 } }) {
  const planNeu = vi.fn();
  const entwuerfeNeu = vi.fn();
  const showToast = vi.fn();
  const r = renderHook(
    (s: Stand) =>
      usePlaetzeFrisch({
        plan: s.plan,
        daten: s.daten,
        planNeu,
        entwuerfeNeu,
        showToast,
        wartezeit: 1000,
      }),
    { initialProps: anfang },
  );
  return { ...r, planNeu, entwuerfeNeu, showToast };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('usePlaetzeFrisch', () => {
  it('ohne Änderung lädt nichts', () => {
    const { result, planNeu, entwuerfeNeu } = aufbauen();
    expect(result.current.laedt).toBe(false);
    expect(planNeu).not.toHaveBeenCalled();
    expect(entwuerfeNeu).not.toHaveBeenCalled();
  });

  it('ohne umgetragene Entwürfe: lädt nur den Plan neu und wartet nur auf ihn', () => {
    const daten = { n: 1 };
    const { result, rerender, planNeu, entwuerfeNeu } = aufbauen({ plan: { n: 1 }, daten });
    act(() => result.current.geaendert(false));
    expect(planNeu).toHaveBeenCalledTimes(1);
    expect(entwuerfeNeu).not.toHaveBeenCalled();
    expect(result.current.laedt).toBe(true);
    rerender({ plan: { n: 2 }, daten });
    expect(result.current.laedt).toBe(false);
  });

  it('mit umgetragenen Entwürfen: lädt beides und wartet auf BEIDES – ein neuer Plan allein reicht nicht', () => {
    const daten = { n: 1 };
    const { result, rerender, planNeu, entwuerfeNeu } = aufbauen({ plan: { n: 1 }, daten });
    act(() => result.current.geaendert(true));
    expect(planNeu).toHaveBeenCalledTimes(1);
    expect(entwuerfeNeu).toHaveBeenCalledTimes(1);
    // Der Plan ist da, die Entwürfe noch die alten …
    const plan = { n: 2 };
    rerender({ plan, daten });
    expect(result.current.laedt).toBe(true);
    // … werden gerade geladen (`null`) …
    rerender({ plan, daten: null });
    expect(result.current.laedt).toBe(true);
    // … und sind da.
    rerender({ plan, daten: { n: 2 } });
    expect(result.current.laedt).toBe(false);
  });

  it('neue Entwürfe allein reichen auch nicht – der Plan muss ebenfalls neu sein', () => {
    const plan = { n: 1 };
    const { result, rerender } = aufbauen({ plan, daten: { n: 1 } });
    act(() => result.current.geaendert(true));
    rerender({ plan, daten: { n: 2 } });
    expect(result.current.laedt).toBe(true);
    rerender({ plan: { n: 2 }, daten: { n: 2 } });
    expect(result.current.laedt).toBe(false);
  });

  it('verglichen wird mit dem Stand beim Aufruf, nicht mit dem beim ersten Zeichnen', () => {
    const { result, rerender } = aufbauen({ plan: { n: 1 }, daten: { n: 1 } });
    // Zwischen Öffnen und Abschluss der Änderung kam schon ein anderer Plan (z. B. ein früheres Neuladen).
    const zwischen = { plan: { n: 2 }, daten: { n: 2 } };
    rerender(zwischen);
    act(() => result.current.geaendert(false));
    rerender({ ...zwischen });
    expect(result.current.laedt).toBe(true);
  });

  it('kommt das Neuladen nicht, gibt die Zeitgrenze wieder frei – mit Meldung', () => {
    const { result, showToast } = aufbauen();
    act(() => result.current.geaendert(true));
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(result.current.laedt).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.laedt).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      'Die Plätze sind in ChurchTools gespeichert, der Plan ließ sich aber nicht neu laden. Bitte die Seite neu laden.',
    );
  });

  it('kam das Neuladen rechtzeitig, meldet die Zeitgrenze nichts mehr', () => {
    const daten = { n: 1 };
    const { result, rerender, showToast } = aufbauen({ plan: { n: 1 }, daten });
    act(() => result.current.geaendert(false));
    rerender({ plan: { n: 2 }, daten });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('eine zweite Änderung löst die erste ab – deren Zeitgrenze meldet nichts', () => {
    const { result, showToast } = aufbauen();
    act(() => result.current.geaendert(false));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => result.current.geaendert(false));
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(showToast).not.toHaveBeenCalled();
    expect(result.current.laedt).toBe(true);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});
