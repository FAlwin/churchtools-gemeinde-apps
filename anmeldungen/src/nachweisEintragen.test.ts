import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import * as V from '@ui/ct/verbindung';
import { ChurchToolsBremst, fehlerAus, verbindungEinrichten } from '@ui/ct/verbindung';
import * as Kern from '@shared/anmeldung/nachweisEintragen';
import type { EintragErgebnis } from '@shared/anmeldung/nachweisEintragen';
import * as Gruppenart from '@shared/ct/gruppenart';
import * as Nachweise from './nachweise';
import * as Arten from './nachweisArten';
import * as Einrichten from './einrichten';
import * as Personen from './nachweisPersonen';
import * as Ablage from './nachweisStandAblage';
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
vi.mock('./nachweisArten', async (original) => ({
  ...(await original<typeof import('./nachweisArten')>()),
  adminNachziehen: vi.fn(),
}));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  anmeldungsArt: vi.fn(),
  leitungsRollen: vi.fn(),
}));
vi.mock('./nachweisPersonen', async (original) => ({
  ...(await original<typeof import('./nachweisPersonen')>()),
  nachweisPersonenLesen: vi.fn(),
}));
vi.mock('./nachweisStandAblage', async (original) => ({
  ...(await original<typeof import('./nachweisStandAblage')>()),
  nachweisStandAktualisieren: vi.fn(),
}));
vi.mock('@shared/ct/gruppenart', async (original) => ({
  ...(await original<typeof import('@shared/ct/gruppenart')>()),
  gruppenartRollen: vi.fn(),
}));
vi.mock('@shared/anmeldung/nachweisEintragen', async (original) => ({
  ...(await original<typeof import('@shared/anmeldung/nachweisEintragen')>()),
  nachweiseEintragen: vi.fn(),
}));
vi.mock('@ui/ct/verbindung', async (original) => ({
  ...(await original<typeof import('@ui/ct/verbindung')>()),
  ctDaten: vi.fn(),
}));
const nachweise = vi.mocked(Nachweise);
const arten = vi.mocked(Arten);
const einrichten = vi.mocked(Einrichten);
const personen = vi.mocked(Personen);
const ablage = vi.mocked(Ablage);
const gruppenart = vi.mocked(Gruppenart);
const kern = vi.mocked(Kern);
const verbindung = vi.mocked(V);

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

describe('nachweiseBeimOeffnen – der Lauf drumherum (Admin nachziehen, Stand danach)', () => {
  const EINST = { gueltigJahre: 5, ab: 'ausstellung', betreff: 'B', text: 'T' } as const;
  const art = (id: number) => ({ id, name: `Art ${id}`, einstellungen: { ...EINST } });
  const ergebnis = (x: Partial<EintragErgebnis> = {}): EintragErgebnis => ({
    arten: [art(61), art(62)],
    neu: new Map(),
    verweigert: [],
    abbruch: null,
    ...x,
  });
  const grundlage = (darfEinrichten: boolean, rechtFehlt: boolean | null) =>
    nachweise.nachweisGrundlageLesen.mockResolvedValue({ typId: 11, rechtFehlt, darfEinrichten });

  beforeEach(() => {
    vi.stubGlobal('navigator', {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    arten.adminNachziehen.mockReset().mockResolvedValue(true);
    einrichten.anmeldungsArt.mockReset().mockResolvedValue(5);
    einrichten.leitungsRollen.mockReset().mockResolvedValue(new Set([35]));
    gruppenart.gruppenartRollen.mockReset().mockResolvedValue({ leiter: 56, teilnehmer: 53 });
    verbindung.ctDaten.mockReset().mockResolvedValue({ id: 368 });
    personen.nachweisPersonenLesen.mockReset().mockResolvedValue([]);
    ablage.nachweisStandAktualisieren.mockReset().mockResolvedValue([]);
    kern.nachweiseEintragen.mockReset().mockResolvedValue(ergebnis());
  });

  it('Admin mit fehlendem Recht: zieht nach, bevor eingetragen wird; Kontext aus ChurchTools', async () => {
    grundlage(true, true);
    await nachweiseBeimOeffnen();
    expect(arten.adminNachziehen).toHaveBeenCalledTimes(1);
    expect(kern.nachweiseEintragen).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ich: 368,
        admin: true,
        nachweisTyp: 11,
        leiterRolle: 56,
        teilnehmerRolle: 53,
        anmeldungTyp: 5,
        leitung: new Set([35]),
      }),
    );
  });

  it('nichts fehlt oder kein Admin: kein Nachziehen', async () => {
    grundlage(true, false);
    await nachweiseBeimOeffnen();
    _vergissLauf();
    grundlage(false, true);
    await nachweiseBeimOeffnen();
    expect(arten.adminNachziehen).not.toHaveBeenCalled();
    expect(kern.nachweiseEintragen).toHaveBeenCalledTimes(2);
  });

  it('Neue: Stand nur für die Arten mit Neuen, aus frischer Lesung; Meldung zählt die Neuen', async () => {
    grundlage(false, false);
    const leute = [{ personId: 10 }] as never;
    personen.nachweisPersonenLesen.mockResolvedValue(leute);
    kern.nachweiseEintragen.mockResolvedValue(ergebnis({ neu: new Map([[61, [10]]]) }));
    expect(await nachweiseBeimOeffnen()).toBe('1 Person zum Nachweis angemeldet.');
    expect(personen.nachweisPersonenLesen).toHaveBeenCalledTimes(1);
    expect(personen.nachweisPersonenLesen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 61 }),
      53,
    );
    expect(ablage.nachweisStandAktualisieren).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 61, personen: leute })],
      expect.any(String),
    );
  });

  it('keine Neuen: kein Stand geschrieben', async () => {
    grundlage(false, false);
    await nachweiseBeimOeffnen();
    expect(personen.nachweisPersonenLesen).not.toHaveBeenCalled();
    expect(ablage.nachweisStandAktualisieren).not.toHaveBeenCalled();
  });

  it('Stand scheitert: die Meldung kommt trotzdem (eingetragen ist eingetragen)', async () => {
    grundlage(false, false);
    kern.nachweiseEintragen.mockResolvedValue(ergebnis({ neu: new Map([[61, [10, 11]]]) }));
    ablage.nachweisStandAktualisieren.mockRejectedValue(new ApiError(503, 'weg'));
    expect(await nachweiseBeimOeffnen()).toBe('2 Personen zum Nachweis angemeldet.');
  });

  it('ohne Gruppenart „Anmeldung“ oder Rollen: kein Lauf', async () => {
    grundlage(false, false);
    einrichten.anmeldungsArt.mockResolvedValue(null);
    expect(await nachweiseBeimOeffnen()).toBeNull();
    expect(kern.nachweiseEintragen).not.toHaveBeenCalled();
  });
});
