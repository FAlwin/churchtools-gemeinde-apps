import { test, expect, type Page } from '@playwright/test';
import { DEMO_EDITOR_TEXT } from '../client/src/dev/demoEditorText';

/**
 * **Lied-Editor L5: Akkorde einfügen** (22.10.2026, Entwurf Variante A; Alwin: „Akkorde einfügen ist noch nicht so
 * intuitiv“). Cursor in den Text, Akkord in der Leiste antippen – geprüft am gespeicherten Text. Die Demo steht in E.
 */
const gespeichert = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __gespeichert?: { text: string } }).__gespeichert?.text,
  );

test.use({ viewport: { width: 1180, height: 820 } });

const STELLE = 'Du bist [E]treu Herr   an';
/** Der Demo-Text mit `einfuegen` hinter „Du “ in der ersten Chorus-Zeile. */
const mit = (einfuegen: string) =>
  DEMO_EDITOR_TEXT.replace(STELLE, STELLE.replace('Du ', 'Du ' + einfuegen));

async function cursorVorBist(page: Page) {
  await page.goto('/?demo=editor');
  const zeile = page.locator('.cm-line', { hasText: 'jedem neuen Tag' });
  await expect(zeile).toBeVisible({ timeout: 30_000 });
  // Ganz links in die Zeile klicken – mitten in der Zeile träfe man womöglich ein Kärtchen.
  const h = (await zeile.boundingBox())!.height;
  await zeile.click({ position: { x: 1, y: h / 2 } });
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight'); // „Du “
}
const leiste = (page: Page) => page.getByRole('group', { name: 'Akkorde' });

test('Akkord der Tonart antippen setzt ihn an den Cursor – weitertippen geht direkt dahinter', async ({
  page,
}) => {
  await cursorVorBist(page);
  await expect(leiste(page)).toContainText('Tonart E');
  await leiste(page).getByRole('button', { name: 'C#m', exact: true }).click();
  await page.keyboard.type('X');
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(await gespeichert(page)).toBe(mit('[C#m]X'));
});

test('„Anderer Akkord“: eintippen, Eingabetaste – danach steht er in „Im Lied“', async ({
  page,
}) => {
  await cursorVorBist(page);
  await leiste(page).getByRole('button', { name: 'Anderer Akkord' }).click();
  const feld = page.getByPlaceholder(/Em7/);
  await feld.fill('em7');
  await feld.press('Enter');
  await expect(feld).toBeHidden();
  await expect(leiste(page).getByRole('button', { name: 'Em7', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(await gespeichert(page)).toBe(mit('[Em7]'));
});

test('gedrückt halten zeigt Varianten – Esus4 wird gesetzt, der Akkord E nicht', async ({
  page,
}) => {
  await cursorVorBist(page);
  const e = leiste(page).getByRole('button', { name: 'E', exact: true });
  const b = (await e.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page
    .getByRole('group', { name: 'Varianten von E' })
    .getByRole('button', { name: 'Esus4' })
    .click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  expect(await gespeichert(page)).toBe(mit('[Esus4]'));
});
