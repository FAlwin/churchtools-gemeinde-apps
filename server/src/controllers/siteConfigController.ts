/**
 * Endpunkte für den (festen) Gemeinde-Namen.
 *  - GET /api/site-config (öffentlich): aktuelle Werte – auch für den Login-Screen
 *  - PUT /api/site-config (nur Admin):  Gemeinde-Namen speichern
 */
import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { einstellungenPruefen } from '@shared/ct/einstellungen';
import { getSiteConfig, saveSiteConfig } from '../services/siteConfig.js';
import { getGroupRoles, getGroups } from '../services/ctCapabilities.js';
import { readSession, isSessionExpired } from '../middleware/session.js';
import { ctCookie } from '../utils/ctCookie.js';

/**
 * GET /api/site-config – öffentlich (der Login-Screen braucht Name/Logo/Links, bevor man
 * angemeldet ist). Für NICHT angemeldete Aufrufe werden nur die Anzeige-Felder geliefert; die
 * internen Gruppen-/Rollen-IDs (`musicianGroupIds`/`noteRoles`) bleiben leer, damit sie nicht
 * unauthentifiziert nach außen gelangen. Angemeldete (u. a. die Admin-Einstellungen) erhalten
 * die vollständige Konfiguration.
 */
export async function getSiteConfigCtrl(req: Request, res: Response): Promise<void> {
  const cfg = await getSiteConfig();
  const session = readSession(req);
  const authed = !!session && !isSessionExpired(session.issuedAt);
  if (authed) {
    res.json(cfg);
    return;
  }
  res.json({
    appName: cfg.appName,
    description: cfg.description,
    orgName: cfg.orgName,
    links: cfg.links,
    // Kein internes Feld – und ohne es fiele das Gerät beim Abmelden still auf „Akkorde" zurück
    // (es merkt sich die Ansicht aus der zuletzt geladenen Einstellung, `standardAnsicht.ts`).
    standardAnsicht: cfg.standardAnsicht,
    musicianGroupIds: [],
    noteRoles: [],
  });
}

/**
 * PUT /api/site-config (nur Admin). Prüfen und Zusammensetzen über `einstellungenPruefen` – dieselbe
 * Regel wie in der Erweiterung. Bis 3b-4 zählte diese Stelle die Felder einzeln auf – jedes neue Feld
 * musste hier eigens nachgetragen werden.
 */
export async function putSiteConfigCtrl(req: Request, res: Response): Promise<void> {
  const geprueft = einstellungenPruefen(
    req.body,
    (status, meldung) => new HttpError(status, meldung),
  );
  res.json(await saveSiteConfig(geprueft));
}

/** GET /api/groups (nur Admin) – ChurchTools-Gruppen für das Dropdown „Gruppen-Zuweisung". */
export async function getGroupsCtrl(req: Request, res: Response): Promise<void> {
  res.json(await getGroups(ctCookie(req)));
}

/** GET /api/groups/:id/roles (nur Admin) – Rollen einer Gruppe für die Rollen-Zuweisung. */
export async function getGroupRolesCtrl(req: Request, res: Response): Promise<void> {
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new HttpError(400, 'Ungültige Gruppen-ID.');
  }
  res.json(await getGroupRoles(ctCookie(req), groupId));
}
