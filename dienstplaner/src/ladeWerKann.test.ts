import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { _vergissWerKann, ladeWerKann, WER_KANN_MS } from './ladeWerKann';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  _vergissWerKann();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ladeWerKann', () => {
  it('fragt genau den Platz-Dienst ab (erst beim Öffnen, je Dienst)', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(200, { data: [{ score: 0 }] }));
    expect(await ladeWerKann(166, 6)).toEqual([{ score: 0 }]);
    expect(String(spy.mock.calls[0][0])).toBe(
      'https://ct.test/api/events/166/services/6/possiblepersons',
    );
  });

  it('kurz gemerkt: erneutes Öffnen lädt nicht; nach Ablauf wieder', async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(json(200, { data: [] })));
    await ladeWerKann(1, 6);
    await ladeWerKann(1, 6);
    expect(spy).toHaveBeenCalledTimes(1);
    await ladeWerKann(1, 7);
    expect(spy).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(WER_KANN_MS + 1);
    await ladeWerKann(1, 6);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('keine Liste → Fehler 502, nicht „niemand kann“ – und nicht gemerkt', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(200, { data: null }))
      .mockResolvedValueOnce(json(200, { data: [] }));
    const e = await ladeWerKann(1, 6).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(502);
    expect(await ladeWerKann(1, 6)).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Fehler von ChurchTools (500) wird nicht gemerkt – der nächste Versuch fragt neu', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(500, {}))
      .mockResolvedValueOnce(json(200, { data: [] }));
    await expect(ladeWerKann(1, 6)).rejects.toBeInstanceOf(ApiError);
    expect(await ladeWerKann(1, 6)).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
