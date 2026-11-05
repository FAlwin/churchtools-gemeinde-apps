// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import * as L from './lesen';
import { NaechsterTermin } from './TerminKarte';

vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeEinstellungen: vi.fn(),
  ladeTermin: vi.fn(),
}));
const einstellungen = vi.mocked(L.ladeEinstellungen);
const termin = vi.mocked(L.ladeTermin);

describe('NaechsterTermin', () => {
  it('nach gespeicherten Einstellungen (G3) lädt der Termin neu – sonst stünde der alte bis zum Neuladen da', async () => {
    einstellungen.mockResolvedValue({ kalender: 1, suchwort: 'Gebet' });
    termin.mockResolvedValue(null);
    const { rerender } = render(<NaechsterTermin modul={29} kategorie={80} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(einstellungen).toHaveBeenCalledTimes(1);
    rerender(<NaechsterTermin modul={29} kategorie={80} aktualisiert={1} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(einstellungen).toHaveBeenCalledTimes(2);
  });
});
