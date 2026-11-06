// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as B from './ladeBeiwerk';
import { useMusikApp } from './useMusikApp';

vi.mock('./ladeBeiwerk', () => ({ ladeMusikApp: vi.fn() }));
const laden = vi.mocked(B.ladeMusikApp);

describe('useMusikApp (#845)', () => {
  it('fragt nach und gibt die Adresse; ohne `aktiv` wird gar nicht gefragt', async () => {
    laden.mockResolvedValue('https://ct.test/ccm/musik-app/');
    const { result, rerender } = renderHook(({ aktiv }: { aktiv: boolean }) => useMusikApp(aktiv), {
      initialProps: { aktiv: false },
    });
    expect(result.current).toBeUndefined();
    expect(laden).not.toHaveBeenCalled();
    rerender({ aktiv: true });
    await waitFor(() => expect(result.current).toBe('https://ct.test/ccm/musik-app/'));
  });

  it('nicht installiert → null; scheitert die Abfrage → unbekannt (undefined)', async () => {
    laden.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useMusikApp());
    await waitFor(() => expect(result.current).toBeNull());
    laden.mockRejectedValueOnce(new Error('503'));
    const fehler = renderHook(() => useMusikApp());
    await waitFor(() => expect(laden).toHaveBeenCalledTimes(2));
    expect(fehler.result.current).toBeUndefined();
  });
});
