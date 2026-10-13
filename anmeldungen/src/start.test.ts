import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ladeStart } from './start';

/**
 * Die Startseite der Anmeldungen (#474) gegen eine nachgestellte ChurchTools-Instanz. Die Antworten
 * haben die Form, die an der Test-Instanz gemessen wurde (3.137.1, 12.10.2026).
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Antworten = Record<string, () => Response | Promise<Response>>;

function ct(antworten: Antworten): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const pfad = url.replace('https://ct.test/api', '');
    const antwort = antworten[pfad];
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
          groupTypeRoleId: 15,
          groupMemberStatus: 'active',
          memberEndDate: null,
        },
        {
          group: { title: 'Lobpreisteam', domainIdentifier: '9' },
          groupTypeRoleId: 16,
          groupMemberStatus: 'active',
          memberEndDate: null,
        },
      ],
    }),
  '/group/roles': () =>
    json(200, {
      data: [
        { id: 16, name: 'Leiter', isLeader: true },
        { id: 15, name: 'Mitarbeiter', isLeader: false },
      ],
    }),
  // /info kommt ohne `data`-Hülle (gemessen).
  '/info': () => json(200, { siteName: 'Evangeliumschristen- Gemeinde e.V.', version: '3.137.1' }),
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

describe('ladeStart', () => {
  it('Person, Gemeinde und Gruppen mit Leitung', async () => {
    ct(GUT);
    expect(await ladeStart()).toEqual({
      vorname: 'Alwin',
      gemeinde: 'Evangeliumschristen- Gemeinde e.V.',
      gruppen: [
        { id: 9, name: 'Lobpreisteam', leitung: true },
        { id: 7, name: 'Technik', leitung: false },
      ],
    });
  });

  it('Veranstaltungen, in denen man selbst Mitglied ist, sind keine „eigenen Gruppen“', async () => {
    ct({
      ...GUT,
      '/persons/1/groups': () =>
        json(200, {
          data: [
            {
              group: { title: 'Technik', domainIdentifier: '7', domainAttributes: { note: '' } },
              groupTypeRoleId: 15,
              groupMemberStatus: 'active',
            },
            {
              group: {
                title: 'Gemeindeessen',
                domainIdentifier: '91',
                domainAttributes: { note: 'anmeldung:v1:{}' },
              },
              groupTypeRoleId: 32,
              groupMemberStatus: 'active',
            },
          ],
        }),
    });
    expect((await ladeStart()).gruppen.map((g) => g.name)).toEqual(['Technik']);
  });

  it('niemand angemeldet (id -1) → 401, keine weiteren Anfragen', async () => {
    ct({ ...GUT, '/whoami': () => json(200, { data: { id: -1, lastName: 'Anonymous' } }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(401);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('Gruppen nicht lesbar → Fehler, NICHT „keine Gruppen"', async () => {
    ct({ ...GUT, '/persons/1/groups': () => json(500, { message: 'kaputt' }) });
    await expect(ladeStart()).rejects.toBeInstanceOf(ApiError);
  });

  it('Rollen nicht lesbar → Fehler, nicht still „alle nur Mitglied"', async () => {
    ct({ ...GUT, '/group/roles': () => json(502, {}) });
    await expect(ladeStart()).rejects.toBeInstanceOf(ApiError);
  });

  it('Gemeindename ist Beiwerk: /info scheitert → null, der Rest steht', async () => {
    ct({ ...GUT, '/info': () => json(500, {}) });
    const start = await ladeStart();
    expect(start.gemeinde).toBeNull();
    expect(start.gruppen).toHaveLength(2);
  });
});
