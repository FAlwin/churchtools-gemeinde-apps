import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Die Lied-Statistik aus ChurchTools (08.10.2026): ein Aufruf `getSongStatistic`, je Arrangement die
 * Termine. Als E2E, weil die Kette nur hier am Stück läuft – Recht in `/permissions/global` → Reiter
 * sichtbar → `/api/song-usage` (Server prüft das Recht) → alte Schnittstelle → Zahl in der Liste.
 * Der Stub meldet für das Arrangement des Testlieds einen Termin vor einer Woche.
 */
test('Lieder → Häufigkeit zeigt die Zahl aus der ChurchTools-Statistik', async ({ page }) => {
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
  }, TOUR_TERMINE);

  await page.goto('/');
  await page.getByLabel(/E-Mail/i).fill('test@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
  await page.getByRole('button', { name: 'Lieder', exact: true }).click();

  // Seit 30.10.2026 steht „zuletzt …“ in jeder Sortierung – auch bei A–Z, ohne umzuschalten.
  await expect(page.getByText(/^zuletzt \d\d\.\d\d\.\d{4}$/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Häufigkeit' }).click();
  await expect(page.getByText(/^1× · zuletzt /).first()).toBeVisible();
});

/**
 * **Zuletzt gesungen im Lied-Menü** (Alwin beim Planen, 30.10.2026): dieselbe Statistik, oben im Fenster des Lieds.
 * Am Stück, weil der Weg über das Liedblatt (Recht → Statistik → Lied-ID des aktiven Lieds) nur hier zusammenläuft.
 */
test('Liedblatt → Lied-Menü zeigt oben, wann das Lied zuletzt gesungen wurde', async ({ page }) => {
  await page.addInitScript(
    (touren: string[]) => {
      for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
      localStorage.setItem('worship:onboard-hint-vollbild', '1');
    },
    [TOUR_TERMINE, TOUR_CHART, TOUR_SETLIST, TOUR_SETLIST_EDIT],
  );
  await page.goto('/');
  await page.getByLabel(/E-Mail/i).fill('test@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
  await page.getByText('Gottesdienst (Stub)').click();
  await page.getByText('Testlied aus ChurchTools').first().click();
  await page
    .getByRole('navigation', { name: 'Lieder im Ablauf' })
    .locator('[aria-current="true"]')
    .click();
  const fenster = page.getByRole('dialog');
  await expect(fenster.getByText('Zuletzt gesungen')).toBeVisible({ timeout: 20_000 });
  await expect(fenster.getByText(/^\d\d\.\d\d\.\d{4}$/)).toBeVisible();
});
