import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * **Die Konto-Einstellungen kommen beim Abholen immer mit** (30.10.2026, „Lieder öffnen mit: Nur Text“).
 *
 * `songIdsFromQuery` lässt die 0 bewusst nicht durch – sie ist keine Lied-ID. Ohne die Ergänzung hier käme
 * `worship_start_0` über die Server-Variante nie auf ein zweites Gerät, während es in der Erweiterung klappt.
 */
vi.mock('../services/ctAuth.js', () => ({ getUserId: vi.fn().mockResolvedValue(42) }));
vi.mock('../services/kontoAblage.js', () => ({
  einstellungenHolen: vi.fn().mockResolvedValue({}),
  einstellungenSchreiben: vi.fn(),
}));
vi.mock('../utils/ctCookie.js', () => ({ ctCookie: () => 'cookie' }));

const { getSettings } = await import('./userSettingsController.js');
const ablage = await import('../services/kontoAblage.js');

describe('GET /api/settings', () => {
  it('fragt neben den Liedern immer die Konto-ID 0 ab', async () => {
    const json = vi.fn();
    await getSettings(
      { query: { songs: '5,9' } } as unknown as Request,
      { json } as unknown as Response,
    );
    expect(vi.mocked(ablage.einstellungenHolen)).toHaveBeenCalledWith('cookie', 42, [5, 9, 0]);
  });

  it('eine von außen geschickte 0 bleibt eine – nicht doppelt', async () => {
    vi.mocked(ablage.einstellungenHolen).mockClear();
    await getSettings(
      { query: { songs: '5,0' } } as unknown as Request,
      { json: vi.fn() } as unknown as Response,
    );
    expect(vi.mocked(ablage.einstellungenHolen)).toHaveBeenCalledWith('cookie', 42, [5, 0]);
  });
});
