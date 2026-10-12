// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { RUECKGAENGIG_MS, useRueckgaengig } from './useRueckgaengig';

/**
 * Der Takt von „Rückgängig" (12.10.2026) – mit Fake-Timern, sonst prüfte der Test die Uhr des Rechners.
 */
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useRueckgaengig', () => {
  it('steht bis kurz vor Ablauf bereit und verschwindet dann von selbst', () => {
    const { result } = renderHook(() => useRueckgaengig());
    act(() => result.current.anbieten('„Gebet" gelöscht', () => Promise.resolve()));
    expect(result.current.angebot).toBe('„Gebet" gelöscht');
    act(() => void vi.advanceTimersByTime(RUECKGAENGIG_MS - 1));
    expect(result.current.angebot).toBe('„Gebet" gelöscht');
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.angebot).toBeNull();
  });

  it('eine neue Änderung ersetzt das alte Angebot – und startet die Zeit neu', async () => {
    const alt = vi.fn(() => Promise.resolve());
    const neu = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useRueckgaengig());
    act(() => result.current.anbieten('alt', alt));
    act(() => void vi.advanceTimersByTime(RUECKGAENGIG_MS - 1000));
    act(() => result.current.anbieten('neu', neu));
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.angebot).toBe('neu');
    await act(() => result.current.ausloesen());
    expect(neu).toHaveBeenCalledTimes(1);
    expect(alt).not.toHaveBeenCalled();
  });

  it('löst höchstens einmal aus – der Hinweis ist schon weg, bevor geschrieben wird', async () => {
    const tun = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useRueckgaengig());
    act(() => result.current.anbieten('x', tun));
    const erst = result.current.ausloesen;
    await act(() => erst());
    expect(result.current.angebot).toBeNull();
    await act(() => result.current.ausloesen());
    expect(tun).toHaveBeenCalledTimes(1);
  });

  it('verwerfen nimmt das Angebot zurück, ohne etwas zu tun', async () => {
    const tun = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useRueckgaengig());
    act(() => result.current.anbieten('x', tun));
    act(() => result.current.verwerfen());
    expect(result.current.angebot).toBeNull();
    await act(() => result.current.ausloesen());
    expect(tun).not.toHaveBeenCalled();
  });
});
