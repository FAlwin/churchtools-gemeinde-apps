import { test, expect, type Page } from '@playwright/test';
import { TOUR_CHART } from '../client/src/utils/onboarding';

/**
 * **Scroll-Modus** (#551, Dev-Stammtisch 14.10.2026): Mit „Liedansicht: Scrollen" stehen die Seiten
 * untereinander, jede in voller Breite. Als E2E, weil es um echte Geometrie geht – gerenderte Seiten,
 * CSS, Scrollen – und weil der lokale Browser den Seitenaufbau drosselt, sobald die Vorschau verdeckt ist.
 *
 * Geprüft wird der Weg, den Alwin am Gerät geht: Pedal (↓, Leertaste) scrollt ⅔ Bildschirm, die
 * Kopfzeile folgt dem Lied in der Bildmitte, ein Tipp blendet die Leisten aus, ein Lied-Punkt springt
 * hin, und Anmerken öffnet die sichtbare Seite einzeln – danach steht man wieder an derselben Stelle.
 */
test.use({ viewport: { width: 390, height: 844 } });

const deck = (page: Page) => page.getByTestId('scroll-deck');

async function scrollTop(page: Page): Promise<number> {
  return deck(page).evaluate((el) => Math.round(el.scrollTop));
}

/** Warten, bis eine (weiche) Scroll-Bewegung zur Ruhe gekommen ist. */
async function ruhig(page: Page): Promise<number> {
  let vorher = -1;
  for (let i = 0; i < 40; i++) {
    const jetzt = await scrollTop(page);
    if (jetzt === vorher) return jetzt;
    vorher = jetzt;
    await page.waitForTimeout(100);
  }
  return vorher;
}

const kopfTitel = (page: Page) => page.locator('[class*="hdr"]').first();

test('Scrollen: Seiten untereinander, Pedal, Tipp, Lied-Punkt und Malen', async ({ page }) => {
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
    localStorage.setItem('worship:liedansicht', 'scrollen');
  }, TOUR_CHART);
  await page.goto('/?demo=chart');

  // Die Seiten stehen untereinander, jede so breit wie der Bildschirm, ohne Lücke.
  await expect(deck(page)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => deck(page).evaluate((el) => el.scrollHeight > el.clientHeight * 1.5), {
      timeout: 30_000,
    })
    .toBe(true);
  const seiten = await deck(page).evaluate((el) =>
    [...el.querySelectorAll('canvas')].map((c) => {
      const box = c.parentElement!;
      return { top: box.offsetTop, h: box.offsetHeight, w: box.offsetWidth };
    }),
  );
  expect(seiten.length).toBeGreaterThanOrEqual(3);
  for (let i = 1; i < seiten.length; i++) {
    // nahtlos (±1 px: offsetTop/offsetHeight runden je für sich)
    expect(Math.abs(seiten[i].top - (seiten[i - 1].top + seiten[i - 1].h))).toBeLessThanOrEqual(1);
    expect(seiten[i].w).toBe(390);
  }
  await expect(kopfTitel(page)).toContainText('Großer Gott');

  // Pedal: ↓ und Leertaste scrollen je ⅔ der Höhe.
  const hoehe = await deck(page).evaluate((el) => el.clientHeight);
  const schritt = Math.round((hoehe * 2) / 3);
  // Die Kopfzeile folgt dem Lied in der Bildmitte (Demo: drei Lieder, je eine Seite).
  await page.keyboard.press('ArrowDown');
  expect(await ruhig(page)).toBe(schritt);
  await expect(kopfTitel(page)).toContainText('Welch ein Freund');
  await page.keyboard.press('Space');
  expect(await ruhig(page)).toBe(2 * schritt);
  await expect(kopfTitel(page)).toContainText('Treu');
  await page.keyboard.press('ArrowUp');
  expect(await ruhig(page)).toBe(schritt);
  await expect(kopfTitel(page)).toContainText('Welch ein Freund');

  // Ein Tipp aufs Blatt blendet die Leisten aus – und wieder ein.
  await deck(page).click({ position: { x: 195, y: 200 } });
  await expect(page.locator('[class*="hdr"]')).toHaveCount(0);
  await deck(page).click({ position: { x: 195, y: 200 } });
  await expect(kopfTitel(page)).toBeVisible();

  // Anmerken öffnet die sichtbare Seite einzeln; „Anmerken beenden" bringt an dieselbe Stelle zurück.
  const vorDemMalen = await ruhig(page);
  await page.getByRole('button', { name: 'Werkzeuge' }).click();
  await page.getByRole('menuitem', { name: 'Anmerken' }).click();
  await expect(deck(page)).toHaveCount(0);
  await expect(kopfTitel(page)).toContainText('Welch ein Freund');
  await page.getByRole('button', { name: 'Anmerken beenden' }).click();
  await expect(deck(page)).toBeVisible();
  expect(await ruhig(page)).toBe(vorDemMalen);

  // Ein Lied-Punkt unten holt das Lied an den Anfang des Bildschirms; der Pfeil unten scrollt wie das Pedal.
  const punkte = page.locator('[class*="dots"] > div');
  await punkte.nth(0).click();
  expect(await ruhig(page)).toBe(0);
  await expect(kopfTitel(page)).toContainText('Großer Gott');
  await page.getByRole('button', { name: 'Weiter / nächste Seite' }).click();
  expect(await ruhig(page)).toBe(schritt);
});

test.describe('iPad quer', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('eine Seite in voller Breite statt zwei nebeneinander – und nur eine Titel-Kapsel', async ({
    page,
  }) => {
    await page.addInitScript((tour: string) => {
      localStorage.setItem(`worship:onboard-${tour}`, '1');
      localStorage.setItem('worship:liedansicht', 'scrollen');
    }, TOUR_CHART);
    await page.goto('/?demo=chart');
    await expect
      .poll(() => deck(page).evaluate((el) => el.querySelectorAll('canvas').length), {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(3);
    const breiten = await deck(page).evaluate((el) =>
      [...el.querySelectorAll('canvas')].map((c) => c.parentElement!.offsetWidth),
    );
    expect(new Set(breiten)).toEqual(new Set([1180]));
    // Beim Blättern stünden hier zwei Lieder mit je eigener Kapsel (#421) – im Scroll-Modus nicht.
    await expect(page.locator('[class*="kapselPaar"]')).toHaveCount(0);

    // Anmerken oben im Ablauf: eine Seite, nicht das 2-up (dort stünde das nächste Lied daneben).
    const anmerken = page.getByRole('button', { name: 'Anmerken', exact: true });
    await anmerken.click();
    await expect(deck(page)).toHaveCount(0);
    await expect(page.locator('[class*="_slot_"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Anmerken beenden' }).click();
    await expect(deck(page)).toBeVisible();

    // Ganz nach unten: Das letzte Lied steht in der Mitte. Anmerken öffnet GENAU diese Seite einzeln –
    // nicht das 2-up mit der Vorseite (beim Blättern ist die linke Seite quer auf die vorletzte begrenzt).
    await deck(page).evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(kopfTitel(page)).toContainText('Treu');
    await anmerken.click();
    await expect(deck(page)).toHaveCount(0);
    await expect(page.locator('[class*="_slot_"]')).toHaveCount(1);
    await expect(kopfTitel(page)).toContainText('Treu');
  });
});
