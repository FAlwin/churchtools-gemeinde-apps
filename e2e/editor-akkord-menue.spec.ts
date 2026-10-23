import { test, expect, type Page } from '@playwright/test';
import { DEMO_EDITOR_TEXT } from '../client/src/dev/demoEditorText';

/**
 * **Lied-Editor L5-2: Akkord-Kärtchen antippen** (22.10.2026, Entwurf Variante A) – Menü mit ← →, Ändern,
 * Entfernen; bei offenem Menü ersetzt die Leiste das Kärtchen. Geprüft am gespeicherten Text.
 */
const gespeichert = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __gespeichert?: { text: string } }).__gespeichert?.text,
  );
test.use({ viewport: { width: 1180, height: 820 } });

const ALT = 'Du [A]weißt';
const mit = (neu: string) => DEMO_EDITOR_TEXT.replace(ALT, neu);
const menue = (page: Page) => page.getByRole('group', { name: /^Akkord / });

async function kaertchenA(page: Page) {
  await page.goto('/?demo=editor');
  const zeile = page.locator('.cm-line', { hasText: 'ich bin untreu' });
  await expect(zeile).toBeVisible({ timeout: 30_000 });
  await zeile.locator('.cm-cp-akkord', { hasText: 'A' }).click();
  await expect(menue(page)).toBeVisible();
}
async function speichern(page: Page) {
  await page.getByRole('button', { name: 'Speichern' }).click();
  return gespeichert(page);
}

test('← → schieben das Kärtchen, das Menü bleibt offen; Rückgängig nimmt einen Schritt zurück', async ({
  page,
}) => {
  await kaertchenA(page);
  const rechts = menue(page).getByRole('button', { name: 'Eine Stelle nach rechts' });
  await rechts.click();
  await rechts.click();
  await expect(menue(page)).toBeVisible();
  // Umrahmt ist genau das gewählte Kärtchen – auch nach dem Schieben.
  await expect(page.locator('.cm-cp-akkord.cm-cp-aktiv')).toHaveText(['A']);
  // Das Menü steht beim verschobenen Kärtchen (wandert waagerecht mit), nicht mehr an der alten Stelle.
  const k = (await page
    .locator('.cm-line', { hasText: 'untreu' })
    .locator('.cm-cp-akkord')
    .first()
    .boundingBox())!;
  const m = (await menue(page).boundingBox())!;
  expect(Math.abs(m.x - (k.x - 8))).toBeLessThan(3);
  await page.keyboard.press('Escape');
  await expect(menue(page)).toBeHidden();
  await expect(page.locator('.cm-cp-aktiv')).toHaveCount(0);
  expect(await speichern(page)).toBe(mit('Du we[A]ißt'));
  await page
    .getByRole('region', { name: 'Text' })
    .getByRole('button', { name: 'Rückgängig' })
    .click();
  expect(await speichern(page)).toBe(mit('Du w[A]eißt'));
});

test('Entfernen nimmt den ganzen Akkord heraus', async ({ page }) => {
  await kaertchenA(page);
  await menue(page).getByRole('button', { name: 'Entfernen' }).click();
  await expect(menue(page)).toBeHidden();
  expect(await speichern(page)).toBe(mit('Du weißt'));
});

test('Ändern: das Fenster zeigt den Akkord, „Übernehmen“ ersetzt ihn an derselben Stelle', async ({
  page,
}) => {
  await kaertchenA(page);
  await menue(page).getByRole('button', { name: 'Ändern' }).click();
  await expect(page.getByText('Akkord ändern')).toBeVisible();
  await page.getByRole('button', { name: '7', exact: true }).click();
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  expect(await speichern(page)).toBe(mit('Du [A7]weißt'));
});

test('bei offenem Menü ersetzt ein Akkord aus der Leiste das Kärtchen', async ({ page }) => {
  await kaertchenA(page);
  await page
    .getByRole('group', { name: 'Akkorde' })
    .getByRole('button', { name: 'C#m', exact: true })
    .click();
  await expect(menue(page)).toBeHidden();
  expect(await speichern(page)).toBe(mit('Du [C#m]weißt'));
});

test('am Zeilenrand ist die Richtung gesperrt', async ({ page }) => {
  await page.goto('/?demo=editor');
  // „[B]sag“ steht am Ende der letzten Zeile – dreimal rechts geht noch, dann ist Schluss.
  await page
    .locator('.cm-line', { hasText: 'auch wenn ich ver' })
    .locator('.cm-cp-akkord', { hasText: 'B' })
    .click();
  const rechts = menue(page).getByRole('button', { name: 'Eine Stelle nach rechts' });
  for (let i = 0; i < 3; i++) await rechts.click();
  await expect(rechts).toBeDisabled();
});

test('bei offenem Menü ersetzt auch „Anderer Akkord“ das Kärtchen', async ({ page }) => {
  await kaertchenA(page);
  await page.getByRole('button', { name: 'Anderer Akkord' }).click();
  const feld = page.getByPlaceholder(/Em7/);
  await feld.fill('dsus2');
  await feld.press('Enter');
  expect(await speichern(page)).toBe(mit('Du [Dsus2]weißt'));
});
