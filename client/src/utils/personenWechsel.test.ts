// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthStatus } from '@shared/types/index';

/**
 * Personenwechsel am geteilten Gerät (30.10.2026). Die Warteschlangen und Merker werden mit den ECHTEN Erzeugern
 * angelegt (`pushSetting`, `pushField` ohne Netz, wie in `userSettings.pending.test.ts`) – ein handgeschriebener
 * Schlüssel bliebe grün, wenn sich deren Namen einmal ändern. Nur „wer ist angemeldet“ ist nachgestellt.
 */
const ich = vi.hoisted(() => ({ status: null as AuthStatus | Error | null, aufrufe: 0 }));
vi.mock('../services/churchtoolsApi', () => ({
  getMe: () => {
    ich.aufrufe++;
    return ich.status instanceof Error ? Promise.reject(ich.status) : Promise.resolve(ich.status);
  },
}));

const als = (id: number): AuthStatus => ({
  authenticated: true,
  user: { id, firstName: `P${id}`, lastName: 'Test' },
});
const json = (status: number) =>
  new Response('{}', { status, headers: { 'Content-Type': 'application/json' } });
const KEY = 'worship_key_42';
const STRICH = 'worship_docdraw_song7_voriginal_0';

/** Neue Seite: Module frisch (wie ein Neuladen), nur der Speicher bleibt. */
async function seite() {
  vi.resetModules();
  const settings = await import('../services/userSettings');
  const anno = await import('../services/annotations');
  const wechsel = await import('./personenWechsel');
  const { queryClient } = await import('../queryClient');
  const { markReachable } = await import('../services/reachability');
  settings.resetSync();
  anno.resetSync();
  return { settings, anno, wechsel, queryClient, markReachable };
}

/** Person A arbeitet ohne Netz: Tonart und ein Strich warten auf das Hochladen. */
async function aArbeitetOhneNetz() {
  ich.status = als(1);
  const a = await seite();
  expect(await a.wechsel.personGeprueft()).toBe(true);
  vi.useFakeTimers();
  a.markReachable(false);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  localStorage.setItem(KEY, 'D');
  a.settings.pushSetting(KEY, 'D');
  localStorage.setItem(STRICH, 'STRICH-VON-A');
  a.anno.pushField(STRICH, 'strokes', 'STRICH-VON-A');
  await vi.advanceTimersByTimeAsync(700);
  vi.useRealTimers();
  // Sonst bewiese „nichts hochgeladen“ unten gar nichts.
  expect(localStorage.getItem('worship_settings_pending_v1')).toContain(KEY);
  expect(localStorage.getItem('worship_anno_pending_v1')).toContain('song7_voriginal_0');
}

let netz: ReturnType<typeof vi.fn>;
const hochgeladen = () =>
  netz.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');

beforeEach(() => {
  localStorage.clear();
  ich.status = null;
  ich.aufrufe = 0;
  netz = vi.fn().mockResolvedValue(json(200));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Personenwechsel am geteilten Gerät', () => {
  it('B nach A: Was A nicht hochladen konnte, landet NICHT auf Bs Konto – und B sieht es nicht', async () => {
    await aArbeitetOhneNetz();
    ich.status = als(19);
    const b = await seite();
    vi.stubGlobal('fetch', netz);
    b.markReachable(true);
    expect(await b.wechsel.personGeprueft()).toBe(true);
    await b.settings.resumePendingSettings();
    await b.anno.resumePendingAnnotations();
    await b.settings.migrateLocalSettings();
    await b.anno.migrateLocalAnnotations();
    expect(hochgeladen()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(STRICH)).toBeNull();
    expect(localStorage.getItem('worship:letzte-person')).toBe('19');
  });

  it('dieselbe Person: nichts geräumt – ihr Liegengebliebenes geht hoch wie bisher', async () => {
    await aArbeitetOhneNetz();
    const a = await seite();
    vi.stubGlobal('fetch', netz);
    a.markReachable(true);
    expect(await a.wechsel.personGeprueft()).toBe(true);
    await a.settings.resumePendingSettings();
    expect(localStorage.getItem(KEY)).toBe('D');
    expect(hochgeladen().map((c) => JSON.parse(String((c[1] as RequestInit).body)))).toContainEqual(
      {
        [KEY]: 'D',
      },
    );
  });

  it('noch keine Person gemerkt (erster Start nach dem Update): merken, nichts räumen', async () => {
    localStorage.setItem(KEY, 'D');
    ich.status = als(19);
    const b = await seite();
    expect(await b.wechsel.personGeprueft()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('D');
    expect(localStorage.getItem('worship:letzte-person')).toBe('19');
  });

  it('wer angemeldet ist, lässt sich nicht feststellen: nichts räumen, `false`, beim nächsten Mal neu fragen', async () => {
    localStorage.setItem('worship:letzte-person', '1');
    localStorage.setItem(KEY, 'D');
    ich.status = new Error('504');
    const s = await seite();
    expect(await s.wechsel.personGeprueft()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('D');
    ich.status = { authenticated: false };
    expect(await s.wechsel.personGeprueft()).toBe(false);
    ich.status = als(1);
    expect(await s.wechsel.personGeprueft()).toBe(true);
    expect(ich.aufrufe).toBe(3);
  });

  it('einmal je Seite – erst nach An- oder Abmelden wird neu gefragt', async () => {
    ich.status = als(1);
    const s = await seite();
    await s.wechsel.personGeprueft();
    await s.wechsel.personGeprueft();
    expect(ich.aufrufe).toBe(1);
    s.wechsel.personNeuPruefen();
    ich.status = als(19);
    await s.wechsel.personGeprueft();
    expect(ich.aufrufe).toBe(2);
    expect(localStorage.getItem('worship:letzte-person')).toBe('19');
  });

  it('auch der Speicher der Seite: zwischengespeicherte Abläufe von A sind weg, die Anmeldung bleibt', async () => {
    localStorage.setItem('worship:letzte-person', '1');
    ich.status = als(19);
    const s = await seite();
    s.queryClient.setQueryData(['agenda', 5], { von: 'A' });
    s.queryClient.setQueryData(['me'], als(1));
    await s.wechsel.personGeprueft();
    expect(s.queryClient.getQueryData(['agenda', 5])).toBeUndefined();
    expect(s.queryClient.getQueryData(['me'])).toEqual(als(19));
  });
});
