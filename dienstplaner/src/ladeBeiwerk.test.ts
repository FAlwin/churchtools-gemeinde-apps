import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import {
  autorVon,
  ladeAblauf,
  ladeAbwesenheiten,
  ladeLiedDaten,
  ladeLieder,
  ladeMusikApp,
} from './ladeBeiwerk';

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

describe('ladeLiedDaten / autorVon (Lied-Ansicht, E6-O O4)', () => {
  it('ein Abruf für alle Lieder; fehlen die Arrangements, steht eine leere Liste da', async () => {
    const abruf = ct(() =>
      json(200, {
        data: [
          { id: 41, name: 'Treu', author: '  Uwe Peters ', arrangements: [{ id: 410 }] },
          { id: 42, name: 'Halleluja' },
        ],
      }),
    );
    const lieder = await ladeLiedDaten([41, 42, 41]);
    expect(abruf).toHaveBeenCalledTimes(1);
    expect(String(abruf.mock.calls[0][0])).toContain('/songs?ids[]=41&ids[]=42');
    expect(lieder.get(41)?.arrangements).toHaveLength(1);
    expect(lieder.get(42)?.arrangements).toEqual([]);
    expect(autorVon(lieder.get(41))).toBe('Uwe Peters');
    expect(autorVon(lieder.get(42))).toBeNull();
    expect(autorVon(undefined)).toBeNull();
  });

  it('ohne Lieder kein Abruf; ein leerer Autor zählt nicht', async () => {
    const abruf = ct(() => json(200, { data: [] }));
    expect((await ladeLiedDaten([])).size).toBe(0);
    expect(abruf).not.toHaveBeenCalled();
    expect(autorVon({ author: '   ' } as never)).toBeNull();
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

describe('ladeAblauf (Termin-Ansicht, E6-1b)', () => {
  it('der Ablauf; kein Ablauf (404) → null – dieselbe Regel wie die Lieder der Startseite', async () => {
    const spy = ct(() => json(200, { data: { items: [{ id: 1, title: 'Predigt' }] } }));
    expect((await ladeAblauf(7))?.items.map((i) => i.title)).toEqual(['Predigt']);
    expect(String(spy.mock.calls[0][0])).toBe('https://ct.test/api/events/7/agenda');
    vi.restoreAllMocks();
    ct(() => json(404, { message: 'Not found.' }));
    expect(await ladeAblauf(7)).toBeNull();
    vi.restoreAllMocks();
    // Ablauf da, aber ohne Inhalt → leer (nicht „kein Ablauf“).
    ct(() => json(200, { data: null }));
    expect(await ladeAblauf(7)).toEqual({ items: [] });
    vi.restoreAllMocks();
    ct(() => json(502, {}));
    await expect(ladeAblauf(7)).rejects.toBeInstanceOf(ApiError);
  });
});
