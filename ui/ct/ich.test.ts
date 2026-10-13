import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './fehler';
import { _bremseLoesen, _vergissCsrf } from './verbindung';
import { ladeIch } from './ich';

/**
 * Wer angemeldet ist – gegen eine nachgestellte ChurchTools-Instanz in der Form, die an der
 * Test-Instanz gemessen wurde (3.137.1, 12.10.2026).
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Antworten = Record<string, () => Response>;

function ct(antworten: Antworten): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const antwort = antworten[url.replace('https://ct.test/api', '')];
    return Promise.resolve(antwort ? antwort() : json(404, {}));
  });
}

const MITGLIEDSCHAFT = {
  group: { title: 'Technik', domainIdentifier: '7' },
  groupTypeRoleId: 16,
  groupMemberStatus: 'active',
  memberEndDate: null,
};
const ROLLEN = [{ id: 16, name: 'Leiter', isLeader: true }];

const GUT: Antworten = {
  '/whoami': () => json(200, { data: { id: 1, firstName: ' Alwin ' } }),
  '/persons/1/groups': () => json(200, { data: [MITGLIEDSCHAFT] }),
  '/group/roles': () => json(200, { data: ROLLEN }),
  // /info kommt ohne `data`-Hülle (gemessen).
  '/info': () => json(200, { siteName: 'Evangeliumschristen- Gemeinde e.V.' }),
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

describe('ladeIch', () => {
  it('Person, Gemeinde, rohe Mitgliedschaften und Rollen', async () => {
    ct(GUT);
    expect(await ladeIch()).toEqual({
      id: 1,
      vorname: 'Alwin',
      gemeinde: 'Evangeliumschristen- Gemeinde e.V.',
      mitgliedschaften: [MITGLIEDSCHAFT],
      rollen: ROLLEN,
    });
  });

  it('niemand angemeldet (id -1) → 401, keine weiteren Anfragen', async () => {
    ct({ ...GUT, '/whoami': () => json(200, { data: { id: -1, lastName: 'Anonymous' } }) });
    const e = await ladeIch().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(401);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('Gruppen nicht lesbar → Fehler, NICHT „keine Gruppen“', async () => {
    ct({ ...GUT, '/persons/1/groups': () => json(500, { message: 'kaputt' }) });
    await expect(ladeIch()).rejects.toBeInstanceOf(ApiError);
  });

  it('Gruppen kommen ohne Liste (data: null) → Fehler 502, nicht still leer', async () => {
    ct({ ...GUT, '/persons/1/groups': () => json(200, { data: null }) });
    const e = await ladeIch().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
  });

  it('Rollen nicht lesbar → Fehler, nicht still „alle nur Mitglied“', async () => {
    ct({ ...GUT, '/group/roles': () => json(502, {}) });
    await expect(ladeIch()).rejects.toBeInstanceOf(ApiError);
  });

  it('Gemeindename ist Beiwerk: /info scheitert → null, der Rest steht', async () => {
    ct({ ...GUT, '/info': () => json(500, {}) });
    const ich = await ladeIch();
    expect(ich.gemeinde).toBeNull();
    expect(ich.mitgliedschaften).toHaveLength(1);
  });
});
