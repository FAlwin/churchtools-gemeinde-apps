import { test, expect, type Page } from '@playwright/test';
import { DEMO_EDITOR_TEXT } from '../client/src/dev/demoEditorText';
import { anDenZeilenanfang } from './werkzeug';

/**
 * **Schreibansicht bei offener Tastatur** (23.10.2026, Alwin am iPad: „das Bearbeitungsfenster ist bei aufgeklappter
 * Tastatur deutlich zu klein“, Entwurf A). Die Tastatur wird nachgestellt: `visualViewport` schrumpft (wie unter
 * iOS), `innerHeight` bleibt.
 */
const HOEHE = 820;
const TASTATUR = 400;
test.use({ viewport: { width: 1180, height: HOEHE } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class Ansicht extends EventTarget {
      height = window.innerHeight;
      width = window.innerWidth;
      offsetTop = 0;
      offsetLeft = 0;
      pageTop = 0;
      pageLeft = 0;
      scale = 1;
    }
    const vv = new Ansicht();
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    (window as unknown as { tastatur: (px: number) => void }).tastatur = (px) => {
      vv.height = window.innerHeight - px;
      vv.dispatchEvent(new Event('resize'));
    };
    // iOS verkleinert manchmal das ganze Fenster: dann ist der sichtbare Bereich so hoch wie `innerHeight`.
    (window as unknown as { sichtbar: () => void }).sichtbar = () => {
      vv.height = window.innerHeight;
      vv.dispatchEvent(new Event('resize'));
    };
  });
});
const tastatur = (page: Page, px: number) =>
  page.evaluate((h) => (window as unknown as { tastatur: (px: number) => void }).tastatur(h), px);
const gespeichert = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __gespeichert?: { text: string } }).__gespeichert?.text,
  );

async function inDenText(page: Page) {
  await page.goto('/?demo=editor');
  const zeile = page.locator('.cm-line', { hasText: 'jedem neuen Tag' });
  await expect(zeile).toBeVisible({ timeout: 30_000 });
  await anDenZeilenanfang(page, 'jedem neuen Tag');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight'); // „Du “
}

test('Tastatur offen + Cursor im Text: Ablauf und Fassung weg, eine Zeile, der Text bekommt den Platz', async ({
  page,
}) => {
  await inDenText(page);
  await tastatur(page, TASTATUR);
  await expect(page.getByRole('region', { name: 'Ablauf' })).toBeHidden();
  await expect(page.getByLabel('Versionsname')).toBeHidden();
  await expect(page.getByRole('button', { name: 'ChordPro-Text' })).toBeHidden();
  // Einfügen, Akkorde und Rückgängig stehen in EINER Zeile.
  const format = (await page.getByRole('button', { name: 'Einfügen', exact: true }).boundingBox())!;
  const tonart = (await page
    .getByRole('group', { name: 'Akkorde' })
    .getByRole('button', { name: 'E', exact: true })
    .boundingBox())!;
  expect(Math.abs(format.y + format.height / 2 - (tonart.y + tonart.height / 2))).toBeLessThan(4);
  // Über der Tastatur bleiben gut 250 px für den Text (vorher: kaum zwei Zeilen).
  const text = (await page.locator('.cm-editor').boundingBox())!;
  expect(Math.min(text.y + text.height, HOEHE - TASTATUR) - text.y).toBeGreaterThan(250);

  await tastatur(page, 0);
  await expect(page.getByRole('region', { name: 'Ablauf' })).toBeVisible();
  await expect(page.getByLabel('Versionsname')).toBeVisible();
});

test('„Im Lied“ als Ausklappmenü – Antippen setzt den Akkord, man schreibt weiter', async ({
  page,
}) => {
  await inDenText(page);
  await tastatur(page, TASTATUR);
  const imLied = page.getByRole('button', { name: 'Im Lied' });
  await imLied.click();
  await expect(imLied).toHaveAttribute('aria-expanded', 'true');
  await imLied.click(); // zweiter Tipp schließt
  await expect(page.getByRole('group', { name: 'Im Lied' })).toBeHidden();
  await imLied.click();
  await page.getByRole('group', { name: 'Im Lied' }).getByRole('button', { name: 'F#m7' }).click();
  await expect(page.getByRole('group', { name: 'Im Lied' })).toBeHidden();
  await page.keyboard.type('X');
  // Noch immer in der Schreibansicht: der Text hat den Fokus behalten.
  await expect(page.getByRole('region', { name: 'Ablauf' })).toBeHidden();
  await page.getByRole('button', { name: 'Speichern' }).click();
  const stelle = 'Du bist [E]treu Herr   an';
  expect(await gespeichert(page)).toBe(
    DEMO_EDITOR_TEXT.replace(stelle, stelle.replace('Du ', 'Du [F#m7]X')),
  );
});

