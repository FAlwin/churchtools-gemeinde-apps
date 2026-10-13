import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ladeStart, planbar, planbareDienstgruppen } from './start';
import { startFuer } from './start.testutil';

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
  '/services': () =>
    json(200, { data: [{ id: 6, name: 'Ton', serviceGroupId: 3, sortKey: 0, groupIds: [7] }] }),
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
      ichId: 1,
      vorname: 'Alwin',
      gemeinde: 'ECG',
      gruppen: [{ id: 7, name: 'Technik', leitung: true }],
      dienstgruppen: [
        { id: 1, name: 'Programm' },
        { id: 3, name: 'Technik' },
      ],
      dienste: new Map([
        [6, { id: 6, name: 'Ton', dienstgruppeId: 3, gruppenIds: [7], sortKey: 0 }],
      ]),
      rechte: { planbareDienstgruppen: [3], ablaufKalender: [], abwesenheitenAller: false },
    });
  });

  it('Dienste ohne Liste → Fehler 502 (ohne Dienste keine Namen und keine freien Plätze)', async () => {
    ct({ ...GUT, '/services': () => json(200, { data: null }) });
    const e = await ladeStart().catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(502);
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

describe('Wer plant was (E3-4): global, als Leitung, Termin-Admin in der Matrix', () => {
  it('Leitung einer Gruppe des Dienstes macht zum Planer – auch ohne globales Recht', () => {
    const ohneRecht = startFuer({
      rechte: { planbareDienstgruppen: [], ablaufKalender: [], abwesenheitenAller: false },
      gruppen: [{ id: 7, name: 'Technik', leitung: true }],
    });
    expect(planbareDienstgruppen(ohneRecht).map((g) => g.name)).toEqual(['Technik']);
    expect(planbar(ohneRecht, ohneRecht.dienste.get(6)!)).toBe(true);
    expect(planbar(ohneRecht, ohneRecht.dienste.get(9)!)).toBe(false);
  });

  it('nur Mitglied (keine Leitung) und ohne Recht → nichts planbar', () => {
    const mitglied = startFuer({
      rechte: { planbareDienstgruppen: [], ablaufKalender: [], abwesenheitenAller: false },
      gruppen: [{ id: 7, name: 'Technik', leitung: false }],
    });
    expect(planbareDienstgruppen(mitglied)).toEqual([]);
    expect(planbar(mitglied, mitglied.dienste.get(6)!, true)).toBe(true);
  });
});
