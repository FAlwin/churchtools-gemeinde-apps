import { test, expect, type Page } from '@playwright/test';
import { DEMO_EDITOR_TEXT } from '../client/src/dev/demoEditorText';
import { cursorInZeile } from './werkzeug';

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
  await cursorInZeile(page, 'bleibst an meiner Seite', 3);
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

test('„Vers“ nummeriert sich selbst', async ({ page }) => {
  await oeffnen(page);
  await mittenInDieZeile(page);
  await menue(page).click();
  await expect(page.getByText('Nur für andere Programme')).toBeVisible();
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

test('Eigener Name: „Tag“ wird ein Band unter der Cursor-Zeile (26.10.2026)', async ({ page }) => {
  await oeffnen(page);
  await mittenInDieZeile(page);
  await menue(page).click();
  await page.getByRole('button', { name: /Eigener Name/ }).click();
  await page.getByLabel('Name des Teils').fill('Tag');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.locator('.cm-cp-band')).toHaveText(['Vers', 'Tag', 'Chorus']);
});

test('Kopfangabe ohne Liedinfo kommt wie früher als Angabe in den Text', async ({ page }) => {
  await oeffnen(page);
  await mittenInDieZeile(page);
  await menue(page).click();
  await page.getByRole('button', { name: /Tempo \(BPM\)/ }).click();
  await page.keyboard.type('96');
  await page.getByRole('button', { name: 'Speichern' }).click();
  const pos = DEMO_EDITOR_TEXT.indexOf('[E]bleibst');
  expect(await gespeichert(page)).toBe(
    DEMO_EDITOR_TEXT.slice(0, pos) + '\n{tempo: 96}\n' + DEMO_EDITOR_TEXT.slice(pos),
  );
});

test.describe('mit Liedinfo', () => {
  async function oeffnenMitLiedinfo(page: Page) {
    await page.goto('/?demo=editor&liedinfo');
    await expect(page.locator('.cm-cp-akkord').first()).toBeVisible({ timeout: 30_000 });
  }

  test('Kopfangabe öffnet rechts die Liedinfo, das Feld hat den Fokus', async ({ page }) => {
    await oeffnenMitLiedinfo(page);
    await menue(page).click();
    await page.getByRole('button', { name: /CCLI-Nummer/ }).click();
    const info = page.getByRole('region', { name: 'Liedinfo' });
    await expect(info).toBeVisible();
    await expect(info.getByLabel('CCLI-Nummer')).toBeFocused();
    // Der Umschalter zeigt „Liedinfo“ als gewählt – nicht weiter „Vorschau“.
    await expect(
      page.getByRole('group', { name: 'Rechte Spalte' }).getByRole('button', { name: 'Liedinfo' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cm-content')).not.toContainText('{ccli');
  });

  test.describe('Handy', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('Kopfangabe wechselt zum Reiter „Infos“, das Feld hat den Fokus', async ({ page }) => {
      await oeffnenMitLiedinfo(page);
      await menue(page).click();
      await page.getByRole('button', { name: /Taktart/ }).click();
      const info = page.getByRole('region', { name: 'Liedinfo' });
      await expect(info).toBeVisible();
      await expect(page.getByRole('region', { name: 'Text' })).toBeHidden();
      await expect(info.getByLabel('Takt')).toBeFocused();
    });
  });
});
