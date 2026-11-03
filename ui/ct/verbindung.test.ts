import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChurchToolsBremst,
  ctAlleSeiten,
  ctAltAnfrage,
  ctAnfrage,
  ctHochladen,
  fehlerAus,
  KeinSpeicherRecht,
  verbindungEinrichten,
  _bremseLoesen,
  _vergissCsrf,
} from './verbindung';
import { FakeXhr } from './xhr.testutil';

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

  it('der Rumpf der Antwort bleibt am Fehler – z. B. die Nummer der doppelten Person (A7-4)', async () => {
    const doppelt = {
      message: 'Es gibt bereits eine Person mit diesem Namen.',
      args: { duplicatePersonId: 149 },
    };
    const e = await fehlerAus(json(400, doppelt), doppelt);
    expect([e.status, e.message, e.daten]).toEqual([400, doppelt.message, doppelt]);
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

describe('ctAlleSeiten (#480)', () => {
  /** Eine Liste mit `n` Einträgen, so seitenweise ausgeliefert wie ChurchTools (`meta.pagination`). */
  function liste(n: number, mitMeta = true) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input));
      const limit = Number(url.searchParams.get('limit'));
      const seite = Number(url.searchParams.get('page'));
      const data = Array.from({ length: n }, (_, i) => i).slice((seite - 1) * limit, seite * limit);
      const lastPage = Math.ceil(n / limit);
      return Promise.resolve(
        json(200, mitMeta ? { data, meta: { pagination: { lastPage } } } : { data }),
      );
    });
  }

  it('blättert bis zur letzten Seite – 25 Einträge bei 10 je Seite sind 3 Abfragen', async () => {
    const spy = liste(25);
    expect(await ctAlleSeiten<number>('/groups/1/members', 10)).toHaveLength(25);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(String(spy.mock.calls[2][0])).toBe(
      'https://ct.test/api/groups/1/members?limit=10&page=3',
    );
  });

  it('genau volle letzte Seite: nach lastPage aufhören, keine leere Extra-Abfrage', async () => {
    const spy = liste(20);
    expect(await ctAlleSeiten<number>('/groups/1/members', 10)).toHaveLength(20);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('leere Liste (lastPage 0) → eine Abfrage, leeres Ergebnis', async () => {
    const spy = liste(0);
    expect(await ctAlleSeiten('/groups/1/members', 10)).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('ohne Angabe zur letzten Seite: bis eine Seite kürzer ist; Pfad mit ? bekommt &', async () => {
    const spy = liste(20, false);
    expect(await ctAlleSeiten<number>('/groups?ids[]=4', 10)).toHaveLength(20);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(String(spy.mock.calls[0][0])).toBe('https://ct.test/api/groups?ids[]=4&limit=10&page=1');
  });

  it('mehr als maxSeiten → Fehler statt einer halben Liste', async () => {
    liste(50);
    await expect(ctAlleSeiten('/songs', 10, 3)).rejects.toThrow('mehr als 30 Einträge');
  });
});

describe('ctAltAnfrage mit Modul und JSON (A7-5)', () => {
  it('churchhome mit JSON-Rumpf: func, Felder, CSRF-Token, X-Requested-With; success → data', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) =>
        String(url).endsWith('/api/csrftoken')
          ? json(200, { data: 'TOK' })
          : json(200, { status: 'success', data: null }),
      );
    await expect(
      ctAltAnfrage('sendEMailToPersonIds', {}, {}, { modul: 'churchhome', json: { ids: '140' } }),
    ).resolves.toBeNull();
    const [url, init] = spy.mock.calls.at(-1)!;
    expect(url).toBe('https://ct.test/index.php?q=churchhome/ajax');
    expect(JSON.parse(String(init!.body))).toEqual({ ids: '140', func: 'sendEMailToPersonIds' });
    const kopf = init!.headers as Record<string, string>;
    expect([kopf['CSRF-Token'], kopf['X-Requested-With'], kopf['Content-Type']]).toEqual([
      'TOK',
      'XMLHttpRequest',
      'application/json',
    ]);
  });

  it('status error → AltFehler „abgelehnt“ mit der Meldung; HTML statt JSON → „unlesbar“', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/api/csrftoken')
        ? json(200, { data: 'TOK' })
        : json(200, { status: 'error', message: 'Keine Empfänger' }),
    );
    await expect(
      ctAltAnfrage('x', {}, {}, { modul: 'churchhome', json: {} }),
    ).rejects.toMatchObject({
      art: 'abgelehnt',
      status: 502,
      message: 'Keine Empfänger',
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/api/csrftoken')
        ? json(200, { data: 'TOK' })
        : new Response('<html>Anmelden</html>', { status: 200 }),
    );
    await expect(
      ctAltAnfrage('x', {}, {}, { modul: 'churchhome', json: {} }),
    ).rejects.toMatchObject({
      art: 'unlesbar',
    });
  });
});

