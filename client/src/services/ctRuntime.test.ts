import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ctAnfrage, ctBasis, fehlerAus, KeinSpeicherRecht, _vergissCsrf } from './ctRuntime';
import { ApiError } from './api';
import { urlVon } from './ctFake.testutil';

/**
 * Die Übersetzung der ChurchTools-Fehler in der Extension (#334). Der heikle Fall, gemessen am
 * 07.10.2026: Ein fehlendes Recht beantwortet ChurchTools mit **401 „Die Session ist abgelaufen"**.
 * Jeder Zweig von `fehlerAus` hat hier einen eigenen Test.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** `/whoami` antwortet so – alles andere ist hier nicht gefragt. */
function whoamiAntwortet(antwort: () => Promise<Response>): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    if (urlVon(input).endsWith('/api/whoami')) return antwort();
    return Promise.resolve(json(404, {}));
  });
}

beforeEach(() => {
  _vergissCsrf();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fehlerAus – 401', () => {
  const antwort401 = () => json(401, { message: 'Keine ausreichende Berechtigung.' });

  it('jemand angemeldet → fehlendes Recht, NICHT abgemeldet', async () => {
    whoamiAntwortet(() => Promise.resolve(json(200, { data: { id: 19 } })));
    const e = await fehlerAus(antwort401(), {});
    expect(e).toBeInstanceOf(KeinSpeicherRecht);
  });

  it('niemand angemeldet (id -1, #381) → abgemeldet', async () => {
    whoamiAntwortet(() => Promise.resolve(json(200, { data: { id: -1 } })));
    const e = await fehlerAus(antwort401(), {});
    expect(e).not.toBeInstanceOf(KeinSpeicherRecht);
    expect(e.status).toBe(401);
  });

  it('whoami antwortet nicht → vorübergehend: weder abgemeldet noch kein Recht', async () => {
    whoamiAntwortet(() => Promise.reject(new TypeError('Failed to fetch')));
    const e = await fehlerAus(antwort401(), {});
    expect(e).not.toBeInstanceOf(KeinSpeicherRecht);
    expect(e.status).not.toBe(401);
  });
});

describe('fehlerAus – 403', () => {
  it('Verbot mit ChurchTools-Rumpf → fehlendes Recht', async () => {
    const body = { message: 'Forbidden to edit person files', messageKey: 'error.forbidden.edit' };
    expect(await fehlerAus(json(403, body), body)).toBeInstanceOf(KeinSpeicherRecht);
  });

  it('403 ohne ChurchTools-Rumpf (Proxy) → vorübergehend, kein dauerhaftes Abschalten', async () => {
    const e = await fehlerAus(new Response('<html>Forbidden</html>', { status: 403 }), '<html>');
    expect(e).toBeInstanceOf(ApiError);
    expect(e).not.toBeInstanceOf(KeinSpeicherRecht);
  });
});

describe('ctAnfrage', () => {
  it('nutzt die Adresse aus window.settings, nicht die der Seite', async () => {
    expect(ctBasis()).toBe('https://ct.test');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { data: 1 }));
    await ctAnfrage('/whoami');
    expect(String(spy.mock.calls[0][0])).toBe('https://ct.test/api/whoami');
  });

  it('übersetzt eine ChurchTools-Meldung (translatedMessage vor message)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(400, { message: 'There are validation errors', translatedMessage: 'Eingabe falsch.' }),
    );
    await expect(ctAnfrage('/irgendwas')).rejects.toThrow('Eingabe falsch.');
  });
});
