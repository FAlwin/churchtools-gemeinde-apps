import { test, expect, type Page } from '@playwright/test';
import { TOUR_SETLIST, TOUR_TERMINE } from '../client/src/utils/onboarding';

/**
 * **Wer darf einen Ablauf bearbeiten** (#635): je Termin, wie ChurchTools (gemessen E6-0, 17.10.2026) – Admin,
 * `edit agenda` für den Kalender des Termins oder Admin des Termins. Der Stub-Musiker darf nur Kalender 1.
 *
 * Als E2E, weil die Regel einzeln getestet ist (`shared/ct/ablaufRecht.test.ts`), die Verdrahtung in der App
 * aber nicht: der Stift im Ablauf und die Auswahl bei „Zu Ablauf hinzufügen".
 */
async function anmelden(page: Page) {
  await page.addInitScript(
    (touren: string[]) => {
      for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
    },
    [TOUR_TERMINE, TOUR_SETLIST],
  );
  await page.goto('/');
  await page.getByLabel(/E-Mail/i).fill('test@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
}

test('fremder Kalender: der Ablauf ist zu sehen, aber kein Stift', async ({ page }) => {
  await anmelden(page);
  await page.getByText('Fremder Kalender (Stub)').click();
  await expect(page.getByText('Begrüßung (Recht)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ablauf bearbeiten' })).toHaveCount(0);
});

test('Admin des Termins: Stift auch ohne Recht für den Kalender', async ({ page }) => {
  await anmelden(page);
  await page.getByText('Termin-Admin (Stub)').click();
  await expect(page.getByText('Begrüßung (Recht)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ablauf bearbeiten' })).toBeVisible();
});

test('„Zu Ablauf hinzufügen" bietet nur Termine an, deren Ablauf man bearbeiten darf', async ({
  page,
}) => {
  await anmelden(page);
  await expect(page.getByText('Gottesdienst (Stub)')).toBeVisible();
  await page.getByRole('button', { name: 'Lieder', exact: true }).click();
  await page
    .getByRole('button', { name: /zu einem Ablauf hinzufügen/ })
    .first()
    .click();
  await expect(page.getByText('Gottesdienst (Stub)')).toBeVisible();
  await expect(page.getByText('Termin-Admin (Stub)')).toBeVisible();
  await expect(page.getByText('Fremder Kalender (Stub)')).toHaveCount(0);
});
