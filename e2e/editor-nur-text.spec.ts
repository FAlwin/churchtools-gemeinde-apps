import { test, expect, type Page } from '@playwright/test';
import { DEMO_EDITOR_TEXT } from '../client/src/dev/demoEditorText';
import { cursorInZeile } from './werkzeug';

/**
 * **Lied-Editor „Nur Text“** (Alwin, 29.10.2026; Entwurf Variante B): Umschalter „Akkorde & Text | Nur Text“ in der
 * Werkzeugleiste. Bei „Nur Text“ sind die Akkorde unsichtbar, bleiben aber im Text. Entschieden: Wer ein Wort samt
 * unsichtbarem Akkord markiert und löscht, löscht den Akkord mit – die einzelne Rücktaste (oder Entf) neben einem
 * Akkord löscht dagegen nur den sichtbaren Buchstaben. Geprüft am gespeicherten Text.
 */
const gespeichert = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __gespeichert?: { text: string } }).__gespeichert?.text,
  );

test.use({ viewport: { width: 1180, height: 820 } });

const ERST = DEMO_EDITOR_TEXT.indexOf('[E]bleibst');
const ohne = (von: number, bis: number) =>
  DEMO_EDITOR_TEXT.slice(0, von) + DEMO_EDITOR_TEXT.slice(bis);

async function nurText(page: Page) {
  await page.goto('/?demo=editor');
  await expect(page.locator('.cm-cp-akkord').first()).toBeVisible({ timeout: 30_000 });
  await page
    .getByRole('group', { name: 'Darstellung' })
    .getByRole('button', { name: 'Nur Text' })
    .click();
  await expect(page.locator('.cm-cp-akkord')).toHaveCount(0);
}

async function speichern(page: Page) {
  await page.getByRole('button', { name: 'Speichern' }).click();
  return gespeichert(page);
}

test('„Nur Text“ blendet Kärtchen und Akkord-Leiste aus – „Akkorde & Text“ holt sie zurück, gespeichert wird unverändert', async ({
  page,
}) => {
  await nurText(page);
  const text = page.locator('.cm-content');
  await expect(text).toContainText('Du bleibst an meiner Seite');
  await expect(text).not.toContainText('[E]');
  await expect(page.getByRole('group', { name: 'Akkorde', exact: true })).toHaveCount(0);
  // Die Teile bleiben als Band – nur die Akkorde verschwinden.
  await expect(page.locator('.cm-cp-band')).toHaveText(['Vers', 'Chorus']);
  await page
    .getByRole('group', { name: 'Darstellung' })
    .getByRole('button', { name: 'Akkorde & Text' })
    .click();
  await expect(page.locator('.cm-cp-akkord').first()).toHaveText('E');
  await expect(page.getByRole('group', { name: 'Akkorde', exact: true })).toBeVisible();
  expect(await speichern(page)).toBe(DEMO_EDITOR_TEXT);
});

test('Rücktaste direkt hinter einem unsichtbaren Akkord löscht den Buchstaben davor – der Akkord bleibt', async ({
  page,
}) => {
  await nurText(page);
  await cursorInZeile(page, 'bleibst an meiner Seite', 3); // „Du |“, vor dem unsichtbaren [E]
  await page.keyboard.press('ArrowRight'); // über den Akkord hinweg vor das „b“
  await page.keyboard.press('Backspace');
  // Weg ist das Leerzeichen vor dem Akkord, nicht der Akkord.
  expect(await speichern(page)).toBe(ohne(ERST - 1, ERST));
});

test('Entf direkt vor einem unsichtbaren Akkord löscht den Buchstaben dahinter – der Akkord bleibt', async ({
  page,
}) => {
  await nurText(page);
  await cursorInZeile(page, 'bleibst an meiner Seite', 3); // „Du |[E]bleibst“
  await page.keyboard.press('Delete');
  expect(await speichern(page)).toBe(ohne(ERST + 3, ERST + 4)); // „Du [E]leibst“
});

test('ein Wort samt unsichtbarem Akkord markiert und gelöscht – der Akkord geht mit', async ({
  page,
}) => {
  await nurText(page);
  await cursorInZeile(page, 'bleibst an meiner Seite', 3); // „Du |[E]bleibst“
  // Markieren bis hinter „bleibst“: der Akkord zählt als ein Schritt, dann sieben Buchstaben.
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Backspace');
  expect(await speichern(page)).toBe(ohne(ERST, ERST + '[E]bleibst'.length));
});

test('Zeilenumbruch bei „Nur Text“: der Akkord bleibt am Wort', async ({ page }) => {
  await nurText(page);
  await cursorInZeile(page, 'bleibst an meiner Seite', 3); // „Du |[E]bleibst“
  await page.keyboard.press('Enter');
  expect(await speichern(page)).toBe(
    DEMO_EDITOR_TEXT.slice(0, ERST) + '\n' + DEMO_EDITOR_TEXT.slice(ERST),
  );
});
