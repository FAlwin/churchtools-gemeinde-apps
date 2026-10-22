import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ladeStart } from './start';

/**
 * Der Start des Organigramms gegen eine nachgestellte ChurchTools-Instanz – Antworten in der Form, die gemessen
 * wurde (Live 19.10.2026, Test-Instanz 22.10.2026).
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Antworten = Record<string, () => Response>;

function ct(antworten: Antworten) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const antwort = antworten[url.replace('https://ct.test/api', '')];
    return Promise.resolve(antwort ? antwort() : json(404, {}));
  });
}

const gruppe = (id: number, name: string, color: string | null = 'lime') => ({
  id,
  name,
  information: { groupTypeId: 2, groupStatusId: 1, color },
});

const GUT: Antworten = {
  '/whoami': () => json(200, { data: { id: 1, firstName: 'Alwin' } }),
  '/persons/1/groups': () => json(200, { data: [] }),
  '/group/roles': () => json(200, { data: [{ id: 16, isLeader: true }] }),
  '/info': () => json(200, { siteName: 'ECG' }),
  '/groups?limit=100&page=1': () =>
    json(200, {
      data: [gruppe(10, 'Gottesdienst'), gruppe(7, 'Technik'), gruppe(12, 'Stream', 'gray')],
      meta: { pagination: { lastPage: 1 } },
    }),
  '/groups/hierarchies': () =>
    json(200, {
      data: [
        { groupId: 10, parents: [], children: [7] },
        { groupId: 7, parents: [10], children: [12] },
      ],
    }),
  '/group/grouptypes': () => json(200, { data: [{ id: 2, name: 'Dienst', color: 'lime' }] }),
  '/permissions/global': () =>
    json(200, {
      data: {
        churchdb: {
          'administer groups': true,
          'create groups of grouptype': [2],
          'edit group': [7],
        },
      },
    }),
};

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
});

describe('ladeStart (Organigramm)', () => {
  it('Person, Gemeinde, Gruppen, Baum, Typfarben und Rechte', async () => {
    ct(GUT);
    const s = await ladeStart();
    expect(s.ichId).toBe(1);
    expect(s.vorname).toBe('Alwin');
    expect(s.gemeinde).toBe('ECG');
    expect(s.gruppen.map((g) => g.name)).toEqual(['Gottesdienst', 'Technik', 'Stream']);
    expect(s.baum).toHaveLength(1);
    expect(s.baum[0].gruppe.name).toBe('Gottesdienst');
    expect(s.baum[0].kinder[0].kinder[0].gruppe).toMatchObject({ name: 'Stream', farbe: 'gray' });
    expect(s.typFarben.get(2)).toBe('lime');
    expect(s.rechte).toEqual({
      gruppenVerwalten: true,
      anlegbareTypen: [2],
      bearbeitbareGruppen: [7],
    });
  });

  it('Gruppen auf mehreren Seiten → alle (ohne `limit` kämen nur 10)', async () => {
    ct({
      ...GUT,
      '/groups?limit=100&page=1': () =>
        json(200, { data: [gruppe(10, 'Gottesdienst')], meta: { pagination: { lastPage: 2 } } }),
      '/groups?limit=100&page=2': () =>
        json(200, { data: [gruppe(7, 'Technik')], meta: { pagination: { lastPage: 2 } } }),
    });
    expect((await ladeStart()).gruppen.map((g) => g.id)).toEqual([10, 7]);
  });

  it('niemand angemeldet → 401, Gruppen und Rechte werden gar nicht erst gefragt', async () => {
    const spy = ct({ ...GUT, '/whoami': () => json(200, { data: { id: -1 } }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(401);
    expect(spy.mock.calls.map((c) => String(c[0]))).toEqual(['https://ct.test/api/whoami']);
  });

  it('Hierarchie ohne Liste → Fehler 502, nicht still lauter Wurzeln', async () => {
    ct({ ...GUT, '/groups/hierarchies': () => json(200, { data: null }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('Gruppentypen ohne Liste → Fehler 502', async () => {
    ct({ ...GUT, '/group/grouptypes': () => json(200, { data: null }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('leere Rechte-Antwort ist ein Aussetzer → Fehler, nicht „du darfst nichts“', async () => {
    ct({ ...GUT, '/permissions/global': () => json(200, { data: {} }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('Gruppen nicht lesbar (500) → Fehler', async () => {
    ct({ ...GUT, '/groups?limit=100&page=1': () => json(500, {}) });
    await expect(ladeStart()).rejects.toBeInstanceOf(ApiError);
  });
});
