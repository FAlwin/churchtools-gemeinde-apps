import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './fehler';
import { _bremseLoesen, _vergissCsrf } from './verbindung';
import {
  mitgliedAendern,
  mitgliedAnlegen,
  mitgliedEntfernen,
  mitgliedLesen,
  mitgliedOderNichts,
} from './mitglieder';

/**
 * Der Mitgliedschafts-Baustein (#848) gegen die gemessene Regel (#759, 28.10.2026): anlegen = `PUT` + `only_add`,
 * ändern = `PATCH` ohne `only_add`, 404 beim Lesen = nicht in der Gruppe.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let aufrufe: { methode: string; pfad: string; rumpf: unknown }[];
let antwort: () => Response;

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  aufrufe = [];
  antwort = () => json(200, {});
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    if (url.endsWith('/api/csrftoken')) return Promise.resolve(json(200, { data: 'TOK' }));
    aufrufe.push({
      methode: init?.method ?? 'GET',
      pfad: url.replace('https://ct.test/api', ''),
      rumpf: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return Promise.resolve(antwort());
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Mitgliedschaft schreiben (#848)', () => {
  it('anlegen: PUT mit only_add – nie überschreiben', async () => {
    await mitgliedAnlegen(7, 42, {
      groupTypeRoleId: 16,
      groupMemberStatus: 'active',
      fields: { 3: 'x' },
    });
    expect(aufrufe).toEqual([
      {
        methode: 'PUT',
        pfad: '/groups/7/members/42',
        rumpf: {
          groupTypeRoleId: 16,
          groupMemberStatus: 'active',
          fields: { 3: 'x' },
          only_add: true,
        },
      },
    ]);
  });

  it('anlegen: ein mitgegebenes only_add: false wird überstimmt', async () => {
    await mitgliedAnlegen(7, 42, { only_add: false });
    expect(aufrufe[0].rumpf).toEqual({ only_add: true });
  });

  it('ändern: PATCH nur mit dem Geschickten, ohne only_add', async () => {
    await mitgliedAendern(7, 42, { groupMemberStatus: 'active' });
    expect(aufrufe).toEqual([
      { methode: 'PATCH', pfad: '/groups/7/members/42', rumpf: { groupMemberStatus: 'active' } },
    ]);
  });

  it('entfernen: DELETE', async () => {
    await mitgliedEntfernen(7, 42);
    expect(aufrufe).toEqual([
      { methode: 'DELETE', pfad: '/groups/7/members/42', rumpf: undefined },
    ]);
  });

  it('fehlendes Recht: die mitgegebene Meldung', async () => {
    antwort = () => json(403, { message: 'Forbidden' });
    await expect(
      mitgliedAendern(7, 42, { groupMemberStatus: 'active' }, { verweigert: 'Darfst du nicht.' }),
    ).rejects.toThrow('Darfst du nicht.');
  });
});

describe('Mitgliedschaft lesen (#848)', () => {
  it('lesen: GET, ausgepackt', async () => {
    antwort = () => json(200, { data: { groupMemberStatus: 'waiting' } });
    expect(await mitgliedLesen(7, 42)).toEqual({ groupMemberStatus: 'waiting' });
    expect(aufrufe[0]).toMatchObject({ methode: 'GET', pfad: '/groups/7/members/42' });
  });

  it('oder nichts: 404 heißt „nicht in der Gruppe“', async () => {
    antwort = () => json(404, {});
    expect(await mitgliedOderNichts(7, 42)).toBeNull();
  });

  it('oder nichts: ein vorübergehender Fehler ist NICHT „nicht dabei“ – er wirft', async () => {
    antwort = () => json(503, {});
    await expect(mitgliedOderNichts(7, 42)).rejects.toBeInstanceOf(ApiError);
  });
});
