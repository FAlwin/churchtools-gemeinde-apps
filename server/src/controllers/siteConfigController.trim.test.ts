/**
 * Wachtest (#152): `GET /api/site-config` ist ÖFFENTLICH (der Login-Screen braucht Name/Links).
 * Unauthentifiziert dürfen die internen IDs (`musicianGroupIds`/`noteRoles`) NICHT nach außen
 * gelangen; angemeldet schon (die Admin-Einstellungen brauchen sie). Der Test hält die
 * Beschneidung fest, damit ein Refactoring sie nicht still entfernt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const FULL = {
  appName: 'Worship Charts',
  description: 'Chord Charts',
  orgName: 'ECG Donrath',
  links: [{ label: 'Website', url: 'https://example.org' }],
  musicianGroupIds: [9],
  noteRoles: [{ groupId: 9, roles: [15, 16] }],
  standardAnsicht: 'dokument',
};

vi.mock('../services/siteConfig.js', () => ({
  getSiteConfig: () => Promise.resolve(FULL),
  saveSiteConfig: vi.fn(),
}));
vi.mock('../services/ctCapabilities.js', () => ({ getGroups: vi.fn(), getGroupRoles: vi.fn() }));

const readSession = vi.fn();
const isSessionExpired = vi.fn();
vi.mock('../middleware/session.js', () => ({
  readSession: (...a: unknown[]) => readSession(...a),
  isSessionExpired: (...a: unknown[]) => isSessionExpired(...a),
}));

const { getSiteConfigCtrl, putSiteConfigCtrl } = await import('./siteConfigController.js');
const siteConfig = await import('../services/siteConfig.js');

function runCtrl(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const res = { json: (body: Record<string, unknown>) => resolve(body) } as unknown as Response;
    void getSiteConfigCtrl({} as Request, res);
  });
}

beforeEach(() => {
  readSession.mockReset();
  isSessionExpired.mockReset();
});

describe('GET /api/site-config – Beschneidung ohne Anmeldung (#152)', () => {
  it('liefert unauthentifiziert KEINE musicianGroupIds/noteRoles', async () => {
    readSession.mockReturnValue(null);
    const body = await runCtrl();
    expect(body.musicianGroupIds).toEqual([]);
    expect(body.noteRoles).toEqual([]);
    // Anzeige-Felder bleiben da (der Login-Screen braucht sie).
    expect(body.orgName).toBe('ECG Donrath');
    expect(body.links).toEqual(FULL.links);
    // Die Standard-Ansicht ist kein internes Feld: Fehlte sie hier, merkte sich das Gerät auf dem
    // Anmelde-Bildschirm „Akkorde" und verlöre die Wahl der Gemeinde (07.10.2026).
    expect(body.standardAnsicht).toBe('dokument');
  });

  it('beschneidet auch bei ABGELAUFENER Session', async () => {
    readSession.mockReturnValue({ issuedAt: 1 });
    isSessionExpired.mockReturnValue(true);
    const body = await runCtrl();
    expect(body.musicianGroupIds).toEqual([]);
    expect(body.noteRoles).toEqual([]);
  });

  it('liefert angemeldet die vollständige Konfiguration', async () => {
    readSession.mockReturnValue({ issuedAt: Date.now() });
    isSessionExpired.mockReturnValue(false);
    const body = await runCtrl();
    expect(body.musicianGroupIds).toEqual([9]);
    expect(body.noteRoles).toEqual(FULL.noteRoles);
  });
});

describe('PUT /api/site-config – reicht jedes Feld weiter', () => {
  /**
   * Gegen die echte Prüfung (`einstellungenPruefen`), nicht gegen eine Attrappe des Schemas: Bis 3b-4
   * zählte der Controller die Felder einzeln auf, und ein vergessenes Feld wäre still verloren gegangen.
   */
  it('jedes einstellbare Feld kommt beim Speichern an', async () => {
    const body = {
      orgName: 'ECG Donrath',
      links: [{ id: 'w', label: 'Website', url: 'https://example.org', showOnLogin: false }],
      musicianGroupIds: [9],
      noteRoles: [{ groupId: 9, roles: [15] }],
      terminArten: [{ id: 'gd', name: 'Gottesdienst', suchwort: 'Gottes' }],
      standardAnsicht: 'dokument',
    };
    vi.mocked(siteConfig.saveSiteConfig).mockResolvedValue(body as never);
    const res = { json: vi.fn() } as unknown as Response;
    await putSiteConfigCtrl({ body } as Request, res);
    expect(siteConfig.saveSiteConfig).toHaveBeenCalledWith(expect.objectContaining(body));
  });

  it('lehnt einen Link ohne http(s) mit 400 ab', async () => {
    const body = {
      orgName: 'ECG',
      links: [{ id: 'x', label: 'X', url: 'javascript:alert(1)', showOnLogin: false }],
    };
    await expect(
      putSiteConfigCtrl({ body } as Request, { json: vi.fn() } as unknown as Response),
    ).rejects.toMatchObject({ status: 400 });
  });
});