describe('ctHochladen – mit Fortschritt (Dienstplaner T2b)', () => {
  const form = () => {
    const f = new FormData();
    f.append('files[]', new Blob(['x']), 'a.txt');
    return f;
  };
  beforeEach(() => {
    FakeXhr.zuruecksetzen();
    _bremseLoesen();
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/api/csrftoken') ? json(200, { data: 'TOK' }) : json(200, {}),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  /** Bis `send` gelaufen ist (vorher wird das CSRF-Token geholt). */
  const gesendet = async () => {
    await vi.waitFor(() => expect(FakeXhr.letzte?.rumpf).toBeTruthy());
    return FakeXhr.letzte!;
  };

  it('POST an die API mit Sitzung und CSRF-Token; meldet den Fortschritt; liefert den Rumpf', async () => {
    const anteile: number[] = [];
    const p = ctHochladen('/files/service/160', form(), { fortschritt: (a) => anteile.push(a) });
    const x = await gesendet();
    expect([x.methode, x.url, x.withCredentials, x.kopf['CSRF-Token']]).toEqual([
      'POST',
      'https://ct.test/api/files/service/160',
      true,
      'TOK',
    ]);
    x.fortschritt(25, 100);
    x.fortschritt(100, 100);
    x.gesendet();
    x.antworte(200, { data: [{ id: 5 }] });
    expect(await p).toEqual({ data: [{ id: 5 }] });
    expect(anteile).toEqual([0.25, 1, 1]);
  });

  it('Zeitgrenze für STILLSTAND: Fortschritt hält sie offen, 60 s ohne alles → 504 und abgebrochen', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const p = ctHochladen('/files/service/160', form());
    const x = await gesendet();
    // Läuft insgesamt über 60 s, aber es geht voran – kein Abbruch.
    await vi.advanceTimersByTimeAsync(50_000);
    x.fortschritt(10, 100);
    await vi.advanceTimersByTimeAsync(50_000);
    x.fortschritt(60, 100);
    await vi.advanceTimersByTimeAsync(50_000);
    expect(x.abgebrochen).toBe(false);
    const fehler = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await fehler).toMatchObject({ status: 504 });
    expect(x.abgebrochen).toBe(true);
  });

  it('nach dem Senden wartet die Wache auf die Antwort – auch sie darf nicht ewig ausbleiben', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const p = ctHochladen('/files/service/160', form());
    const x = await gesendet();
    await vi.advanceTimersByTimeAsync(50_000);
    x.gesendet();
    // Ab „gesendet“ hat ChurchTools wieder volle 60 s – nicht nur den Rest.
    await vi.advanceTimersByTimeAsync(59_000);
    expect(x.abgebrochen).toBe(false);
    const fehler = p.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(await fehler).toMatchObject({ status: 504 });
  });

  it('kein Recht (403 von ChurchTools) → KeinSpeicherRecht mit der Meldung des Aufrufs', async () => {
    const p = ctHochladen('/files/service/160', form(), { verweigert: 'Darfst du nicht.' });
    (await gesendet()).antworte(403, VERBOT);
    await expect(p).rejects.toBeInstanceOf(KeinSpeicherRecht);
    await expect(p).rejects.toMatchObject({ message: 'Darfst du nicht.' });
  });

  it('413 vom Webserver (HTML statt JSON) → Fehler mit Status 413', async () => {
    const p = ctHochladen('/files/service/160', form());
    (await gesendet()).antworte(413, '<html>Request Entity Too Large</html>', {
      'content-type': 'text/html',
    });
    await expect(p).rejects.toMatchObject({ status: 413 });
  });

  it('204 ohne Rumpf → null', async () => {
    const p = ctHochladen('/files/service/160', form());
    (await gesendet()).antworte(204, null);
    expect(await p).toBeNull();
  });

  it('Netzfehler → wie fetch ein TypeError', async () => {
    const p = ctHochladen('/files/service/160', form());
    (await gesendet()).netzfehler();
    await expect(p).rejects.toBeInstanceOf(TypeError);
  });

  it('429 → gebremst, danach geht gerätweit nichts raus', async () => {
    const p = ctHochladen('/files/service/160', form());
    (await gesendet()).antworte(429, {}, { 'retry-after': '30' });
    await expect(p).rejects.toBeInstanceOf(ChurchToolsBremst);
    await expect(ctHochladen('/files/service/160', form())).rejects.toBeInstanceOf(
      ChurchToolsBremst,
    );
    expect(FakeXhr.alle).toHaveLength(1);
  });
});
