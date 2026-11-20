// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVorlagenSeite } from './useVorlagenSeite';

/**
 * Termine ↔ Ablaufvorlagen ↔ Vorlage (E10-V3b, R13): Der Zustand, den `App` für die Unterseite hält. Er überlebt keinen
 * Reiterwechsel – auch nicht das erneute Tippen auf „Termine“.
 */
describe('useVorlagenSeite', () => {
  it('beginnt auf der Terminliste', () => {
    const { result } = renderHook(() => useVorlagenSeite());
    expect(result.current.offen).toBe(false);
    expect(result.current.vorlage).toBeNull();
  });

  it('„Ablaufvorlagen“ im ⋯ → Liste; Vorlage antippen → Vorlage; „‹ Vorlagen“ → Liste; „‹ Termine“ → Terminliste', () => {
    const { result } = renderHook(() => useVorlagenSeite());
    act(() => result.current.vorlagenOeffnen());
    expect(result.current).toMatchObject({ offen: true, vorlage: null });
    act(() => result.current.vorlageOeffnen(7));
    expect(result.current).toMatchObject({ offen: true, vorlage: 7 });
    act(() => result.current.vorlageOeffnen(null));
    expect(result.current).toMatchObject({ offen: true, vorlage: null });
    act(() => result.current.zurueck());
    expect(result.current.offen).toBe(false);
  });

  it('Reiter gewechselt (oder „Termine“ erneut getippt) → zurück auf die Terminliste, auch aus einer offenen Vorlage', () => {
    const { result } = renderHook(() => useVorlagenSeite());
    act(() => result.current.vorlageOeffnen(7));
    act(() => result.current.reiterGewechselt());
    expect(result.current).toMatchObject({ offen: false, vorlage: null });
  });

  it('die Aufrufe bleiben dieselben Funktionen – sonst liefe jede Seite bei jedem Zeichnen neu an', () => {
    const { result, rerender } = renderHook(() => useVorlagenSeite());
    const vorher = result.current;
    rerender();
    act(() => result.current.vorlageOeffnen(3));
    expect(result.current.vorlageOeffnen).toBe(vorher.vorlageOeffnen);
    expect(result.current.zurueck).toBe(vorher.zurueck);
    expect(result.current.vorlagenOeffnen).toBe(vorher.vorlagenOeffnen);
  });
});
