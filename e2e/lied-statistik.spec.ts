import { test, expect } from '@playwright/test';
import { TOUR_TERMINE } from '../client/src/utils/onboarding';

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

  await page.getByRole('button', { name: 'Häufigkeit' }).click();
  await expect(page.getByText('1× gespielt')).toBeVisible();
});
