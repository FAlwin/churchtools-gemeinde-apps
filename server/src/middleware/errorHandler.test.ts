import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { errorHandler, HttpError } from './errorHandler.js';

/**
 * #300: Bremst ChurchTools uns aus, ist „wann darf ich wieder?" die einzig brauchbare
 * Zusatzinformation. Der `Retry-After`-Kopf ist der Standardweg dafür – und er muss aus dem Fehler
 * heraus gesetzt werden, nicht an jeder Wurfstelle von Hand (das wäre die nächste Regel-Dopplung).
 */
function fakeRes(): {
  res: Response;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn(() => ({ json }) as unknown as Response);
  return { res: { status, json, setHeader } as unknown as Response, status, json, setHeader };
}

// Express 5 typisiert Fehler-Handler als `void | Promise<void>` (#415); unserer läuft synchron.
const lauf = (err: unknown, r: Response): void => {
  void errorHandler(err, {} as Request, r, (() => {}) as NextFunction);
};

describe('errorHandler – Retry-After (#300)', () => {
  it('setzt den Kopf in SEKUNDEN, aufgerundet', () => {
    const { res, status, setHeader } = fakeRes();
    lauf(new HttpError(503, 'gedrosselt', 30_000), res);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '30');
    expect(status).toHaveBeenCalledWith(503);
  });

  it('rundet Bruchteile auf und nie auf 0 (der Kopf erlaubt keine 0)', () => {
    const { res, setHeader } = fakeRes();
    lauf(new HttpError(503, 'gedrosselt', 1500), res);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '2');

    const b = fakeRes();
    lauf(new HttpError(503, 'gedrosselt', 10), b.res);
    expect(b.setHeader).toHaveBeenCalledWith('Retry-After', '1');
  });

  it('ohne Wartezeit KEIN Kopf – die bestehenden ~58 Fehlerwürfe bleiben unberührt', () => {
    const { res, status, json, setHeader } = fakeRes();
    lauf(new HttpError(404, 'Nicht gefunden'), res);

    expect(setHeader).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: 'Nicht gefunden' });
  });

  it('eine Wartezeit von 0 setzt keinen Kopf', () => {
    const { res, setHeader } = fakeRes();
    lauf(new HttpError(503, 'gedrosselt', 0), res);
    expect(setHeader).not.toHaveBeenCalled();
  });
});

describe('errorHandler – ungültige Eingabe aus zod (#849, zod 4)', () => {
  it('400 mit den Feldern, die nicht passen – nicht 500', () => {
    const { res, status, json } = fakeRes();
    const r = z.object({ titel: z.string().min(1, 'Titel fehlt') }).safeParse({ titel: '' });
    expect(r.success).toBe(false);
    lauf(r.error, res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'Ungültige Eingabe',
      details: { formErrors: [], fieldErrors: { titel: ['Titel fehlt'] } },
    });
  });

  it('auch ein geworfener Fehler aus .parse()', () => {
    const { res, status } = fakeRes();
    try {
      z.number().parse('x');
    } catch (e) {
      lauf(e, res);
    }
    expect(status).toHaveBeenCalledWith(400);
  });
});
