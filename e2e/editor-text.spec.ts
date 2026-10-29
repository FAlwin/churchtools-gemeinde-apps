import { test, expect, type Page } from '@playwright/test';
import { DEMO_EDITOR_TEXT } from '../client/src/dev/demoEditorText';
import { cursorInZeile } from './werkzeug';

/**
 * **Lied-Editor L3: Text freundlicher** (22.10.2026, Entwurf B/C): Akkorde als Kärtchen, Teile als Band,
 * `----` als Linie – der Text bleibt ChordPro Zeichen für Zeichen. Geprüft am gespeicherten Text.
 * In der CI läuft Chromium; Mac-Safari (WebKit) einmal von Hand mit `--browser=webkit`-Projekt geprüft, das
 * echte iPad prüft Alwin vor dem Merge (L0: die iPad-Tastatur lässt sich nicht nachbilden).
 */
const gespeichert = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __gespeichert?: { text: string } }).__gespeichert?.text,
  );

test.use({ viewport: { width: 1180, height: 820 } });

async function oeffnen(page: Page) {
  await page.goto('/?demo=editor');
  await expect(page.locator('.cm-cp-akkord').first()).toBeVisible({ timeout: 30_000 });
}

/** Cursor direkt vor das erste Akkord-Kärtchen der Zeile „Du [E]bleibst …“ setzen. */
async function vorDasKaertchen(page: Page) {
  await cursorInZeile(page, 'bleibst an meiner Seite', 3); // „Du “
}

const ERST = DEMO_EDITOR_TEXT.indexOf('[E]bleibst');

test('Kärtchen und Bänder statt Klammern; ohne Änderung wird Zeichen für Zeichen gespeichert', async ({
  page,
}) => {
  await oeffnen(page);
  const text = page.locator('.cm-content');
  await expect(text).not.toContainText('[E]');
  await expect(text).not.toContainText('{comment');
  await expect(page.locator('.cm-cp-band')).toHaveText(['Vers', 'Chorus']);
  await expect(page.locator('.cm-cp-akkord').first()).toHaveText('E');
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(await gespeichert(page)).toBe(DEMO_EDITOR_TEXT);
});

test('Rücktaste hinter einem Kärtchen löscht den ganzen Akkord – Rückgängig holt ihn zurück', async ({
  page,
}) => {
  await oeffnen(page);
  await vorDasKaertchen(page);
  await page.keyboard.press('ArrowRight'); // springt über das Kärtchen
  await page.keyboard.press('Backspace');
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(await gespeichert(page)).toBe(
    DEMO_EDITOR_TEXT.slice(0, ERST) + DEMO_EDITOR_TEXT.slice(ERST + 3),
  );
  await page
    .getByRole('region', { name: 'Text' })
    .getByRole('button', { name: 'Rückgängig' })
    .click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(await gespeichert(page)).toBe(DEMO_EDITOR_TEXT);
});

test('Tippen vor einem Kärtchen landet vor der Klammer', async ({ page }) => {
  await oeffnen(page);
  await vorDasKaertchen(page);
  await page.keyboard.type('X');
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(await gespeichert(page)).toBe(
    DEMO_EDITOR_TEXT.slice(0, ERST) + 'X' + DEMO_EDITOR_TEXT.slice(ERST),
  );
});

test('mit Ablauf zeigt jedes Band, wie oft der Teil gesungen wird', async ({ page }) => {
  await oeffnen(page);
  const zusatz = page.locator('.cm-cp-band-zusatz');
  await expect(zusatz).toHaveCount(0); // ohne Ablauf: nichts
  const ablauf = page.getByRole('region', { name: 'Ablauf' });
  await ablauf.getByRole('button', { name: 'Bearbeiten' }).click();
  await ablauf.getByRole('button', { name: 'Chorus', exact: true }).click();
  await expect(zusatz).toHaveText(['1× im Ablauf', '2× im Ablauf']);
});

test('„ChordPro-Text“ zeigt den rohen Text – und zurück', async ({ page }) => {
  await oeffnen(page);
  const schalter = page.getByRole('button', { name: 'ChordPro-Text' });
  await schalter.click();
  await expect(schalter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cm-content')).toContainText('{comment: Vers}');
  await expect(page.locator('.cm-content')).toContainText('[E]');
  await expect(page.locator('.cm-cp-akkord')).toHaveCount(0);
  await schalter.click();
  await expect(page.locator('.cm-cp-akkord').first()).toBeVisible();
});
