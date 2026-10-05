import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Hinzufügen über das schwebende Plus (Alwin, 05.10.2026): „Neuer Eintrag" ist derselbe Dialog wie
 * „Eintrag bearbeiten" – mit dem Umschalter Programmpunkt · Überschrift.
 *
 * Als E2E, weil die Teile (Dialog, Nutzlast) einzeln getestet sind, der Weg auf der Seite aber nicht:
 * Plus nur im Bearbeiten-Modus, Dialog öffnet mit „Programmpunkt", der angelegte Punkt steht danach in
 * der Liste. Der Stub ist für alle Tests derselbe Prozess – der Punkt wird am Ende wieder gelöscht.
 */
test('Plus → Neuer Eintrag (Programmpunkt) → steht im Ablauf, Löschen räumt auf', async ({
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

  const plus = page.getByRole('button', { name: 'Eintrag hinzufügen' });
  // In der Ansicht kein Plus – erst im Bearbeiten-Modus.
  await expect(plus).toHaveCount(0);
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  await plus.click();

  // Erst das Fenster mit „Programmpunkt" – nicht die Liedsuche (Alwin, 05.10.2026).
  await expect(page.getByText('Neuer Eintrag')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Programmpunkt' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Lied verknüpfen' })).toBeVisible();
  await page.getByPlaceholder('Titel', { exact: true }).fill('Abkündigungen (E2E)');
  await page.getByPlaceholder('z. B. 5').fill('7');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();

  const neu = page.locator('button', { hasText: 'Abkündigungen (E2E)' }).first();
  await expect(neu).toBeVisible();
  await expect(page.getByText('Neuer Eintrag')).toHaveCount(0);

  // Aufräumen über die App selbst: öffnen → löschen → bestätigen.
  await neu.click();
  await page.getByRole('button', { name: /Eintrag löschen/ }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page.getByText('Abkündigungen (E2E)')).toHaveCount(0);
});
