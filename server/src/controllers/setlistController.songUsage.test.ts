import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../services/ctCapabilities.js', () => ({
  getCapabilities: vi.fn(),
  getCapabilitiesCached: vi.fn(),
}));
vi.mock('../services/setlistBuilder.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/setlistBuilder.js')>()),
  getSongUsageMap: vi.fn(),
}));

const { getSongUsageCtrl } = await import('./setlistController.js');
const { getCapabilities, getCapabilitiesCached } = await import('../services/ctCapabilities.js');
const { getSongUsageMap } = await import('../services/setlistBuilder.js');

/**
 * Nur Musiker sollen die Lied-Statistik sehen (Alwin, 08.10.2026). Der Server merkt sie sich für alle
 * – ohne diese Prüfung bekäme auch wer ohne „Song-Statistik sehen" den Stand, den ein Musiker gerade
 * geladen hat. Deshalb: erst das eigene Recht, dann der Zwischenspeicher.
 */
function aufruf() {
  const req = { ctCookie: 'ct=1', ctUserId: 7 } as unknown as Request;
  const res = { json: vi.fn() } as unknown as Response;
  return { req, res };
}

beforeEach(() => vi.clearAllMocks());

describe('getSongUsageCtrl – nur mit dem eigenen Recht', () => {
  it('ohne „Song-Statistik sehen" → 403, und der Zwischenspeicher wird gar nicht gefragt', async () => {
    vi.mocked(getCapabilitiesCached).mockResolvedValue({ canViewSongStatistics: false } as never);
    const { req, res } = aufruf();
    await expect(getSongUsageCtrl(req, res)).rejects.toMatchObject({ status: 403 });
    expect(getSongUsageMap).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('mit dem Recht → die Statistik', async () => {
    vi.mocked(getCapabilitiesCached).mockResolvedValue({ canViewSongStatistics: true } as never);
    vi.mocked(getSongUsageMap).mockResolvedValue({ 1: { dates: ['2026-06-07'] } });
    const { req, res } = aufruf();
    await getSongUsageCtrl(req, res);
    expect(res.json).toHaveBeenCalledWith({ 1: { dates: ['2026-06-07'] } });
  });

  it('prüft die GEMERKTEN Rechte – nicht bei jedem Aufruf neu bei ChurchTools (#466)', async () => {
    vi.mocked(getCapabilitiesCached).mockResolvedValue({ canViewSongStatistics: true } as never);
    vi.mocked(getSongUsageMap).mockResolvedValue({});
    const { req, res } = aufruf();
    await getSongUsageCtrl(req, res);
    expect(getCapabilitiesCached).toHaveBeenCalledWith('ct=1', 7);
    expect(getCapabilities).not.toHaveBeenCalled();
  });
});
