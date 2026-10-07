import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Der Update-Hinweis in der ChurchTools-Erweiterung (#337, Alwin am 07.10.2026): Ohne eigenen Server
 * fragt der Browser GitHub selbst. Jeder Fehler heißt „kein Hinweis" – nie eine Fehlermeldung.
 */
vi.mock('./ctRuntime', async (original) => ({
  ...(await original<typeof import('./ctRuntime')>()),
  istExtension: true,
}));

const { getUpdateInfo } = await import('./updateApi');
const { RELEASE_API_URL } = await import('@shared/update/index');

function antwort(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('Update-Hinweis in der Erweiterung', () => {
  it('fragt GitHub direkt und liest die Version aus dem Tag', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        antwort(200, { tag_name: 'v2.28.0', html_url: 'https://github.com/x/releases/v2.28.0' }),
      );
    expect(await getUpdateInfo()).toEqual({
      latest: '2.28.0',
      tag: 'v2.28.0',
      url: 'https://github.com/x/releases/v2.28.0',
    });
    expect(String(spy.mock.calls[0][0])).toBe(RELEASE_API_URL);
  });

  it('kein Release (404) oder Netzfehler → kein Hinweis, kein Fehler', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(antwort(404, {}));
    expect((await getUpdateInfo()).latest).toBeNull();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await getUpdateInfo()).latest).toBeNull();
  });
});
