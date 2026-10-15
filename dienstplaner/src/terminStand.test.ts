import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ladeTerminStaende } from './terminStand';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ladeTerminStaende (#582)', () => {
  it('da (Name, Tag in der Zeitzone) / 404 = weg / alles andere = unbekannt; jeder Termin einmal', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const id = Number(/events\/(\d+)/.exec(String(input))![1]);
      if (id === 1) {
        return Promise.resolve(
          json(200, { data: { id: 1, name: 'Gottesdienst', startDate: '2026-10-03T22:30:00Z' } }),
        );
      }
      if (id === 2) return Promise.resolve(json(404, { messageKey: 'error.notfound' }));
      if (id === 3) return Promise.resolve(json(502, { message: 'weg' }));
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    const m = await ladeTerminStaende([1, 2, 3, 4, 1], 'Europe/Berlin');
    // 22:30 UTC am 03.10. ist in Berlin schon der 04.10.
    expect(m.get(1)).toEqual({ art: 'da', name: 'Gottesdienst', tag: '2026-10-04' });
    expect(m.get(2)).toEqual({ art: 'weg' });
    expect(m.get(3)).toEqual({ art: 'unbekannt' });
    expect(m.get(4)).toEqual({ art: 'unbekannt' });
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('höchstens 4 Abfragen gleichzeitig', async () => {
    let laufen = 0;
    let hoechstens = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      laufen++;
      hoechstens = Math.max(hoechstens, laufen);
      await new Promise((r) => setTimeout(r, 5));
      laufen--;
      return json(404, {});
    });
    await ladeTerminStaende([1, 2, 3, 4, 5, 6, 7], 'Europe/Berlin');
    expect(hoechstens).toBe(4);
  });
});
