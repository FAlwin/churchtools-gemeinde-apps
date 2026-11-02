import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ladeLive, schreibeLive } from './ladeLive';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Was an die alte Schnittstelle ging: Adresse, CSRF-Kopf und die Formularfelder. */
type Aufruf = { url: string; csrf: string | null; felder: Record<string, string> };

function ct(antwort: (felder: Record<string, string>) => Response): Aufruf[] {
  const aufrufe: Aufruf[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/api/csrftoken')) return Promise.resolve(json(200, { data: 'csrf-1' }));
    const felder = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')));
    aufrufe.push({ url, csrf: new Headers(init?.headers).get('CSRF-Token'), felder });
    return Promise.resolve(antwort(felder));
  });
  return aufrufe;
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

describe('ladeLive / schreibeLive', () => {
  it('liest über die alte Schnittstelle mit CSRF-Token – Antwort wie gemessen', async () => {
    const aufrufe = ct(() =>
      json(200, {
        status: 'success',
        data: {
          pos_id: '2',
          switchdate: '2026-11-02T10:27:47Z',
          addseconds: '0',
          category_id: '2',
          currentTime: 1793615269251,
        },
      }),
    );
    expect(await ladeLive(148, 31)).toEqual({
      ok: true,
      stand: {
        stelle: 2,
        seit: Date.parse('2026-11-02T10:27:47Z'),
        zusatzSek: 0,
        serverZeit: 1793615269251,
      },
    });
    expect(aufrufe).toEqual([
      {
        url: 'https://ct.test/index.php?q=churchservice/ajax',
        csrf: 'csrf-1',
        felder: { func: 'loadAgendaLivePosition', event_id: '148', agenda_id: '31' },
      },
    ]);
  });

  it('schreibt und liest nach', async () => {
    let stand = { pos_id: null as string | null, addseconds: null as string | null };
    const aufrufe = ct((f) => {
      if (f.func === 'saveAgendaLivePosition') {
        stand = { pos_id: f.pos_id, addseconds: f.addseconds };
        return json(200, { status: 'success', data: { switchdate: '2026-11-02T11:00:00Z' } });
      }
      return json(200, {
        status: 'success',
        data: { ...stand, switchdate: '2026-11-02T11:00:00Z', currentTime: 1 },
      });
    });
    expect(await schreibeLive(148, 31, { stelle: 1, zusatzSek: 0 })).toMatchObject({
      ok: true,
      stand: { stelle: 1 },
    });
    expect(aufrufe.map((a) => a.felder)).toEqual([
      {
        func: 'saveAgendaLivePosition',
        event_id: '148',
        pos_id: '1',
        addseconds: '0',
        start_preparation_timer: '0',
      },
      { func: 'loadAgendaLivePosition', event_id: '148', agenda_id: '31' },
    ]);
  });

  it('403 → kein Recht; Serverfehler → vorübergehend', async () => {
    ct(() => json(403, {}));
    expect(await ladeLive(148, 31)).toEqual({ ok: false, grund: 'kein-recht' });
    vi.restoreAllMocks();
    ct(() => json(503, {}));
    expect(await ladeLive(148, 31)).toEqual({ ok: false, grund: 'voruebergehend' });
  });
});
