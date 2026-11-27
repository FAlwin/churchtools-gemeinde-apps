import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { ChurchToolsBremst, fehlerAus, verbindungEinrichten } from '@ui/ct/verbindung';
import type { EintragErgebnis } from '@shared/anmeldung/nachweisEintragen';
import * as Nachweise from './nachweise';
import {
  SPERRE,
  _vergissLauf,
  eintragMeldung,
  fehlerArt,
  nachweiseBeimOeffnen,
} from './nachweisEintragen';

/**
 * Die Erweiterungs-Seite von „Eintragen beim Öffnen“ (N3c): wie Fehler der echten Verbindung zählen (aus `fehlerAus` mit
 * den gemessenen Rümpfen, nicht von Hand gebaut), die stille Meldung und „einmal je Seite, nie in zwei Tabs zugleich“. Den
 * Lauf selbst prüft `shared/anmeldung/nachweisEintragen.test.ts`.
 */
vi.mock('./nachweise', async (original) => ({
  ...(await original<typeof import('./nachweise')>()),
  nachweisGrundlageLesen: vi.fn(),
}));
const nachweise = vi.mocked(Nachweise);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  verbindungEinrichten({});
  _vergissLauf();
  nachweise.nachweisGrundlageLesen.mockReset();
  nachweise.nachweisGrundlageLesen.mockResolvedValue({
    typId: null,
    rechtFehlt: null,
    darfEinrichten: false,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fehlerArt – die Zweige einzeln', () => {
  it('403 „schon drin“ (M11): schonDrin', async () => {
    const body = {
      message: 'Die Person ist bereits in der Gruppe',
      messageKey: 'member.add.already-in-group',
    };
    expect(fehlerArt(await fehlerAus(json(403, body), body))).toBe('schonDrin');
  });

  it('anderes 403 (error.forbidden…): keinRecht', async () => {
    const body = {
      message: 'Du darfst zu dieser Gruppe keine Gruppenmitglieder hinzufügen.',
      messageKey: 'error.forbidden.add.group.member',
    };
    expect(fehlerArt(await fehlerAus(json(403, body), body))).toBe('keinRecht');
  });

  it('Drosselung: die Bremse der Verbindung und ein rohes 429 – bremse', () => {
    expect(fehlerArt(new ChurchToolsBremst(30_000))).toBe('bremse');
    expect(fehlerArt(new ApiError(429, 'zu viele'))).toBe('bremse');
  });

  it('5xx, Zeitüberschreitung, Netz, abgemeldet, Unbekanntes: voruebergehend', async () => {
    expect(fehlerArt(await fehlerAus(json(503, {}), {}))).toBe('voruebergehend');
    expect(fehlerArt(new ApiError(504, 'Zeit'))).toBe('voruebergehend');
    expect(fehlerArt(new TypeError('Failed to fetch'))).toBe('voruebergehend');
    expect(fehlerArt(new ApiError(401, 'abgemeldet'))).toBe('voruebergehend');
    expect(fehlerArt('irgendwas')).toBe('voruebergehend');
  });
});

describe('eintragMeldung – höchstens eine stille Meldung', () => {
  const r = (x: Partial<EintragErgebnis>): EintragErgebnis => ({
    arten: [],
    neu: new Map(),
    verweigert: [],
    abbruch: null,
    ...x,
  });
  it('nachgelesen Neue zählen (über alle Arten)', () => {
    expect(eintragMeldung(r({ neu: new Map([[61, [10]]]) }))).toBe(
      '1 Person zum Nachweis angemeldet.',
    );
    expect(
      eintragMeldung(
        r({
          neu: new Map([
            [61, [10, 11]],
            [62, [10]],
          ]),
        }),
      ),
    ).toBe('3 Personen zum Nachweis angemeldet.');
  });
  it('fehlendes Recht (sehen oder eintragen): ein Hinweis; sonst nichts', () => {
    expect(eintragMeldung(r({ abbruch: 'ohneRecht' }))).toMatch(/fehlt noch ein Recht/);
    expect(eintragMeldung(r({ verweigert: [61] }))).toMatch(/fehlt noch ein Recht/);
    expect(eintragMeldung(r({}))).toBeNull();
    expect(eintragMeldung(r({ abbruch: 'bremse' }))).toBeNull();
    expect(eintragMeldung(r({ abbruch: 'voruebergehend' }))).toBeNull();
  });
});

describe('nachweiseBeimOeffnen – einmal je Seite, nie doppelt', () => {
  it('zweimal gerufen: ein Lauf', async () => {
    vi.stubGlobal('navigator', {});
    await Promise.all([nachweiseBeimOeffnen(), nachweiseBeimOeffnen()]);
    expect(nachweise.nachweisGrundlageLesen).toHaveBeenCalledTimes(1);
  });

  it('Sperre in einem anderen Tab belegt: kein Lauf', async () => {
    const request = vi.fn(
      async (_n: string, _o: { ifAvailable: boolean }, f: (s: unknown) => unknown) => f(null),
    );
    vi.stubGlobal('navigator', { locks: { request } });
    expect(await nachweiseBeimOeffnen()).toBeNull();
    expect(request).toHaveBeenCalledWith(SPERRE, { ifAvailable: true }, expect.any(Function));
    expect(nachweise.nachweisGrundlageLesen).not.toHaveBeenCalled();
  });

  it('Sperre frei: läuft unter der Sperre', async () => {
    const request = vi.fn(
      async (_n: string, _o: { ifAvailable: boolean }, f: (s: unknown) => unknown) =>
        f({ name: SPERRE }),
    );
    vi.stubGlobal('navigator', { locks: { request } });
    await nachweiseBeimOeffnen();
    expect(nachweise.nachweisGrundlageLesen).toHaveBeenCalledTimes(1);
  });

  it('ein Fehler stört die Erweiterung nie: null statt Ausnahme', async () => {
    vi.stubGlobal('navigator', {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    nachweise.nachweisGrundlageLesen.mockRejectedValue(new ApiError(503, 'weg'));
    expect(await nachweiseBeimOeffnen()).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});
