import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * **Ablauf abschließen und öffnen** (Alwin, 09.10.2026). Der Weg über die Seite: Bearbeiten → Schloss →
 * Rückfrage → Hinweis mit „Ablauf öffnen", kein Plus mehr → öffnen → Bearbeiten wie vorher. Der Stub
 * verhält sich wie gemessen (lock/unlock, 403 im abgeschlossenen Ablauf). Eigener Termin im Stub,
 * weil die Tests parallel gegen denselben Stub laufen.
 */
test('Schloss schließt ab, „Ablauf öffnen" öffnet wieder', async ({ page }) => {
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
  // Ein eigener Termin – der Stub ist für alle parallelen Tests derselbe Prozess.
  await page.getByText('Abschlussprobe (Stub)').click();
  await expect(page.getByText('Ansage (Stub)')).toBeVisible();

  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  const plus = page.getByRole('button', { name: 'Eintrag hinzufügen' });
  await expect(plus).toBeVisible();

  await page.getByRole('button', { name: 'Ablauf abschließen' }).click();
  await page.getByRole('button', { name: 'Abschließen', exact: true }).click();

  const hinweis = page.getByText('Dieser Ablauf ist in ChurchTools abgeschlossen');
  await expect(hinweis).toBeVisible({ timeout: 15_000 });
  await expect(plus).toHaveCount(0);

  await page.getByRole('button', { name: 'Ablauf öffnen' }).click();
  await expect(hinweis).toHaveCount(0, { timeout: 15_000 });
  await expect(plus).toBeVisible();
});
