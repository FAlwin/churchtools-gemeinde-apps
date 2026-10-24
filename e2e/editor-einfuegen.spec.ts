import { test, expect, type Page } from '@playwright/test';
import { DEMO_EDITOR_TEXT } from '../client/src/dev/demoEditorText';

/**
 * **Lied-Editor L6: Menü „Einfügen“** (24.10.2026, Variante B) statt des Format-Menüs – und die Ende-Marken
 * `{end_of_…}` im Text ausgeblendet. Geprüft am gespeicherten Text.
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

/** Cursor mitten in die Zeile „Du [E]bleibst …“ (hinter „Du “). */
async function mittenInDieZeile(page: Page) {
  const zeile = page.locator('.cm-line', { hasText: 'bleibst an meiner Seite' });
  const h = (await zeile.boundingBox())!.height;
  await zeile.click({ position: { x: 1, y: h / 2 } });
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
}

const menue = (page: Page) =>
  page.getByRole('region', { name: 'Text' }).getByRole('button', { name: 'Einfügen' });

const ERSTE_ZEILE_ENDE = DEMO_EDITOR_TEXT.indexOf('\n', DEMO_EDITOR_TEXT.indexOf('[E]bleibst'));

test('neuer Teil kommt HINTER die Zeile des Cursors, der Cursor in die leere Zeile darunter', async ({
  page,
}) => {
  await oeffnen(page);
  await mittenInDieZeile(page);
  await menue(page).click();
  await page.getByRole('button', { name: 'Refrain', exact: true }).click();
  await page.keyboard.type('Neu');
  await expect(page.locator('.cm-cp-band')).toHaveText(['Vers', 'Refrain', 'Chorus']);
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(await gespeichert(page)).toBe(
    DEMO_EDITOR_TEXT.slice(0, ERSTE_ZEILE_ENDE) +
      '\n{comment: Refrain}\nNeu' +
      DEMO_EDITOR_TEXT.slice(ERSTE_ZEILE_ENDE),
  );
});

test('„Vers“ nummeriert sich selbst; das Menü bietet keine Kopfangaben mehr an', async ({
  page,
}) => {
  await oeffnen(page);
  await mittenInDieZeile(page);
  await menue(page).click();
  await expect(page.getByText('Nur für andere Programme')).toBeVisible();
  await expect(page.getByRole('button', { name: /Titel|Tempo|Tonart|CCLI/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Vers', exact: true }).click();
  await expect(page.locator('.cm-cp-band')).toHaveText(['Vers', 'Vers 2', 'Chorus']);
});

test('Pedal-Halt wie bisher an den Cursor', async ({ page }) => {
  await oeffnen(page);
  await mittenInDieZeile(page);
  await menue(page).click();
  await page.getByRole('button', { name: /Pedal-Halt/ }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  const pos = DEMO_EDITOR_TEXT.indexOf('[E]bleibst');
  expect(await gespeichert(page)).toBe(
    DEMO_EDITOR_TEXT.slice(0, pos) + '\n----\n' + DEMO_EDITOR_TEXT.slice(pos),
  );
});

test('Kapo: der Cursor steht VOR der Klammer – eingetippt wird {capo: 2} (Test-Instanz 24.10.2026)', async ({
  page,
}) => {
  await oeffnen(page);
  await mittenInDieZeile(page);
  await menue(page).click();
  await page.getByRole('button', { name: /Kapo/ }).click();
  await page.keyboard.type('2');
  await page.getByRole('button', { name: 'Speichern' }).click();
  const pos = DEMO_EDITOR_TEXT.indexOf('[E]bleibst');
  expect(await gespeichert(page)).toBe(
    DEMO_EDITOR_TEXT.slice(0, pos) + '\n{capo: 2}\n' + DEMO_EDITOR_TEXT.slice(pos),
  );
});

test('Ende-Marken sind im Text unsichtbar, im ChordPro-Text sichtbar – gespeichert bleiben sie', async ({
  page,
}) => {
  await oeffnen(page);
  const text = page.locator('.cm-content');
  const roh = page.getByRole('button', { name: 'ChordPro-Text' });
  await roh.click();
  await page.locator('.cm-line', { hasText: 'nicht für mich' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type('\n{end_of_verse}');
  await expect(text).toContainText('{end_of_verse}');
  await roh.click();
  await expect(text).not.toContainText('{end_of_verse}');
  await expect(text).toContainText('nicht für mich');
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(await gespeichert(page)).toBe(
    DEMO_EDITOR_TEXT.slice(0, ERSTE_ZEILE_ENDE) +
      '\n{end_of_verse}' +
      DEMO_EDITOR_TEXT.slice(ERSTE_ZEILE_ENDE),
  );
});
