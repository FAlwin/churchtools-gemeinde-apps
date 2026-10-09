// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useWerkzeugSteuerung } from './useWerkzeugSteuerung';

/**
 * Die Werkzeug-Knöpfe des Liedblatts (#465). Die Regel, um die es geht: Jeder Knopf setzt das
 * Fenster-Feld genau EINMAL – ein zweites Setzen machte das gerade geöffnete Fenster wieder zu.
 */
function aufbau(songId = 1, viewing = false) {
  const p = {
    songId,
    setOverlay: vi.fn(),
    setDrawMode: vi.fn(),
    viewing,
    openSharers: vi.fn(),
    stopViewing: vi.fn(),
    vollbildUmschalten: vi.fn(),
  };
  return p;
}

describe('useWerkzeugSteuerung', () => {
  it('Aussehen/Tempo öffnen ihr Fenster mit EINEM Setzen', () => {
    const p = aufbau();
    const { result } = renderHook(() => useWerkzeugSteuerung(p));
    act(() => result.current.onAppearance());
    act(() => result.current.onTempo());
    expect(p.setOverlay.mock.calls).toEqual([['appearance'], ['tempo']]);
  });

  it('Anmerken schließt das Fenster und schaltet um; Zoom zurück erhöht das Signal', () => {
    const p = aufbau();
    const { result } = renderHook(() => useWerkzeugSteuerung(p));
    act(() => result.current.onToggleDraw());
    expect(p.setOverlay).toHaveBeenCalledWith(null);
    expect(p.setDrawMode).toHaveBeenCalledTimes(1);
    act(() => result.current.onResetZoom());
    expect(result.current.resetZoomSignal).toBe(1);
  });

  it('Team-Notizen: beim Ansehen beenden, sonst die Liste öffnen', () => {
    const ansehen = aufbau(1, true);
    renderHook(() => useWerkzeugSteuerung(ansehen)).result.current.onToggleTeamNotes();
    expect(ansehen.stopViewing).toHaveBeenCalled();
    const nicht = aufbau(1, false);
    renderHook(() => useWerkzeugSteuerung(nicht)).result.current.onToggleTeamNotes();
    expect(nicht.openSharers).toHaveBeenCalled();
  });

  it('Werkzeug des anderen Lieds öffnet erst NACH dem Liedwechsel – und Anmerken schaltet EIN', () => {
    const p = aufbau(1);
    const { result, rerender } = renderHook((props) => useWerkzeugSteuerung(props), {
      initialProps: p,
    });
    act(() => result.current.nachLiedwechsel('anmerken'));
    expect(p.setDrawMode).not.toHaveBeenCalled();
    rerender({ ...p, songId: 2 });
    expect(p.setDrawMode).toHaveBeenCalledWith(true);
  });
});
