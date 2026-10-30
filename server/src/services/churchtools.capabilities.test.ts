import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { leeren, tempDatei } from '../testHilfen/tempAblage.js';
import type { UserCapabilities } from '@shared/types/index';

// Ablageort des Rechte-Caches VOR dem Modul-Import setzen (config.ts liest beim Import).
const cacheFile = tempDatei('capbridge-test', 'caps.json');
process.env.CAPABILITIES_CACHE_PATH = cacheFile;

type Ct = typeof import('./ctCapabilities.js');
type Cache = typeof import('./capabilitiesCache.js');
let ct: Ct;
let cache: Cache;

beforeAll(async () => {
  ct = await import('./ctCapabilities.js');
  cache = await import('./capabilitiesCache.js');
});

beforeEach(async () => {
  await leeren(cacheFile);
  cache.__resetForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CAPS: UserCapabilities = {
  canViewSongs: true,
  canViewAgendas: true,
  canEditAgendas: true,
  canEditSongs: false,
  canEditTempo: false,
  isAdmin: false,
  canUseGlobalNotes: true,
  canUseCcli: false,
  canViewSongStatistics: false,
  canUseAvailability: false,
};

/**
 * Was beim Überbrücken aus `CAPS` wird: Die sensiblen Rechte kommen NICHT aus dem Cache – `isAdmin`
 * seit #249, `canUseGlobalNotes` seit #282 (es gibt Lesezugriff auf die Anmerkungen ANDERER).
 * Steht auch in `capabilitiesCache.test.ts`; wird die Liste erweitert, sind BEIDE Stellen nachzuziehen.
 */
const CAPS_BRIDGED: UserCapabilities = { ...CAPS, isAdmin: false, canUseGlobalNotes: false };

// permissions/global-Antwort während eines CT-Aussetzers: churchservice-Block vorhanden,
// aber alle Rechte-Arrays leer (sieht aus wie „kein Zugriff") – exakt der Vorfall vom 13.07.2026.
const EMPTY_PERMS = { data: { churchservice: { 'view songcategory': [], 'view agenda': [] } } };

function jsonRes(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('getCapabilities – Überbrückung realer ChurchTools-Aussetzer (#149)', () => {
  it('überbrückt mit Konto-ID aus dem Session-Cookie OHNE whoami-Aufruf', async () => {
    await cache.rememberCapabilities(42, CAPS);
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/permissions/global')) return jsonRes(EMPTY_PERMS);
      throw new Error(`unerwarteter Aufruf: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const caps = await ct.getCapabilities('ChurchTools_s=bridge1', 42);

    // Überbrückt wird, aber ohne die sensiblen Rechte (#249/#282) – siehe CAPS_BRIDGED.
    expect(caps).toEqual(CAPS_BRIDGED);
    // Nur permissions/global – whoami darf NICHT nötig gewesen sein. Genau diese Abhängigkeit
    // war die Lücke: Hing whoami mit, konnte der Cache nie überbrücken.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('halb tote Session (Rechte leer + whoami 401, kein Cache) → 401 statt „Erneut versuchen"-Sackgasse', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/permissions/global')) return jsonRes(EMPTY_PERMS);
      if (u.includes('/api/whoami')) return jsonRes({ message: 'unauthorized' }, 401);
      throw new Error(`unerwarteter Aufruf: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(ct.getCapabilities('ChurchTools_s=bridge2', null)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('kein Cache, whoami ok: weiterhin „alles false" ohne Wurf (echte Nicht-Berechtigte)', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/permissions/global')) return jsonRes(EMPTY_PERMS);
      if (u.includes('/api/whoami'))
        return jsonRes({ data: { id: 7, firstName: 'Test', lastName: 'Person' } });
      throw new Error(`unerwarteter Aufruf: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const caps = await ct.getCapabilities('ChurchTools_s=bridge3', null);

    expect(caps.canViewSongs).toBe(false);
    expect(caps.canViewAgendas).toBe(false);
    expect(caps.canUseGlobalNotes).toBe(false);
  });
});

describe('computeAvailabilityAllowed – Verfügbarkeit ohne Rollen-Filter (#177)', () => {
  it('aktives Mitglied einer gewählten Gruppe darf – egal welche Rolle', () => {
    expect(ct.computeAvailabilityAllowed([{ groupId: 9, roleId: 99 }], [9])).toBe(true);
  });
  it('Mitglied nur in anderen Gruppen darf nicht', () => {
    expect(ct.computeAvailabilityAllowed([{ groupId: 4, roleId: 1 }], [9])).toBe(false);
  });
  it('leere Gruppenauswahl = niemand', () => {
    expect(ct.computeAvailabilityAllowed([{ groupId: 9, roleId: 1 }], [])).toBe(false);
  });
  it('Team-Notizen bleiben strenger: ohne freigegebene Rolle kein Recht, Verfügbarkeit trotzdem', () => {
    const m = [{ groupId: 9, roleId: 5 }];
    expect(ct.computeTeamNotesAllowed(m, [9], [{ groupId: 9, roles: [1] }])).toBe(false);
    expect(ct.computeAvailabilityAllowed(m, [9])).toBe(true);
  });
});

describe('getCapabilities – sieht man alle Dienstgruppen? (#676)', () => {
  const PERMS = {
    data: {
      churchcore: { 'administer persons': false },
      churchservice: {
        'view songcategory': [1],
        'view agenda': [1],
        'edit agenda': [1],
        'view servicegroup': [3],
        'edit servicegroup': [3],
      },
    },
  };
  const GRUPPEN = {
    data: [
      { id: 1, name: 'Programm', viewAll: true },
      { id: 3, name: 'Technik', viewAll: false },
      { id: 4, name: 'Musik', viewAll: false },
    ],
  };
  function stub(gruppen: () => Response) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u.includes('/api/permissions/global')) return jsonRes(PERMS);
        if (u.includes('/api/servicegroups')) return gruppen();
        throw new Error(`unerwarteter Aufruf: ${u}`);
      }),
    );
  }

  it('sieht Musik nicht → `siehtAlleDienstgruppen: false`', async () => {
    stub(() => jsonRes(GRUPPEN));
    const caps = await ct.getCapabilities('ChurchTools_s=gruppen1', 42);
    expect(caps.siehtAlleDienstgruppen).toBe(false);
    // Infos je Gruppe (E6-4): nur, was man sieht – Programm (für alle) und Technik.
    expect(caps.infoGruppen).toEqual([
      { id: 1, name: 'Programm' },
      { id: 3, name: 'Technik' },
    ]);
    expect(caps.canEditAgendas).toBe(true);
  });

  it('Dienstgruppen nicht lesbar → unbekannt, die übrigen Rechte bleiben', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stub(() => jsonRes({ message: 'kaputt' }, 500));
    const caps = await ct.getCapabilities('ChurchTools_s=gruppen2', 42);
    expect(caps.siehtAlleDienstgruppen).toBeUndefined();
    expect(caps.infoGruppen).toBeUndefined();
    expect(caps.canViewSongs).toBe(true);
  });
});
