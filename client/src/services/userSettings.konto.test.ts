// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { markReachable } from './reachability';
import { setSessionExpiredHandler } from './api';

/**
 * **Konto-Einstellungen kommen mit jedem Abholen mit** (30.10.2026, „Lieder öffnen mit: Nur Text“ auf allen Geräten).
 *
 * Der Abgleich holt Einstellungen je Lied. Die Konto-Einstellung steht unter der Pseudo-ID 0 (`worship_start_0`) –
 * fragt `pullSettings` sie nicht mit, kommt sie auf einem zweiten Gerät nie an, und eine anderswo zurückgesetzte Wahl
 * bliebe hier ewig stehen.
 */
const START = 'worship_start_0';

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function neuStarten(): Promise<typeof import('./userSettings')> {
  vi.resetModules();
  const mod = await import('./userSettings');
  mod.resetSync();
  return mod;
}

beforeEach(() => {
  localStorage.clear();
  markReachable(true);
  setSessionExpiredHandler(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Konto-Einstellungen im Abgleich', () => {
  it('fragt die Konto-ID 0 neben den Liedern mit ab – und übernimmt „Nur Text“ vom anderen Gerät', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { [START]: 'text' }));
    vi.stubGlobal('fetch', fetchMock);
    const mod = await neuStarten();
    await mod.pullSettings([42, 7]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(decodeURIComponent(url)).toContain('songs=42,7,0');
    expect(localStorage.getItem(START)).toBe('text');
  });

  it('anderswo zurückgesetzt → hier auch weg', async () => {
    localStorage.setItem('worship_settings_migrated_v1', '1');
    localStorage.setItem(START, 'text');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {})));
    const mod = await neuStarten();
    await mod.pullSettings([42]);
    expect(localStorage.getItem(START)).toBeNull();
  });
});
