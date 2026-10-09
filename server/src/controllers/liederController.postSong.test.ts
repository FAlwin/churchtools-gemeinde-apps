import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../services/songVerwaltung.js', () => ({ liedAnlegen: vi.fn() }));

const { postSong } = await import('./liederController.js');
const { liedAnlegen } = await import('../services/songVerwaltung.js');

/**
 * Eine alte App laut abweisen (05.10.2026, Alwins Wahl „Alles jetzt"): Bis dahin trug der Server ein
 * neues Lied auf Wunsch gleich in einen Ablauf ein (`eventId`). Eine noch nicht aktualisierte App
 * schickt das weiter. Würde das Feld still verworfen, entstünde das Lied, landete aber nicht im
 * Ablauf – und die alte App meldete nichts. Deshalb: ablehnen, und zwar bevor etwas angelegt wird.
 */
describe('postSong – eine veraltete App mit eventId', () => {
  it('lehnt mit 410 und einer klaren Bitte ab – und legt NICHTS an', async () => {
    const req = { body: { name: 'Treu', categoryId: 0, eventId: 5 } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    await expect(postSong(req, res)).rejects.toMatchObject({
      status: 410,
      message: expect.stringMatching(/veraltet.*neu laden.*nicht angelegt/) as unknown as string,
    });
    expect(liedAnlegen).not.toHaveBeenCalled();
  });
});
