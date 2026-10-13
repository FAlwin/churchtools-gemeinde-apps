import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ladeAbwesenheiten, ladeLieder, ladeMusikApp } from './ladeBeiwerk';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ct(antwort: (url: string) => Response) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input) => Promise.resolve(antwort(String(input))));
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('ladeLieder', () => {
  it('die Liedtitel in Ablauf-Reihenfolge – der Titel des Lieds vor dem des Punkts', async () => {
    ct(() =>
      json(200, {
        data: {
          items: [
            { id: 1, type: 'header', title: 'Ankommen' },
            { id: 2, type: 'song', title: 'Punkt-Titel', song: { title: 'Halleluja' } },
            { id: 3, type: 'song', title: 'Treu' },
            { id: 4, type: 'normal', title: 'Predigt' },
          ],
        },
      }),
    );
    expect(await ladeLieder(7)).toEqual(['Halleluja', 'Treu']);
  });

  it('kein Ablauf (404) → null; andere Fehler werden geworfen', async () => {
    ct(() => json(404, { message: 'Not found.' }));
    expect(await ladeLieder(7)).toBeNull();
    vi.restoreAllMocks();
    ct(() => json(500, {}));
    await expect(ladeLieder(7)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('ladeAbwesenheiten', () => {
  it('nur die eigenen, mit from/to/limit wie im Server (ctRead.getAbsences)', async () => {
    const spy = ct(() => json(200, { data: [] }));
    await ladeAbwesenheiten(1, '2026-10-14', '2027-10-14');
    expect(String(spy.mock.calls[0][0])).toBe(
      'https://ct.test/api/persons/1/absences?from=2026-10-14&to=2027-10-14&limit=500',
    );
  });

  it('keine Liste → Fehler (sonst stünde „nichts eingetragen“ da)', async () => {
    ct(() => json(200, { data: null }));
    await expect(ladeAbwesenheiten(1, 'a', 'b')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('ladeMusikApp', () => {
  it('Kürzel beginnt mit „musik-app“ → Adresse der Erweiterung; sonst null', async () => {
    ct(() => json(200, { data: [{ shorty: 'anmeldungen' }, { shorty: 'musik-app-test' }] }));
    expect(await ladeMusikApp()).toBe('https://ct.test/ccm/musik-app-test/');
    vi.restoreAllMocks();
    ct(() => json(200, { data: [{ shorty: 'dienstplaner' }] }));
    expect(await ladeMusikApp()).toBeNull();
  });
});
