import { describe, it, expect, vi } from 'vitest';
import type { UserCapabilities } from '@shared/types/index';

/**
 * #444: Ohne Lieder und Abläufe wirft `getCapabilities` weiter – die automatischen Versuche bleiben
 * (Aussetzer aus #99). Aber am Typ des Fehlers erkennt App.tsx danach, ob ChurchTools echt geantwortet
 * hat (`KeineLiedRechte` → „Dir fehlen die Rechte …") oder nicht.
 */
const antwort: { caps: Partial<UserCapabilities> } = vi.hoisted(() => ({ caps: {} }));
vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  apiFetch: vi.fn(() => Promise.resolve(antwort.caps)),
}));

const { getCapabilities, KeineLiedRechte } = await import('./churchtoolsApi');

const OHNE = { canViewSongs: false, canViewAgendas: false };

describe('getCapabilities ohne Lieder und Abläufe (#444)', () => {
  it('echte Antwort → KeineLiedRechte', async () => {
    antwort.caps = { ...OHNE, keineLiedRechte: true };
    await expect(getCapabilities()).rejects.toBeInstanceOf(KeineLiedRechte);
  });

  it('leere Antwort (Aussetzer) oder älterer Server ohne das Feld → der allgemeine Fehler', async () => {
    antwort.caps = { ...OHNE, keineLiedRechte: false };
    const a = await getCapabilities().catch((e: unknown) => e);
    expect(a).toBeInstanceOf(Error);
    expect(a).not.toBeInstanceOf(KeineLiedRechte);
    antwort.caps = { ...OHNE };
    expect(await getCapabilities().catch((e: unknown) => e)).not.toBeInstanceOf(KeineLiedRechte);
  });

  it('mit Lied-Rechten kein Fehler', async () => {
    antwort.caps = { canViewSongs: true, canViewAgendas: false, keineLiedRechte: false };
    await expect(getCapabilities()).resolves.toMatchObject({ canViewSongs: true });
  });
});
