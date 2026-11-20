// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { KEINE_SCHRIFT, Schriftspeicher, type Lader } from './schriftLader';
import { useSchriften } from './useSchriften';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useSchriften', () => {
  it('lädt nur die gebrauchten Dateien; bis dahin data:, danach die Adresse – mit NEUER Funktion (die Vorschau zeichnet neu)', async () => {
    const a = vi.fn(() => Promise.resolve('data:a'));
    const b = vi.fn(() => Promise.resolve('data:b'));
    const speicher = new Schriftspeicher({ 'a.woff2': a, 'b.woff2': b });
    const { result } = renderHook(() => useSchriften(['a.woff2'], speicher));
    const erste = result.current.adresse;
    expect(erste('a.woff2')).toBe(KEINE_SCHRIFT);
    await waitFor(() => expect(result.current.adresse('a.woff2')).toBe('data:a'));
    expect(result.current.adresse).not.toBe(erste);
    expect(b).not.toHaveBeenCalled();
    expect(result.current.adresse('b.woff2')).toBe(KEINE_SCHRIFT);
  });

  it('eine andere Wahl lädt die neue Schrift nach, die alte bleibt im Zwischenspeicher (kein zweites Laden beim Zurückwechseln)', async () => {
    const a = vi.fn(() => Promise.resolve('data:a'));
    const b = vi.fn(() => Promise.resolve('data:b'));
    const speicher = new Schriftspeicher({ 'a.woff2': a, 'b.woff2': b });
    const { result, rerender } = renderHook(({ d }) => useSchriften(d, speicher), {
      initialProps: { d: ['a.woff2'] },
    });
    await waitFor(() => expect(result.current.adresse('a.woff2')).toBe('data:a'));
    rerender({ d: ['b.woff2'] });
    await waitFor(() => expect(result.current.adresse('b.woff2')).toBe('data:b'));
    rerender({ d: ['a.woff2'] });
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('LADEFEHLER: `fehler` ist an, die Adresse bleibt die Ersatzschrift – „nochmal“ versucht es erneut und der Hinweis verschwindet', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let n = 0;
    const lader: Lader = () =>
      ++n === 1 ? Promise.reject(new Error('x')) : Promise.resolve('data:a');
    const speicher = new Schriftspeicher({ 'a.woff2': lader });
    const { result } = renderHook(() => useSchriften(['a.woff2'], speicher));
    await waitFor(() => expect(result.current.fehler).toBe(true));
    expect(result.current.adresse('a.woff2')).toBe(KEINE_SCHRIFT);
    act(() => result.current.nochmal());
    await waitFor(() => expect(result.current.adresse('a.woff2')).toBe('data:a'));
    expect(result.current.fehler).toBe(false);
    expect(n).toBe(2);
  });

  it('keine Dateien gebraucht: nichts wird geladen, kein Hinweis', () => {
    const a = vi.fn(() => Promise.resolve('data:a'));
    const speicher = new Schriftspeicher({ 'a.woff2': a });
    const { result } = renderHook(() => useSchriften([], speicher));
    expect(a).not.toHaveBeenCalled();
    expect(result.current.fehler).toBe(false);
  });
});
