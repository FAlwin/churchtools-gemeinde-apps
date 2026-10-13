import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * **Ablauf abschließen und öffnen** (Alwin, 09.10.2026; seit 13.10.2026 ohne Kasten). Der Weg über die
 * Seite: Bearbeiten → Schloss → Rückfrage → oben „Ablauf öffnen", das Plus zeigt nur den Hinweis →
 * öffnen → Bearbeiten wie vorher. Der Stub verhält sich wie gemessen (lock/unlock, 403 im
 * abgeschlossenen Ablauf). Eigener Termin im Stub, weil die Tests parallel gegen denselben Stub laufen.
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

  // Abgeschlossen (Alwin, 13.10.2026): kein Kasten, oben rechts „Ablauf öffnen". Wer trotzdem ändern
  // will, bekommt den Hinweis – hier über das Plus.
  const oeffnen = page.getByRole('button', { name: 'Ablauf öffnen' });
  await expect(oeffnen).toBeVisible({ timeout: 15_000 });
  await plus.click();
  await expect(page.getByText(/Dieser Ablauf ist in ChurchTools abgeschlossen/)).toBeVisible();
  await expect(page.getByText('Neuer Eintrag')).toHaveCount(0);

  await oeffnen.click();
  await expect(page.getByRole('button', { name: 'Ablauf abschließen' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(oeffnen).toHaveCount(0);
});
