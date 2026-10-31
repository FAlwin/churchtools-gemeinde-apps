import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * `PATCH /api/songs/:songId/arrangements/:arrangementId/files/:fileId` (31.10.2026) – der Controller reicht Lied,
 * Arrangement, Datei und Namen durch; die Regeln stehen im Kern (`dateiUmbenennen`, Tests in
 * `arrangementFileVerwaltung.test.ts`). Hier nur: die richtigen Nummern an der richtigen Stelle, und ohne Namen nichts.
 */
vi.mock('../services/setlistBuilder.js', () => ({
  renameArrangementFile: vi.fn().mockResolvedValue([{ fileId: 2, name: 'Lead.pdf' }]),
}));
vi.mock('../utils/ctCookie.js', () => ({ ctCookie: () => 'cookie' }));

const { patchArrangementFile } = await import('./dateiController.js');
const dienst = await import('../services/setlistBuilder.js');

const anfrage = (body: unknown) =>
  ({ params: { songId: '12', arrangementId: '500', fileId: '2' }, body }) as unknown as Request;

describe('PATCH …/files/:fileId', () => {
  it('reicht Lied, Arrangement, Datei und Namen durch und liefert die frische Liste', async () => {
    const json = vi.fn();
    await patchArrangementFile(anfrage({ name: 'Lead' }), { json } as unknown as Response);
    expect(vi.mocked(dienst.renameArrangementFile)).toHaveBeenCalledWith(
      'cookie',
      12,
      500,
      2,
      'Lead',
    );
    expect(json).toHaveBeenCalledWith([{ fileId: 2, name: 'Lead.pdf' }]);
  });

  it('ohne Namen → Fehler, nichts weitergereicht', async () => {
    vi.mocked(dienst.renameArrangementFile).mockClear();
    await expect(
      patchArrangementFile(anfrage({}), { json: vi.fn() } as unknown as Response),
    ).rejects.toThrow();
    expect(vi.mocked(dienst.renameArrangementFile)).not.toHaveBeenCalled();
  });
});
