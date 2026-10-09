import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { leeren, tempVerzeichnis } from '../testHilfen/tempAblage.js';

/**
 * **Abmelden beendet die Sitzung serverseitig wirklich** (#460).
 *
 * Das App-Cookie trägt den ChurchTools-Anmeldeschlüssel; `getMe` holt damit still eine neue
 * ChurchTools-Sitzung. Eine VOR dem Abmelden kopierte App-Sitzung konnte sich so bis zu 90 Tage lang
 * selbst wiederbeleben – `postLogout` beendete nur die ChurchTools-Sitzung. Jetzt merkt sich der
 * Server die Anmeldung (Konto + Login-Zeitpunkt) als beendet.
 */
vi.mock('../services/ctAuth.js', () => ({
  whoami: vi.fn(),
  logout: vi.fn(),
  login: vi.fn(),
  holeAnmeldeSchluessel: vi.fn(),
  sitzungAusSchluessel: vi.fn(),
}));

const dir = tempVerzeichnis('abmelden-test');
process.env.ANNOTATIONS_PATH = dir;

const { HttpError } = await import('../middleware/errorHandler.js');
const { readSession, setSession } = await import('../middleware/session.js');
const ct = await import('../services/ctAuth.js');
const { getMe, postLogout } = await import('./authController.js');
const ablage = await import('../services/abmeldungen.js');

const TOKEN = 'T'.repeat(40) + 'persoenlich';
const USER = { id: 42, firstName: 'Alwin', lastName: 'F' };
const VOR_FUENF_TAGEN = Date.now() - 5 * 86_400_000;

/** Ein Cookie-Wert, wie der Browser ihn hält – über `setSession` gebaut, also verschlüsselt. */
function cookieWert(issuedAt = VOR_FUENF_TAGEN): string {
  const cookie = vi.fn();
  setSession({ cookie } as unknown as Response, {
    ctCookie: 'ChurchToolsV2_ct_x=alt',
    issuedAt,
    userId: 42,
    loginToken: TOKEN,
  });
  return String(cookie.mock.calls[0][1]);
}

function reqRes(wert: string) {
  const json = vi.fn();
  const clearCookie = vi.fn();
  const cookie = vi.fn();
  return {
    req: { signedCookies: { ct_session: wert } } as unknown as Request,
    res: { json, clearCookie, cookie } as unknown as Response,
    json,
  };
}

beforeEach(async () => {
  await leeren(dir);
  ablage.__resetAbmeldungenForTests();
  // ChurchTools hat seine Sitzung beendet – genau dann würde der Schlüssel sie wiederbeleben.
  vi.mocked(ct.whoami).mockRejectedValue(new HttpError(401, 'Session abgelaufen.'));
  vi.mocked(ct.sitzungAusSchluessel).mockResolvedValue({ cookie: 'neu', user: USER });
});

describe('postLogout – auch eine kopierte Sitzung ist danach tot (#460)', () => {
  it('Cookie vor dem Abmelden kopiert → danach weder angemeldet noch erneuert', async () => {
    const kopie = cookieWert();
    await postLogout(reqRes(kopie).req, reqRes(kopie).res);

    const { req, res, json } = reqRes(kopie);
    await getMe(req, res);
    expect(json).toHaveBeenCalledWith({ authenticated: false });
    expect(ct.sitzungAusSchluessel).not.toHaveBeenCalled();
    expect(readSession(req)).toBeNull();
  });

  it('ein anderes Gerät derselben Person bleibt angemeldet (anderer Login-Zeitpunkt)', async () => {
    const handy = cookieWert();
    const ipad = cookieWert(VOR_FUENF_TAGEN + 60_000);
    await postLogout(reqRes(handy).req, reqRes(handy).res);

    const { req, res, json } = reqRes(ipad);
    await getMe(req, res);
    expect(json).toHaveBeenCalledWith({ authenticated: true, user: USER });
  });

  it('übersteht einen Neustart – die Sperre liegt im Daten-Volume', async () => {
    const kopie = cookieWert();
    await postLogout(reqRes(kopie).req, reqRes(kopie).res);
    expect(JSON.parse(await fs.readFile(path.join(dir, 'abmeldungen.json'), 'utf8'))).toEqual({
      [`u42@${VOR_FUENF_TAGEN}`]: VOR_FUENF_TAGEN + 90 * 86_400_000,
    });

    ablage.__resetAbmeldungenForTests(); // „Neustart": Speicher leer …
    expect(readSession(reqRes(kopie).req)).not.toBeNull();
    await ablage.abmeldungenLaden(); // … und beim Start wieder gelesen
    expect(readSession(reqRes(kopie).req)).toBeNull();
  });

  it('abgelaufene Einträge fallen beim nächsten Abmelden heraus', async () => {
    const uralt = Date.now() - 91 * 86_400_000;
    await ablage.alsAbgemeldetMerken(`u42@${uralt}`, uralt + 90 * 86_400_000);
    const kopie = cookieWert();
    await postLogout(reqRes(kopie).req, reqRes(kopie).res);
    const gespeichert = JSON.parse(
      await fs.readFile(path.join(dir, 'abmeldungen.json'), 'utf8'),
    ) as Record<string, number>;
    expect(Object.keys(gespeichert)).toEqual([`u42@${VOR_FUENF_TAGEN}`]);
  });

  it('scheitert das Speichern, gilt die Sperre trotzdem bis zum Neustart – und das Abmelden klappt', async () => {
    // Ein VERZEICHNIS an Stelle der Datei → das Umbenennen scheitert verlässlich (wie in sharing.test).
    await fs.mkdir(path.join(dir, 'abmeldungen.json'), { recursive: true });
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    const kopie = cookieWert();
    const { req, res, json } = reqRes(kopie);
    await postLogout(req, res);
    expect(json).toHaveBeenCalledWith({ authenticated: false });
    expect(fehler).toHaveBeenCalled();
    expect(readSession(reqRes(kopie).req)).toBeNull();
  });
});
