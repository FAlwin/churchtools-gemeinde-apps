import { test, expect, type Page } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Hinzufügen über das schwebende Plus (Alwin, 05.10.2026): „Neuer Eintrag" ist derselbe Dialog wie
 * „Eintrag bearbeiten" – mit dem Umschalter Programmpunkt · Überschrift. Seit Scheibe S2 (26.10.2026) fragt das Plus
 * erst „Option wählen“ wie die ChurchTools-App: am Rechner grün im Seitenkopf mit Menü, am Handy als Blatt von unten.
 *
 * Als E2E, weil die Teile (Dialog, Nutzlast) einzeln getestet sind, der Weg auf der Seite aber nicht:
 * Plus nur im Bearbeiten-Modus, Dialog öffnet mit „Programmpunkt", der angelegte Punkt steht danach in
 * der Liste. Der Stub ist für alle Tests derselbe Prozess – der Punkt wird am Ende wieder gelöscht.
 */
async function anmeldenUndOeffnen(page: Page): Promise<void> {
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
}

test('Plus → Neuer Eintrag (Programmpunkt) → steht im Ablauf, Löschen räumt auf', async ({
  page,
}) => {
  await anmeldenUndOeffnen(page);
  const plus = page.getByRole('button', { name: 'Eintrag hinzufügen' });
  // In der Ansicht kein Plus – erst im Bearbeiten-Modus.
  await expect(plus).toHaveCount(0);
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  await plus.click();
  // Am Rechner: grüner Knopf im Seitenkopf, darunter das Menü „Option wählen“ (S2).
  await expect(page.getByRole('menu', { name: 'Option wählen' })).toBeVisible();
  // Das Menü ragt über die Kopfkarte hinaus – auch der letzte Eintrag muss oben liegen, nicht abgeschnitten.
  // (`click({ trial: true })` merkt das Abschneiden nicht – Gegenprobe 26.10.2026; daher der Blick auf die Stelle.)
  const letzter = page.getByRole('menuitem', { name: 'Überschrift hinzufügen' });
  const box = (await letzter.boundingBox())!;
  const getroffen = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.textContent ?? '',
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(getroffen).toBe('Überschrift hinzufügen');
  await page.getByRole('menuitem', { name: 'Programmpunkt hinzufügen' }).click();

  // Erst das Fenster mit „Programmpunkt" – nicht die Liedsuche (Alwin, 05.10.2026).
  await expect(page.getByText('Neuer Eintrag')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Programmpunkt' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Lied verknüpfen' })).toBeVisible();
  await page.getByPlaceholder('Titel', { exact: true }).fill('Abkündigungen (E2E)');
  await page.getByPlaceholder('z. B. 5').fill('7');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();

  const neu = page.locator('button', { hasText: 'Abkündigungen (E2E)' }).first();
  await expect(neu).toBeVisible();
  await expect(page.getByText('Neuer Eintrag')).toHaveCount(0);

  // Aufräumen über die App selbst: öffnen → löschen → bestätigen.
  await neu.click();
  await page.getByRole('button', { name: /Eintrag löschen/ }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  // Nur die Liste (#root): Der Hinweis „„Abkündigungen (E2E)" gelöscht · Rückgängig" hängt an `body`
  // und nennt den Titel auch – ob er schon steht, hing vom Tempo ab (in der CI rot, 12.10.2026).
  await expect(page.locator('#root').getByText('Abkündigungen (E2E)')).toHaveCount(0);
});

test('am Handy: rundes Plus → Blatt „Option wählen“ → Überschrift (S2)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await anmeldenUndOeffnen(page);
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();

  const blatt = page.getByRole('dialog', { name: 'Option wählen' });
  await expect(blatt).toBeVisible();
  await expect(blatt.getByRole('button', { name: 'Lied hinzufügen' })).toBeVisible();
  await blatt.getByRole('button', { name: 'Überschrift hinzufügen' }).click();

  await expect(blatt).toHaveCount(0);
  await expect(page.getByPlaceholder('Titel der Überschrift')).toBeVisible();
  // Nichts anlegen – der Stub ist für alle Tests derselbe Prozess.
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByText('Neuer Eintrag')).toHaveCount(0);
});
