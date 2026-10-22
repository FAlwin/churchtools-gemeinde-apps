import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Hinweis für Bearbeitende, die nicht alle Dienstgruppen sehen (#676). Als E2E, weil der Wert über den Server-Weg
 * kommt: Rechte (`/api/capabilities` liest `/servicegroups`) → `App.tsx` → Bearbeiten-Liste. Der Stub-Musiker hat kein
 * Recht an „Technik“; nur gelesen, nichts geschrieben.
 */
test('wer nicht alle Dienstgruppen sieht, bekommt beim Bearbeiten den Hinweis', async ({
  page,
}) => {
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
  await page.getByText('Gottesdienst (Stub)').click();
  await expect(page.getByText('Begrüßung')).toBeVisible();
  const hinweis = page.getByText(/Du siehst nicht alle Dienstgruppen/);
  // In der Ansicht nicht – nur beim Bearbeiten.
  await expect(hinweis).toHaveCount(0);
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  await expect(hinweis).toBeVisible();
});
