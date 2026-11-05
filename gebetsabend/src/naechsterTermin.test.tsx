// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import * as L from './lesen';
import { useNaechsterTermin } from './naechsterTermin';

vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeEinstellungen: vi.fn(),
  ladeTermin: vi.fn(),
}));
const einstellungen = vi.mocked(L.ladeEinstellungen);
const termin = vi.mocked(L.ladeTermin);

function Termin({ aktualisiert }: { aktualisiert?: number }) {
  useNaechsterTermin(29, 80, aktualisiert);
  return null;
}

describe('useNaechsterTermin', () => {
  it('nach gespeicherten Einstellungen (G3) lädt der Termin neu – sonst stünde der alte bis zum Neuladen da', async () => {
    einstellungen.mockResolvedValue({ kalender: 1, suchwort: 'Gebet' });
    termin.mockResolvedValue(null);
    const { rerender } = render(<Termin />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(einstellungen).toHaveBeenCalledTimes(1);
    rerender(<Termin aktualisiert={1} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(einstellungen).toHaveBeenCalledTimes(2);
  });
});
