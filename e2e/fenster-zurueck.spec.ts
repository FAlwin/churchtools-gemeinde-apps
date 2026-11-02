import { test, expect, type Page } from '@playwright/test';
import * as onboarding from '../client/src/utils/onboarding';

/**
 * „‹“ in Fenstern, die aus einem anderen aufgehen (Alwin, 02.11.2026: „Es wäre schön, wenn man von den Dateien zurück
 * zu der vorherigen Seite kommt … Wechselt ein Screen im Fenster, soll es einen Zurück-Pfeil geben“). Gegen den Stub mit
 * echtem Server: Ob die Seiten den Pfeil wirklich an die richtige Stelle verdrahten, sagt nur der Durchklick – die
 * Unit-Tests prüfen die Fenster einzeln.
 *
 * Und: Fenster nur zum Ansehen haben unten kein „Schließen“ mehr – es täte dasselbe wie das X.
 */
// Alle Einführungen als gesehen – auch die des Stammdaten-Fensters, die sonst über dem Pfeil läge.
const TOUREN = Object.entries(onboarding)
  .filter(([k, v]) => k.startsWith('TOUR_') && typeof v === 'string')
  .map(([, v]) => v as string);

async function anmelden(page: Page) {
  await page.addInitScript((touren: string[]) => {
    for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
  }, TOUREN);
  await page.goto('/');
  // Admin: nur mit „Lieder bearbeiten“ stehen „Dateien verwalten“ und „Stammdaten“ im Lied-Menü.
  await page.getByLabel(/E-Mail/i).fill('admin@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
  await expect(page.getByText('Gottesdienst (Stub)')).toBeVisible({ timeout: 20_000 });
}

async function liedMenue(page: Page) {
  await page
    .getByRole('navigation', { name: 'Lieder im Ablauf' })
    .locator('[aria-current="true"]')
    .click();
  await expect(page.getByText('Dateien verwalten', { exact: true })).toBeVisible();
}

test('Lied-Menü → Dateien / Stammdaten: „‹“ führt zurück ins Lied-Menü, X schließt ganz', async ({
  page,
}) => {
  await anmelden(page);
  await page.getByText('Gottesdienst (Stub)').click();
  await page.getByText('Testlied aus ChurchTools').first().click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  await liedMenue(page);
  await page.getByText('Dateien verwalten', { exact: true }).click();
  const dateien = page.getByRole('dialog', { name: /^Dateien/ });
  await expect(dateien).toBeVisible();
  await expect(dateien.getByRole('button', { name: 'Schließen', exact: true })).toHaveCount(0);
  await dateien.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByText('Dateien verwalten', { exact: true })).toBeVisible();

  await page.getByText('Stammdaten …', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zurück', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByText('Dateien verwalten', { exact: true })).toBeVisible();

  await page.getByText('Dateien verwalten', { exact: true }).click();
  await page
    .getByRole('dialog', { name: /^Dateien/ })
    .getByRole('button', { name: 'Fenster schließen' })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Neues Lied: aus dem Formular mit „‹“ zurück zur Suche', async ({ page }) => {
  await anmelden(page);
  await page.getByText('Lieder', { exact: true }).click();
  await page.getByRole('button', { name: /Neues Lied/ }).click();
  const suche = page.getByRole('dialog', { name: 'Neues Lied' });
  await suche.getByRole('textbox').fill('Ganz neues Lied');
  await suche.getByRole('button', { name: /Selbst eintippen/ }).click();
  await expect(page.getByRole('button', { name: 'Lied anlegen' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByRole('button', { name: /Selbst eintippen/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lied anlegen' })).toHaveCount(0);
});
