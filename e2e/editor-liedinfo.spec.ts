import { test, expect, type Page } from '@playwright/test';

/**
 * **Lied-Editor L4: Liedinfo** (23.10.2026, Entwurf C). Die Demo hat Stammdaten wie aus ChurchTools: Autor
 * „Gerster“ – im Notenblatt steht „Tobias Gerster“ (Hinweis am Feld).
 */
async function oeffnen(page: Page) {
  await page.goto('/?demo=editor&liedinfo');
  await expect(page.locator('.cm-cp-akkord').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('breit (iPad)', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('Kopfzeilen aus der Liedinfo sind im Text ausgeblendet, {key} bleibt – im ChordPro-Text alles sichtbar', async ({
    page,
  }) => {
    await oeffnen(page);
    const text = page.locator('.cm-content');
    await expect(text).not.toContainText('{title');
    await expect(text).not.toContainText('{artist');
    await expect(text).toContainText('{key: E}');
    await page.getByRole('button', { name: 'ChordPro-Text' }).click();
    await expect(text).toContainText('{title: Treu}');
    await expect(text).toContainText('{artist: Tobias Gerster}');
  });

  test('„Vorschau | Liedinfo“: Hinweis am Feld, „übernehmen“ setzt den Wert aus dem Notenblatt', async ({
    page,
  }) => {
    await oeffnen(page);
    await page
      .getByRole('group', { name: 'Rechte Spalte' })
      .getByRole('button', { name: 'Liedinfo' })
      .click();
    const info = page.getByRole('region', { name: 'Liedinfo' });
    await expect(page.getByRole('region', { name: 'Vorschau' })).toBeHidden();
    const autor = info.getByLabel('Interpret / Autor');
    await expect(autor).toHaveValue('Gerster');
    await expect(info).toContainText('Im Notenblatt steht:');
    await info.getByRole('button', { name: 'übernehmen' }).click();
    await expect(autor).toHaveValue('Tobias Gerster');
    await expect(info).not.toContainText('Im Notenblatt steht:');
    await expect(info.getByLabel('Tempo')).toHaveValue('72');
  });
});

test.describe('schmal (Handy)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Reiter „Infos“ zeigt die Liedinfo', async ({ page }) => {
    await oeffnen(page);
    await page
      .getByRole('group', { name: 'Ansicht' })
      .getByRole('button', { name: 'Infos' })
      .click();
    await expect(page.getByRole('region', { name: 'Liedinfo' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Text' })).toBeHidden();
  });
});

test.describe('Speichern (L4-3)', () => {
  test.use({ viewport: { width: 1180, height: 820 } });
  const gespeichert = (page: Page) =>
    page.evaluate(
      () => (window as unknown as { __gespeichert?: { text: string } }).__gespeichert?.text,
    );
  const anCT = (page: Page) =>
    page.evaluate(() => (window as unknown as { __liedinfo?: unknown }).__liedinfo);

  test('Liedinfo geht an ChurchTools, die Kopfzeilen verlassen das Notenblatt – {key} bleibt', async ({
    page,
  }) => {
    await oeffnen(page);
    await page
      .getByRole('group', { name: 'Rechte Spalte' })
      .getByRole('button', { name: 'Liedinfo' })
      .click();
    const info = page.getByRole('region', { name: 'Liedinfo' });
    await info.getByRole('button', { name: 'übernehmen' }).click();
    await info.getByLabel('Takt').fill('6/8');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect.poll(() => gespeichert(page)).toBeTruthy();
    expect(await anCT(page)).toEqual({
      lied: { author: 'Tobias Gerster' },
      arrangement: expect.objectContaining({ name: 'Standard', beat: '6/8' }) as unknown,
    });
    const text = (await gespeichert(page))!;
    expect(text).not.toContain('{title');
    expect(text).not.toContain('{artist');
    expect(text).toContain('{key: E}');
    expect(text).toContain('[E]bleibst');
  });
});
