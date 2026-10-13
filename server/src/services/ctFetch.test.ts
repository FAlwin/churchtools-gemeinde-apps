import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Request, Response as ExpressResponse, NextFunction } from 'express';
import { CtOverloadedError, CtTimeoutError, isCtOverloaded } from './ctHttp.js';
import { getEvents } from './ctRead.js';
import { deleteFile } from './ctWrite.js';
import { ctAjax } from './ctAjax.js';
import { getCsrfToken } from './ctCsrf.js';
import { login, logout } from './ctAuth.js';
import { downloadFileText } from './ctFiles.js';
import { CT_ANTWORTET_NICHT, errorHandler } from '../middleware/errorHandler.js';
import { BASE } from './ctHttp.js';

/**
 * #489: **Zeitüberschreitung bei ChurchTools ist 504, auf JEDEM Weg** – nicht 500.
 *
 * Vorher riefen neun Stellen `fetch` selbst auf. Nur der Datei-Download machte aus einer
 * Zeitüberschreitung einen 504; Lesen, Schreiben, Anmelden und die alte Schnittstelle ließen sie bis
 * zum `errorHandler` durch, und der meldete „Interner Serverfehler" mit Stacktrace. Jetzt geht alles
 * über `ctFetch`. Je Weg ein eigener Test: Stellt einer davon wieder auf eigenes `fetch` um, fällt
 * genau sein Test.
 */

/** So verhält sich `AbortSignal.timeout` beim Ablauf. */
function zeitueberschreitung(): Error {
  return Object.assign(new Error('The operation was aborted due to timeout'), {
    name: 'TimeoutError',
  });
}

/** CSRF-Token holen klappt, die eigentliche Anfrage läuft in die Zeitgrenze. */
function nurCsrfAntwortet(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url.endsWith('/api/csrftoken')
        ? Promise.resolve(new Response(JSON.stringify({ data: 'csrf' }), { status: 200 }))
        : Promise.reject(zeitueberschreitung()),
    ),
  );
}

/** Jeder Test sein eigenes Cookie – das CSRF-Token wird je Cookie vorgehalten. */
let n = 0;
const cookie = () => `ChurchTools_sid=t${++n}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ctFetch – Zeitüberschreitung wird 504 (#489)', () => {
  it('Lesen (ctGet)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(zeitueberschreitung()));
    const f = await getEvents(cookie(), '2026-01-01', '2026-12-31').catch((e: unknown) => e);
    expect(f).toBeInstanceOf(CtTimeoutError);
    expect(f).toMatchObject({ status: 504, message: CT_ANTWORTET_NICHT });
  });

  it('Schreiben (schreibe)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    nurCsrfAntwortet();
    const f = await deleteFile(cookie(), 7).catch((e: unknown) => e);
    expect(f).toBeInstanceOf(CtTimeoutError);
  });

  it('alte Schnittstelle (ctAjax)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    nurCsrfAntwortet();
    const f = await ctAjax(cookie(), 'getMasterData').catch((e: unknown) => e);
    expect(f).toBeInstanceOf(CtTimeoutError);
  });

  it('CSRF-Token holen – auch nach dem Wiederholversuch', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(zeitueberschreitung()));
    const f = await getCsrfToken(cookie()).catch((e: unknown) => e);
    expect(f).toBeInstanceOf(CtTimeoutError);
  });

  it('Anmelden (login)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(zeitueberschreitung()));
    const f = await login('a@b.de', 'pw').catch((e: unknown) => e);
    expect(f).toBeInstanceOf(CtTimeoutError);
  });

  it('Abmelden bleibt still – der App-Logout klappt trotzdem', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(zeitueberschreitung()));
    await expect(logout(cookie())).resolves.toBeUndefined();
  });

  it('gibt die Zeitgrenze mit und meldet den Weg nur im Log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(zeitueberschreitung());
    vi.stubGlobal('fetch', fetchMock);
    await getEvents(cookie(), '2026-01-01', '2026-12-31').catch(() => {});
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Zeitüberschreitung bei /api/'));
  });

  it('ein anderer Netzfehler bleibt, was er ist (kein 504 für alles)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const f = await getEvents(cookie(), '2026-01-01', '2026-12-31').catch((e: unknown) => e);
    expect(f).toBeInstanceOf(TypeError);
  });
});

describe('ctFetch – 429 auch beim Schreiben (#489)', () => {
  // Lesen, CSRF, Anmelden, alte Schnittstelle und Dateien haben je einen eigenen 429-Test; der
  // Schreibpfad hatte keinen, obwohl seine Kopie der Regel als „die DRITTE Stelle" im Code stand.
  it('Schreiben: 429 ergibt die Drosselung samt Retry-After', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/api/csrftoken')
            ? new Response(JSON.stringify({ data: 'csrf' }), { status: 200 })
            : new Response('', { status: 429, headers: { 'retry-after': '20' } }),
        ),
      ),
    );
    const f = await deleteFile(cookie(), 7).catch((e: unknown) => e);
    expect(f).toBeInstanceOf(CtOverloadedError);
    expect(f).toMatchObject({ status: 503, retryAfterMs: 20_000 });
  });
});

describe('Massenläufe erkennen die Zeitüberschreitung (#489)', () => {
  it('auch beim Datei-Download – vorher lief der Liedtext-Index dort weiter', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(zeitueberschreitung()));
    const f = await downloadFileText(cookie(), `${BASE}/files/1/x.cho`).catch((e: unknown) => e);
    expect(f).toMatchObject({ status: 504 });
    expect(isCtOverloaded(f)).toBe(true);
  });
});

describe('errorHandler – Zeitüberschreitung beim Lesen der Antwort (#489)', () => {
  it('504 mit derselben Meldung, ohne „Unerwarteter Fehler" im Log', () => {
    const fehlerLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status, json, setHeader: vi.fn() } as unknown as ExpressResponse;

    void errorHandler(zeitueberschreitung(), {} as Request, res, (() => {}) as NextFunction);

    expect(status).toHaveBeenCalledWith(504);
    expect(json).toHaveBeenCalledWith({ error: CT_ANTWORTET_NICHT });
    expect(fehlerLog).not.toHaveBeenCalled();
  });
});
