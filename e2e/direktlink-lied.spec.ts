import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Direktlink aus dem Dienstplaner (E6-O O4, Alwin 28.10.2026): „In der Musik-App öffnen“ in der Lied-Ansicht führt auf
 * `#/termin/<Termin>/punkt/<Punkt>`. Die App öffnet dann gleich das Blatt dieses Lieds im Ablauf dieses Termins – und
 * nimmt den Direktlink aus der Adresse, damit ein Neuladen nicht wieder hinspringt.
 */
async function anmelden(page: import('@playwright/test').Page) {
  await page.addInitScript(
    (touren: string[]) => {
      for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
    },
    [TOUR_TERMINE, TOUR_CHART, TOUR_SETLIST, TOUR_SETLIST_EDIT],
  );
  await page.goto('/');
  await page.getByLabel(/E-Mail/i).fill('test@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
  await expect(page.getByText('Gottesdienst (Stub)')).toBeVisible();
}

test('Punkt mit Lied: öffnet gleich das Blatt; der Direktlink verschwindet aus der Adresse', async ({
  page,
}) => {
  await anmelden(page);
  // Ein frischer Seitenaufruf wie aus dem Dienstplaner – ein Hash-Wechsel allein lädt die Seite nicht neu.
  await page.evaluate(() => window.history.replaceState(null, '', '/#/termin/1500/punkt/2'));
  await page.reload();
  await expect(page.getByText('Testlied aus ChurchTools').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Ablauf bearbeiten' })).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('');
});

test('Punkt ohne Lied: öffnet den Ablauf des Termins', async ({ page }) => {
  await anmelden(page);
  // Ein frischer Seitenaufruf wie aus dem Dienstplaner – ein Hash-Wechsel allein lädt die Seite nicht neu.
  await page.evaluate(() => window.history.replaceState(null, '', '/#/termin/1500/punkt/1'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ablauf bearbeiten' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Begrüßung')).toBeVisible();
});
