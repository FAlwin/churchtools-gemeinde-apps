// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import * as L from './lesen';
import { useNaechsterTermin } from './naechsterTermin';
import type { GebetsTermin } from '@shared/gebetsabend/termin';

vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeEinstellungen: vi.fn(),
  ladeTermin: vi.fn(),
}));
const einstellungen = vi.mocked(L.ladeEinstellungen);
const termin = vi.mocked(L.ladeTermin);
const TERMIN = (titel: string): GebetsTermin => ({
  id: 1,
  titel,
  beginn: '2026-11-13T18:30:00Z',
  ende: null,
});

function Termin({ aktualisiert }: { aktualisiert?: number }) {
  const t = useNaechsterTermin(29, 80, aktualisiert);
  return <p>{t ? t.titel : 'kein Termin'}</p>;
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

  it('beim Neuladen bleibt der alte Termin stehen, bis der neue da ist – die Karte springt nicht um', async () => {
    einstellungen.mockResolvedValue({ kalender: 1, suchwort: 'Gebet' });
    termin.mockResolvedValueOnce(TERMIN('Gebetsabend alt'));
    const { rerender, container } = render(<Termin />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toBe('Gebetsabend alt');

    let neu!: (t: GebetsTermin) => void;
    termin.mockReturnValueOnce(new Promise((ja) => (neu = ja)));
    rerender(<Termin aktualisiert={1} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toBe('Gebetsabend alt');
    await act(async () => neu(TERMIN('Gebetsabend neu')));
    expect(container.textContent).toBe('Gebetsabend neu');
  });

  it('scheitert das Neuladen, bleibt der alte Termin stehen (vorübergehend ist nicht ungültig)', async () => {
    einstellungen.mockResolvedValue({ kalender: 1, suchwort: 'Gebet' });
    termin.mockResolvedValueOnce(TERMIN('Gebetsabend alt'));
    const { rerender, container } = render(<Termin />);
    await act(async () => {
      await Promise.resolve();
    });
    termin.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    rerender(<Termin aktualisiert={1} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(termin).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('Gebetsabend alt');
  });
});
