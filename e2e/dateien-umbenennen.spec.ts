import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Datei umbenennen (31.10.2026) – gegen den ChurchTools-Stub, also mit echtem Server und echter Route
 * (`PATCH /api/songs/:songId/arrangements/:arrangementId/files/:fileId`). Die Regeln prüfen die Unit-Tests; hier geht es
 * um die Kette Stift → Fenster → Server → ChurchTools → Nachlesen → Liste. Ob die Route angemeldet ist, sagt nur dieser
 * Test.
 *
 * Der Stub ändert den Namen wirklich (wie gemessen). Am Ende heißt die Datei wieder wie vorher – der Lauf hinterlässt
 * keinen Zustand für andere Tests.
 */
const TOUREN = [TOUR_TERMINE, TOUR_CHART, TOUR_SETLIST, TOUR_SETLIST_EDIT];
const ORIGINAL = 'Testlied aus ChurchTools.chordpro';

test('Datei umbenennen: Endung fest, Versions-Name gesperrt, neuer Name in der Liste', async ({
  page,
}) => {
  await page.addInitScript((touren: string[]) => {
    for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
  }, TOUREN);
  await page.goto('/');
  // Admin: nur mit „Lieder bearbeiten“ steht „Dateien verwalten“ im Lied-Menü.
  await page.getByLabel(/E-Mail/i).fill('admin@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
  await expect(page.getByText('Gottesdienst (Stub)')).toBeVisible({ timeout: 20_000 });
  await page.getByText('Gottesdienst (Stub)').click();
  await page.getByText('Testlied aus ChurchTools').first().click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  await page
    .getByRole('navigation', { name: 'Lieder im Ablauf' })
    .locator('[aria-current="true"]')
    .click();
  await page.getByText('Dateien verwalten', { exact: true }).click();
  await expect(page.getByText(ORIGINAL, { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByLabel(`„${ORIGINAL}" umbenennen`).click();
  const feld = page.getByLabel('Name', { exact: true });
  const knopf = page.getByRole('button', { name: 'Umbenennen', exact: true });
  await expect(feld).toHaveValue('Testlied aus ChurchTools');
  await expect(page.getByText('.chordpro', { exact: true })).toBeVisible();
  await expect(knopf).toBeDisabled();

  // So hieße eine Version – das Arrangement verlöre sein Notenblatt.
  await feld.fill('Testlied — Live (App)');
  await expect(page.getByRole('alert')).toContainText('Versionen aus dem Editor');
  await expect(knopf).toBeDisabled();

  await feld.fill('Testlied Probe');
  await knopf.click();
  await expect(page.getByText('Datei heißt jetzt „Testlied Probe.chordpro".')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Testlied Probe.chordpro', { exact: true })).toBeVisible();

  // Zurück – der Stub-Zustand bleibt, wie er war.
  await page.getByLabel('„Testlied Probe.chordpro" umbenennen').click();
  await page.getByLabel('Name', { exact: true }).fill('Testlied aus ChurchTools');
  await page.getByRole('button', { name: 'Umbenennen', exact: true }).click();
  await expect(page.getByText(ORIGINAL, { exact: true })).toBeVisible({ timeout: 20_000 });
});