test('Kärtchen am unteren Rand: das Menü klappt nach oben, nicht unter die Tastatur', async ({
  page,
}) => {
  await inDenText(page);
  await tastatur(page, TASTATUR);
  const sichtbarBis = HOEHE - TASTATUR;
  // Das unterste Kärtchen, das noch über der Tastatur steht.
  const kaertchen = page.locator('.cm-cp-akkord');
  let unten = -1;
  let ziel = 0;
  for (let i = 0; i < (await kaertchen.count()); i++) {
    const b = await kaertchen.nth(i).boundingBox();
    if (b && b.y + b.height < sichtbarBis && b.y > unten) {
      unten = b.y;
      ziel = i;
    }
  }
  expect(sichtbarBis - unten).toBeLessThan(80); // es steht wirklich unten
  await kaertchen.nth(ziel).click();
  const m = (await page.getByRole('group', { name: /^Akkord / }).boundingBox())!;
  expect(m.y + m.height).toBeLessThanOrEqual(sichtbarBis);
  expect(m.y + m.height).toBeLessThanOrEqual(unten + 2); // über dem Kärtchen
});

test('auch wenn iOS das Fenster mit der Tastatur verkleinert (statt sie darüberzulegen)', async ({
  page,
}) => {
  await inDenText(page);
  // Fenster schrumpft mit, `innerHeight` = sichtbarer Bereich – nur die beim Tippen eingefrorene App-Höhe weiß
  // noch, wie groß es vorher war.
  await page.setViewportSize({ width: 1180, height: HOEHE - TASTATUR });
  await page.evaluate(() => (window as unknown as { sichtbar: () => void }).sichtbar());
  await expect(page.getByRole('region', { name: 'Ablauf' })).toBeHidden();
  await expect(page.getByLabel('Versionsname')).toBeHidden();
});

test('kurz ohne Fokus, Tastatur bleibt offen: die Schreibansicht bleibt – erst Tastatur zu beendet sie', async ({
  page,
}) => {
  await inDenText(page);
  await tastatur(page, TASTATUR);
  await expect(page.getByRole('region', { name: 'Ablauf' })).toBeHidden();
  await page.locator('.cm-content').evaluate((el) => el.blur());
  await page.waitForTimeout(200);
  await expect(page.getByRole('region', { name: 'Ablauf' })).toBeHidden();
  await tastatur(page, 0);
  await expect(page.getByRole('region', { name: 'Ablauf' })).toBeVisible();
});

test('Tastatur für ein anderes Feld (Fassung): keine Schreibansicht', async ({ page }) => {
  await page.goto('/?demo=editor');
  await page.getByLabel('Versionsname').click();
  await tastatur(page, TASTATUR);
  await page.waitForTimeout(200);
  await expect(page.getByLabel('Versionsname')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ablauf' })).toBeVisible();
});

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Schreibansicht am Handy: eine Zeile, die Akkorde werden gewischt statt umzubrechen', async ({
    page,
  }) => {
    await inDenText(page);
    await page.evaluate(() =>
      (window as unknown as { tastatur: (px: number) => void }).tastatur(340),
    );
    await expect(page.getByLabel('Versionsname')).toBeHidden();
    const format = (await page
      .getByRole('button', { name: 'Einfügen', exact: true })
      .boundingBox())!;
    const zurueck = (await page.getByRole('button', { name: 'Rückgängig' }).first().boundingBox())!;
    expect(Math.abs(format.y - zurueck.y)).toBeLessThan(4);
    const leiste = page.getByRole('group', { name: 'Akkorde' });
    expect(await leiste.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  });
});
