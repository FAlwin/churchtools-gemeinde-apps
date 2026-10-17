import { test, expect, type Page } from '@playwright/test';
import { TOUR_CHART } from '../client/src/utils/onboarding';

/**
 * **Scroll-Modus** (#551, Dev-Stammtisch 14.10.2026): Mit „Liedansicht: Scrollen" stehen die Seiten
 * untereinander, jede in voller Breite. Als E2E, weil es um echte Geometrie geht – gerenderte Seiten,
 * CSS, Scrollen – und weil der lokale Browser den Seitenaufbau drosselt, sobald die Vorschau verdeckt ist.
 *
 * Geprüft wird der Weg, den Alwin am Gerät geht: je Lied EINE lange Seite (Rolle, #607), Pedal (↓,
 * Leertaste) scrollt ⅔ Bildschirm, die Kopfzeile folgt dem Lied in der Bildmitte, ein Tipp blendet die
 * Leisten aus, ein Lied-Punkt springt hin. Malen auf der Rolle kommt mit #608 – bis dahin kein „Anmerken".
 */
// Niedriges Fenster: Die Demo-Lieder sind kurz, als Rollen (#607) stünden sie auf einem ganzen iPhone-
// Bildschirm komplett da – und es gäbe nichts zu scrollen.
test.use({ viewport: { width: 390, height: 420 } });

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

test('Scrollen: Rollen untereinander, Pedal, Tipp, Lied-Punkt', async ({ page }) => {
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
    localStorage.setItem('worship:liedansicht', 'scrollen');
  }, TOUR_CHART);
  await page.goto('/?demo=chart');

  // Die Seiten stehen untereinander, jede so breit wie der Bildschirm, ohne Lücke.
  await expect(deck(page)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      () =>
        deck(page).evaluate(
          (el) =>
            el.querySelectorAll('canvas').length === 3 && el.scrollHeight > el.clientHeight * 2,
        ),
      {
        timeout: 30_000,
      },
    )
    .toBe(true);
  const seiten = await deck(page).evaluate((el) =>
    [...el.querySelectorAll('canvas')].map((c) => {
      const box = c.parentElement!;
      return { top: box.offsetTop, h: box.offsetHeight, w: box.offsetWidth };
    }),
  );
  // Je Lied EINE Rolle (#607): drei Demo-Lieder, drei Seiten – und keine davon im A4-Format (die
  // Demo-Lieder sind kurz, ihre Rolle ist deutlich niedriger als ein A4-Blatt).
  expect(seiten.length).toBe(3);
  for (const s of seiten) expect(s.h / s.w).toBeLessThan(1.2);
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

  // Malen auf der Rolle kommt mit #608 – bis dahin bietet das Werkzeug-Menü kein „Anmerken" an.
  await page.getByRole('button', { name: 'Werkzeuge' }).click();
  await expect(page.getByRole('menuitem', { name: 'Tempo' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Anmerken' })).toHaveCount(0);
  await page.locator('[class*="scrim"]').first().click(); // Menü schließen

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

    // Ganz nach unten: Die Kopfzeile zeigt das letzte Lied (die Seite in der Mitte zählt).
    await deck(page).evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(kopfTitel(page)).toContainText('Treu');
    // Malen auf der Rolle kommt mit #608 – bis dahin kein Stift in der Kopfzeile.
    await expect(page.getByRole('button', { name: 'Anmerken', exact: true })).toHaveCount(0);
  });
});

test('Anmerkungen vom Blättern erscheinen auf der Rolle (#614)', async ({ page }) => {
  // Ein Textfeld auf A4-Seite 1 von „Großer Gott" (Demo-Lied 999001), unten im Refrain.
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
    localStorage.setItem('worship:liedansicht', 'scrollen');
    localStorage.setItem(
      'worship_docdraw_song999001_a999001_voriginal_0_text',
      JSON.stringify([
        { id: 1, fx: 0.7, fy: 0.25, text: 'leise!', color: '#d92d20', sizeCqh: 1.5, bold: true },
      ]),
    );
  }, TOUR_CHART);
  await page.goto('/?demo=chart');
  await expect(deck(page)).toBeVisible({ timeout: 30_000 });
  const text = deck(page).getByText('leise!');
  await expect(text).toBeVisible({ timeout: 30_000 });
  // Er steht auf der Rolle von „Großer Gott" (der ersten), nicht auf einer anderen.
  const rolle1 = deck(page).locator('canvas').first();
  const t = await text.boundingBox();
  const r = await rolle1.boundingBox();
  expect(t && r).toBeTruthy();
  expect(t!.y).toBeGreaterThan(r!.y);
  expect(t!.y + t!.height).toBeLessThan(r!.y + r!.height);
  // Gleich groß wie auf A4 (1,5 % von 297 mm), nicht 1,5 % der viel kürzeren Rolle – sonst hätte die
  // Rolle die Anmerkung als eigene Seite behandelt statt umgerechnet.
  const pxProMm = r!.width / 210;
  const schrift = await text.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(schrift).toBeCloseTo(0.015 * 297 * pxProMm, 0);
});
