import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ctAnfrage, fehlerAus, verbindungEinrichten, _vergissCsrf } from './verbindung';

/**
 * Die Verbindung ohne die Musik-App (#474) – so, wie eine neue Erweiterung sie vorfindet. Die
 * Fehler-Übersetzung selbst prüft `client/src/services/ctRuntime.test.ts` Zweig für Zweig.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VERBOT = { message: 'Keine ausreichende Berechtigung.', messageKey: 'error.forbidden.view' };

beforeEach(() => {
  _vergissCsrf();
  verbindungEinrichten({});
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verbindungEinrichten', () => {
  it('ohne Einstellung: allgemeine Meldung bei fehlendem Recht, nichts über das Speichern', async () => {
    const e = await fehlerAus(json(403, VERBOT), VERBOT);
    expect(e.message).toContain('ChurchTools erlaubt dir das nicht');
    expect(e.message).not.toContain('Personendaten');
  });

  it('die eingestellte Meldung gilt – ein zweiter Aufruf ohne sie setzt zurück', async () => {
    verbindungEinrichten({ keinRecht: 'Dafür brauchst du die Leitung der Gruppe.' });
    expect((await fehlerAus(json(403, VERBOT), VERBOT)).message).toBe(
      'Dafür brauchst du die Leitung der Gruppe.',
    );
    verbindungEinrichten({});
    expect((await fehlerAus(json(403, VERBOT), VERBOT)).message).toContain(
      'ChurchTools erlaubt dir das nicht',
    );
  });

  it('eine Meldung des Aufrufs geht der eingestellten vor', async () => {
    verbindungEinrichten({ keinRecht: 'eingestellt' });
    expect((await fehlerAus(json(403, VERBOT), VERBOT, 'vom Aufruf')).message).toBe('vom Aufruf');
  });

  it('meldet die Erreichbarkeit an die App: keine Antwort → false, Antwort → true', async () => {
    const erreichbar = vi.fn();
    verbindungEinrichten({ erreichbar });
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(ctAnfrage('/whoami')).rejects.toThrow('Failed to fetch');
    expect(erreichbar).toHaveBeenLastCalledWith(false);
    spy.mockResolvedValue(json(200, { data: 1 }));
    await ctAnfrage('/whoami');
    expect(erreichbar).toHaveBeenLastCalledWith(true);
  });

  it('ohne Einstellung wird nichts gemeldet und nichts geht kaputt', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { data: 1 }));
    await expect(ctAnfrage('/whoami')).resolves.toEqual({ data: 1 });
  });
});
