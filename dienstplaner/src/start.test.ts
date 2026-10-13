import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ladeStart } from './start';

/**
 * Der Start des Dienstplaners gegen eine nachgestellte ChurchTools-Instanz – Antworten in der Form, die
 * an der Test-Instanz gemessen wurde (12. und 13.10.2026).
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

const GUT: Antworten = {
  '/whoami': () => json(200, { data: { id: 1, firstName: 'Alwin' } }),
  '/persons/1/groups': () =>
    json(200, {
      data: [
        {
          group: { title: 'Technik', domainIdentifier: '7' },
          groupTypeRoleId: 16,
          groupMemberStatus: 'active',
        },
      ],
    }),
  '/group/roles': () => json(200, { data: [{ id: 16, isLeader: true }] }),
  '/info': () => json(200, { siteName: 'ECG' }),
  '/permissions/global': () =>
    json(200, {
      data: {
        churchservice: { 'edit servicegroup': [3], 'edit agenda': [], 'manage absent': false },
      },
    }),
  '/servicegroups': () =>
    json(200, {
      data: [
        { id: 3, name: 'Technik', nameTranslated: 'Technik', sortKey: 30 },
        { id: 1, name: 'Programm', nameTranslated: 'Programm', sortKey: 10 },
      ],
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

describe('ladeStart (Dienstplaner)', () => {
  it('Person, Gruppen, Dienstgruppen in Gemeinde-Reihenfolge und die Planer-Rechte', async () => {
    ct(GUT);
    expect(await ladeStart()).toEqual({
      vorname: 'Alwin',
      gemeinde: 'ECG',
      gruppen: [{ id: 7, name: 'Technik', leitung: true }],
      dienstgruppen: [
        { id: 1, name: 'Programm' },
        { id: 3, name: 'Technik' },
      ],
      rechte: { planbareDienstgruppen: [3], ablaufKalender: [], abwesenheitenAller: false },
    });
  });

  it('niemand angemeldet → 401, Rechte und Dienstgruppen werden gar nicht erst gefragt', async () => {
    const spy = ct({ ...GUT, '/whoami': () => json(200, { data: { id: -1 } }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(401);
    expect(spy.mock.calls.map((c) => String(c[0]))).toEqual(['https://ct.test/api/whoami']);
  });

  it('leere Rechte-Antwort ist ein Aussetzer → Fehler, nicht „du planst nichts“', async () => {
    ct({ ...GUT, '/permissions/global': () => json(200, { data: {} }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('Dienstgruppen ohne Liste → Fehler 502, nicht still leer', async () => {
    ct({ ...GUT, '/servicegroups': () => json(200, { data: null }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('Dienstgruppen nicht lesbar (500) → Fehler', async () => {
    ct({ ...GUT, '/servicegroups': () => json(500, {}) });
    await expect(ladeStart()).rejects.toBeInstanceOf(ApiError);
  });
});
