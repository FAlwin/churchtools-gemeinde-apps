import { test, expect } from '@playwright/test';
import { TOUR_CHART } from '../client/src/utils/onboarding';

/**
 * **Scheibe B3: Fußleiste im ChurchTools-Look** (30.10.2026, Entwurf Variante B). „‹ Zurück“ · „Nächstes Lied: …“ ·
 * „Weiter ›“ (blau) – die Punktreihe ist weg, gesprungen wird über die Ablauf-Leiste oben. Geprüft wird das Blättern
 * über die Liedgrenzen bis zum letzten Lied, mit der Demo-Ansicht (mehrere Lieder, ohne Anmeldung).
 */
// iPad hochkant: eine Seite je Bild. Quer stehen zwei nebeneinander – am Ende ist dort das vorletzte Lied (links)
// gewählt, und „Nächstes Lied“ nennt das rechte; das ist seit B2 so und hier nicht das Thema.
test.use({ viewport: { width: 834, height: 1194 } });

test('Weiter blättert über die Liedgrenzen bis zum letzten Lied – dort „Letztes Lied“, Weiter gesperrt', async ({
  page,
}) => {
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
    localStorage.setItem('worship:onboard-hint-vollbild', '1');
  }, TOUR_CHART);
  await page.goto('/?demo=chart');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });

  const weiter = page.getByRole('button', { name: 'Weiter / nächste Seite' });
  const zurueck = page.getByRole('button', { name: 'Zurück / vorige Seite' });
  const info = page.locator('[class*="ftrInfo"]');
  // Die Knöpfe tragen ihr Wort – wie im Kopf, keine nackten Pfeile mehr; die Punktreihe ist weg.
  await expect(weiter).toHaveText('Weiter');
  await expect(zurueck).toHaveText('Zurück');
  await expect(zurueck).toBeDisabled();
  await expect(page.locator('[class*="dots"]')).toHaveCount(0);
  await expect(info).toContainText('Nächstes Lied:');

  const gesehen: string[] = [];
  for (let i = 0; i < 40 && !(await weiter.isDisabled()); i++) {
    const text = await info.innerText();
    if (gesehen[gesehen.length - 1] !== text) gesehen.push(text);
    await weiter.click();
  }
  await expect(weiter).toBeDisabled();
  await expect(info).toHaveText('Letztes Lied');
  // Unterwegs wechselte „Nächstes Lied“ mindestens einmal – es ging wirklich über eine Liedgrenze.
  expect(gesehen.length).toBeGreaterThan(1);
  await zurueck.click();
  await expect(weiter).toBeEnabled();
});

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('nur die Pfeile und „Nächstes: …“', async ({ page }) => {
    await page.addInitScript((tour: string) => {
      localStorage.setItem(`worship:onboard-${tour}`, '1');
      localStorage.setItem('worship:onboard-hint-vollbild', '1');
    }, TOUR_CHART);
    await page.goto('/?demo=chart');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    const weiter = page.getByRole('button', { name: 'Weiter / nächste Seite' });
    await expect(weiter.getByText('Weiter')).toBeHidden();
    const info = page.locator('[class*="ftrInfo"]');
    await expect(info.getByText('Nächstes:', { exact: true })).toBeVisible();
    await expect(info.getByText('Nächstes Lied:', { exact: true })).toBeHidden();
  });
});
