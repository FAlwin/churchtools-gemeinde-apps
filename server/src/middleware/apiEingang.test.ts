import { describe, it, expect, afterEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { apiEingang } from './apiEingang.js';
import { errorHandler } from './errorHandler.js';

/**
 * #844: Der Eingang zählt erst und liest dann, und nur Anmerkungen/Einstellungen dürfen groß sein.
 * Ein echter Mini-Server mit dem echten Eingang und dem echten Fehler-Handler – wie in `index.ts`.
 */
let server: Server | null = null;

async function starte(opts: { max?: number } = {}): Promise<string> {
  const app = express();
  app.use(apiEingang(opts));
  const groesse: express.RequestHandler = (req, res) =>
    res.json({ zeichen: JSON.stringify(req.body ?? null).length });
  app.post('/api/auth/login', groesse);
  app.put('/api/services/1/agenda/items/2', groesse);
  app.put('/api/annotations/lied-1', groesse);
  app.put('/api/settings', groesse);
  app.use(errorHandler);
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      resolve(`http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`);
    });
  });
}

/** Ein JSON-Rumpf von ungefähr `bytes` Größe. */
const rumpf = (bytes: number) => JSON.stringify({ strokes: 'x'.repeat(bytes) });

const schicke = (base: string, pfad: string, body: string, method = 'PUT') =>
  fetch(`${base}${pfad}`, { method, headers: { 'Content-Type': 'application/json' }, body });

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

describe('apiEingang: Grenzen (#844)', () => {
  it('2 MB an eine gewöhnliche Route → 413 mit Meldung, kein 500', async () => {
    const base = await starte();
    const res = await schicke(base, '/api/services/1/agenda/items/2', rumpf(2_000_000));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Die Daten sind zu groß.' });
  });

  it('2 MB anonym an den Login → 413', async () => {
    const base = await starte();
    expect((await schicke(base, '/api/auth/login', rumpf(2_000_000), 'POST')).status).toBe(413);
  });

  it('500 kB an eine gewöhnliche Route gehen durch (gelöschter Ablaufpunkt mit vielen Infos)', async () => {
    const base = await starte();
    const res = await schicke(base, '/api/services/1/agenda/items/2', rumpf(500_000));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { zeichen: number }).zeichen).toBeGreaterThan(500_000);
  });

  it('6 MB Anmerkungs-Striche gehen durch', async () => {
    const base = await starte();
    const res = await schicke(base, '/api/annotations/lied-1', rumpf(6_000_000));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { zeichen: number }).zeichen).toBeGreaterThan(6_000_000);
  });

  it('2 MB Einstellungen gehen durch', async () => {
    const base = await starte();
    expect((await schicke(base, '/api/settings', rumpf(2_000_000))).status).toBe(200);
  });

  it('über 8 MB sind auch bei Anmerkungen zu groß', async () => {
    const base = await starte();
    expect((await schicke(base, '/api/annotations/lied-1', rumpf(9_000_000))).status).toBe(413);
  });

  it('kaputtes JSON → 400 ohne Fehlerzeile im Log', async () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    const base = await starte();
    const res = await schicke(base, '/api/auth/login', '{"email":', 'POST');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Ungültige Eingabe' });
    expect(fehler).not.toHaveBeenCalled();
  });
});

describe('apiEingang: erst zählen, dann lesen (#844)', () => {
  it('über dem Kontingent kommt 429, bevor der Rumpf gelesen wird', async () => {
    const base = await starte({ max: 2 });
    for (let i = 0; i < 2; i++) {
      expect((await schicke(base, '/api/auth/login', '{}', 'POST')).status).toBe(200);
    }
    // Kaputtes JSON: Läse der Parser zuerst, käme 400. Das Rate-Limit muss vorher abweisen.
    expect((await schicke(base, '/api/auth/login', '{"email":', 'POST')).status).toBe(429);
    // Auch ein zu großer Rumpf kostet dann nichts mehr: 429 statt 413.
    expect((await schicke(base, '/api/auth/login', rumpf(2_000_000), 'POST')).status).toBe(429);
  });
});

describe('apiEingang: schreibend nur von der eigenen Seite (#849)', () => {
  const mit = (base: string, methode: string, herkunft?: string) =>
    fetch(`${base}/api/auth/login`, {
      method: methode,
      headers: {
        'Content-Type': 'application/json',
        ...(herkunft ? { 'Sec-Fetch-Site': herkunft } : {}),
      },
      ...(methode === 'GET' ? {} : { body: '{}' }),
    });

  it('eine andere Seite derselben Domain (same-site) wird abgewiesen – das ist der Fall von SameSite=Lax', async () => {
    const base = await starte();
    const res = await mit(base, 'POST', 'same-site');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Diese Anfrage kommt nicht aus der App.' });
  });

  it('eine fremde Seite (cross-site) ebenso', async () => {
    const base = await starte();
    expect((await mit(base, 'POST', 'cross-site')).status).toBe(403);
  });

  it('die eigene Seite (same-origin) geht durch', async () => {
    const base = await starte();
    expect((await mit(base, 'POST', 'same-origin')).status).toBe(200);
  });

  it('ohne den Kopf (alter Browser, curl) bleibt es beim bisherigen Verhalten', async () => {
    const base = await starte();
    expect((await mit(base, 'POST')).status).toBe(200);
  });

  it('lesen ist von überall erlaubt (der Login-Bildschirm, Links aus anderen Apps)', async () => {
    const base = await starte();
    const app = await fetch(`${base}/api/auth/login`, {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    });
    expect(app.status).not.toBe(403);
  });
});
