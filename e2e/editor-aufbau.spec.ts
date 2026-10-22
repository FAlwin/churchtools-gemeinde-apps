import { test, expect, type Page } from '@playwright/test';
import { DEMO_EDITOR_TEXT } from '../client/src/dev/demoEditorText';

/**
 * **Lied-Editor, neuer Aufbau (L1, 22.10.2026):** Kopf im ChurchTools-Look, breit Text und Vorschau
 * nebeneinander, schmal „Text | Vorschau“. Der Text darf dabei nicht angefasst werden – gespeichert wird
 * Zeichen für Zeichen, was im Editor steht (Grundsatz des Bauplans). Geprüft über die Demo
 * `?demo=editor`, die das Gespeicherte an `window.__gespeichert` hängt.
 */
const gespeichert = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __gespeichert?: { text: string; name: string } }).__gespeichert,
  );

async function oeffnen(page: Page) {
  await page.goto('/?demo=editor');
  await expect(page.getByRole('region', { name: 'Text' })).toBeVisible({ timeout: 30_000 });
}

test.describe('breit (iPad)', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('Text und Vorschau nebeneinander; Speichern liefert den Text unverändert', async ({
    page,
  }) => {
    await oeffnen(page);
    await expect(page.getByRole('region', { name: 'Vorschau' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Ansicht' })).toHaveCount(0);
    await expect(page.getByRole('banner')).toContainText('Tonart E');
    await page.getByRole('button', { name: 'Speichern' }).click();
    expect(await gespeichert(page)).toEqual({ text: DEMO_EDITOR_TEXT, name: 'Akustik' });
  });
});

test.describe('schmal (Handy)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Umschalter Text | Vorschau; danach Speichern liefert den Text unverändert', async ({
    page,
  }) => {
    await oeffnen(page);
    const ansicht = page.getByRole('group', { name: 'Ansicht' });
    await ansicht.getByRole('button', { name: 'Vorschau' }).click();
    await expect(page.getByRole('region', { name: 'Vorschau' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Text' })).toBeHidden();
    await ansicht.getByRole('button', { name: 'Text' }).click();
    await expect(page.getByRole('region', { name: 'Text' })).toBeVisible();
    // Der Titel hat Platz – nicht zu „T…“ zusammengeschrumpft.
    const titel = page.getByRole('banner').getByText('Treu', { exact: true });
    expect(await titel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Speichern' }).click();
    expect(await gespeichert(page)).toEqual({ text: DEMO_EDITOR_TEXT, name: 'Akustik' });
  });
});
