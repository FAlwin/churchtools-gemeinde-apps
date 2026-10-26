import { test, expect, type Page } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * **Seitenköpfe im ChurchTools-Look** (Scheibe S, 26.10.2026): Reiter am iPad oben, am Handy unten; im Ablauf eine
 * Kopfkarte mit „← Termine“ und beschrifteten Knöpfen (am Handy nur Symbol). Nur lesend gegen den Stub.
 */
async function anmeldenUndAblauf(page: Page) {
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
  const reiter = page.getByRole('navigation', { name: 'Bereiche' });
  const titel = page.getByRole('heading', { name: 'Termine' });
  await expect(titel).toBeVisible();
  const lage = {
    reiter: (await reiter.boundingBox())!.y,
    titel: (await titel.boundingBox())!.y,
  };
  await page.getByText('Abschlussprobe (Stub)').click();
  await expect(page.getByText('Ansage (Stub)')).toBeVisible();
  return lage;
}

test.describe('iPad', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('Reiter oben; Ablauf mit „← Termine“ und beschriftetem „Bearbeiten“', async ({ page }) => {
    const lage = await anmeldenUndAblauf(page);
    expect(lage.reiter).toBeLessThan(lage.titel);
    const zurueck = page.getByRole('button', { name: 'Zurück zu Termine' });
    await expect(zurueck).toHaveText('Termine', { useInnerText: true });
    await expect(page.getByRole('button', { name: 'Ablauf bearbeiten' })).toHaveText('Bearbeiten', {
      useInnerText: true,
    });
    await zurueck.click();
    await expect(page.getByRole('heading', { name: 'Termine' })).toBeVisible();
  });
});

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Reiter unten; Kopfknöpfe nur als Symbol, „← Termine“ behält den Text', async ({ page }) => {
    const lage = await anmeldenUndAblauf(page);
    expect(lage.reiter).toBeGreaterThan(lage.titel);
    await expect(page.getByRole('button', { name: 'Zurück zu Termine' })).toHaveText('Termine', {
      useInnerText: true,
    });
    await expect(page.getByRole('button', { name: 'Ablauf bearbeiten' })).toHaveText('', {
      useInnerText: true,
    });
  });
});
