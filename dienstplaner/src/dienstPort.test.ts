import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { dienstPort } from './dienstPort';

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

describe('dienstPort (Browser-Anschluss des Schreibkerns)', () => {
  it('liest den Termin mit seinen Plätzen', async () => {
    const t = { id: 166, eventServices: [{ id: 753, serviceId: 9, index: 1 }] };
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { data: t }));
    expect(await dienstPort.termin(166)).toEqual(t);
    expect(String(spy.mock.calls[0][0])).toBe(
      'https://ct.test/api/events/166?include=eventServices',
    );
  });

  it('Termin ohne Platzliste (auch `{ data: null }`) → 502, nicht „Platz weg“', async () => {
    for (const rumpf of [{ data: null }, { data: { id: 166 } }]) {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, rumpf));
      await expect(dienstPort.termin(166)).rejects.toMatchObject({ status: 502 });
    }
  });

  it('schreibt mit Methode, JSON und CSRF', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input) =>
        Promise.resolve(
          String(input).endsWith('/csrftoken') ? json(200, { data: 'tok' }) : json(200, {}),
        ),
      );
    await dienstPort.schreibe('/events/166/servicerequests/807', {
      method: 'PUT',
      json: { personId: 46, name: null, isAccepted: false },
    });
    const [url, init] = spy.mock.calls.find((c) => String(c[0]).includes('servicerequests'))!;
    expect(String(url)).toBe('https://ct.test/api/events/166/servicerequests/807');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ personId: 46, name: null, isAccepted: false });
    expect((init?.headers as Record<string, string>)['CSRF-Token']).toBe('tok');
  });

  it('Verbot von ChurchTools → 403 mit dem Einteilen-Text', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        String(input).endsWith('/csrftoken')
          ? json(200, { data: 'tok' })
          : json(403, { messageKey: 'error.forbidden', message: 'Forbidden' }),
      ),
    );
    const f = await dienstPort
      .schreibe('/events/166/servicerequests/807', { method: 'PUT', json: {} })
      .catch((e: unknown) => e);
    expect(dienstPort.status(f)).toBe(403);
    expect((f as Error).message).toMatch(/erlaubt dir nicht, hier einzuteilen/);
  });

  it('Status: aus dem ApiError; Netzfehler ohne Status → null (vorübergehend)', () => {
    expect(dienstPort.status(new ApiError(504, 'x'))).toBe(504);
    expect(dienstPort.status(new TypeError('Failed to fetch'))).toBeNull();
  });
});
