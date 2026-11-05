import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../services/setlistBuilder.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/setlistBuilder.js')>()),
  getServicesOhneAblauf: vi.fn(),
}));

const { getServicesOhneAblaufCtrl } = await import('./setlistController.js');
const { getServicesOhneAblauf } = await import('../services/setlistBuilder.js');

/**
 * Termine ohne Ablauf (05.11.2026): Die Kalender kommen aus dem Filter der Person (`?kalender=2,5`), nicht mehr aus
 * einer Einstellung der Gemeinde. Express liefert `req.query` auch als Liste oder Objekt – gelesen wird über
 * `songIdsFromQuery`, die eine Stelle dafür.
 */
function aufruf(query: Record<string, unknown>) {
  const req = { ctCookie: 'ct=1', ctUserId: 7, query } as unknown as Request;
  const res = { json: vi.fn() } as unknown as Response;
  return { req, res };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServicesOhneAblauf).mockResolvedValue([]);
});

describe('GET /api/services/ohne-ablauf', () => {
  it('fragt genau die Kalender aus der Anfrage ab – ohne Doppelte', async () => {
    const { req, res } = aufruf({ kalender: '2,5,2' });
    await getServicesOhneAblaufCtrl(req, res);
    expect(vi.mocked(getServicesOhneAblauf).mock.calls[0][2]).toEqual([2, 5]);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('ohne Kalender: leere Liste an die Regel (die dann nichts abfragt)', async () => {
    const { req, res } = aufruf({});
    await getServicesOhneAblaufCtrl(req, res);
    expect(vi.mocked(getServicesOhneAblauf).mock.calls[0][2]).toEqual([]);
  });

  it('Unsinn und Objekte zählen nicht', async () => {
    const { req, res } = aufruf({ kalender: { x: '3' } });
    await getServicesOhneAblaufCtrl(req, res);
    expect(vi.mocked(getServicesOhneAblauf).mock.calls[0][2]).toEqual([]);
  });

  it('mehr als 50 Kalender → 400, ChurchTools wird nicht gefragt', async () => {
    const viele = Array.from({ length: 51 }, (_, i) => i + 1).join(',');
    const { req, res } = aufruf({ kalender: viele });
    await expect(getServicesOhneAblaufCtrl(req, res)).rejects.toMatchObject({ status: 400 });
    expect(getServicesOhneAblauf).not.toHaveBeenCalled();
  });
});
