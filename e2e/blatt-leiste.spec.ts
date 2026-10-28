import { test, expect, type Page } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * **Die Ablauf-Leiste der Kopfkarte** (Scheibe B2, Prototyp mit Alwin 28.10.2026) mit VIELEN Liedern: Sie passt nicht
 * mehr in die Breite und scrollt. Als E2E, weil es um echte Geometrie geht – was in der Leiste zu sehen ist, wohin
 * sie beim Blättern mitscrollt.
 *
 * Der Stub kennt nur ein Lied – der Test vervielfacht den Lied-Punkt in der Ablauf-Antwort.
 */
const ANZAHL = 10;

async function oeffneLiedblatt(page: Page) {
  await page.addInitScript(
    (touren: string[]) => {
      for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
      localStorage.setItem('worship:onboard-hint-vollbild', '1');
    },
    [TOUR_TERMINE, TOUR_CHART, TOUR_SETLIST, TOUR_SETLIST_EDIT],
  );
  await page.route('**/api/services/*/setlist', async (route) => {
    const res = await route.fetch();
    const punkte = (await res.json()) as Array<{
      id: number;
      song?: { id: number; title: string };
    }>;
    const lied = punkte.find((p) => p.song)!;
    for (let k = 1; k < ANZAHL; k++) {
      const kopie = structuredClone(lied);
      kopie.id += 1000 * k;
      kopie.song!.id += 1000 * k;
      kopie.song!.title = `Lied ${k + 1}`;
      punkte.push(kopie);
    }
    await route.fulfill({ response: res, json: punkte });
  });
  await page.goto('/');
  await page.getByLabel(/E-Mail/i).fill('test@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
  await page.getByText('Gottesdienst (Stub)').click();
  await page.getByText('Testlied aus ChurchTools').first().click();
  const leiste = page.getByRole('navigation', { name: 'Lieder im Ablauf' });
  await expect(leiste).toBeVisible({ timeout: 20_000 });
  return leiste;
}

/** Steht das Element (fast) ganz innerhalb des sichtbaren Teils der Leiste? */
async function inDerLeiste(page: Page, i: number): Promise<boolean> {
  return page.evaluate((idx) => {
    const leiste = document.querySelector('nav[aria-label="Lieder im Ablauf"]')!;
    const lied = leiste.querySelector(`[data-lied="${idx}"]`)!;
    const l = leiste.getBoundingClientRect();
    const e = lied.getBoundingClientRect();
    return e.left >= l.left - 1 && e.right <= l.right + 1;
  }, i);
}

/**
 * Auf ein Lied springen. Das geht erst, wenn es im Seitenstrom steht (`goToSong` kennt sonst seine Seite nicht) – unter
 * Last dauert das Laden; so verhielten sich schon die Punkte unten. Erneut getippt wird nur, solange es nicht gewählt
 * ist, sonst öffnete der zweite Tipp sein Lied-Menü.
 */
async function springeZu(page: Page, i: number) {
  const lied = page
    .getByRole('navigation', { name: 'Lieder im Ablauf' })
    .locator(`[data-lied="${i}"]`);
  await expect(async () => {
    if ((await lied.getAttribute('aria-current')) !== 'true') await lied.click();
    await expect(lied).toHaveAttribute('aria-current', 'true', { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
}

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('kompakt: ohne Titelzeile, alle Lieder nummeriert, Tipp springt, die Leiste scrollt mit', async ({
    page,
  }) => {
    const leiste = await oeffneLiedblatt(page);
    const lied = (i: number) => leiste.locator(`[data-lied="${i}"]`);
    await expect(leiste.locator('[data-lied]')).toHaveCount(ANZAHL);
    await expect(lied(9)).toContainText('10');
    // Kompakt: Zurück nur als Symbol, kein Termin-Titel.
    await expect(page.getByRole('button', { name: 'Zurück zu Ablauf' })).toHaveText('');
    // Die Knöpfe im Raster mit Kurzwort.
    await expect(page.getByRole('button', { name: 'Aussehen', exact: true })).toContainText(
      'Aussehen',
    );

    // Das letzte Lied steht anfangs nicht in der Leiste – ein Tipp darauf springt hin.
    expect(await inDerLeiste(page, 9)).toBe(false);
    await springeZu(page, 9);
    await expect(lied(9)).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => inDerLeiste(page, 9)).toBe(true);

    // Zurück blättern: Die Leiste scrollt mit, das gewählte Lied bleibt zu sehen.
    for (let i = 8; i >= 5; i--) {
      await page.getByRole('button', { name: 'Zurück / vorige Seite' }).click();
      await expect(lied(i)).toHaveAttribute('aria-current', 'true');
      await expect.poll(() => inDerLeiste(page, i)).toBe(true);
    }
  });

  test('Wischen in der Leiste blättert NICHT um', async ({ page }) => {
    const leiste = await oeffneLiedblatt(page);
    await leiste.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect.poll(() => inDerLeiste(page, 9)).toBe(true);
    await expect(leiste.locator('[data-lied="0"]')).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('iPad quer', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('das zweite sichtbare Lied wählen lässt das Blatt stehen – ein anderes springt', async ({
    page,
  }) => {
    const leiste = await oeffneLiedblatt(page);
    const lied = (i: number) => leiste.locator(`[data-lied="${i}"]`);
    await expect(leiste.locator('[class*="liedSichtbar"]')).toHaveCount(2);
    // Wählen: Lied 2 gewählt, Lied 1 bleibt links sichtbar (das Blatt springt nicht).
    await lied(1).click();
    await expect(lied(1)).toHaveAttribute('aria-current', 'true');
    await expect(lied(0)).toHaveClass(/liedSichtbar/);
    // Springen: Lied 6 ist danach sichtbar und gewählt, Lied 1 nicht mehr zu sehen.
    await springeZu(page, 5);
    await expect(lied(5)).toHaveClass(/liedSichtbar/);
    await expect(lied(0)).not.toHaveClass(/liedSichtbar/);
  });
});

test.describe('iPad hochkant', () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test('breit: Titelzeile mit „← Ablauf“ und Termin, Leiste und Knöpfe in EINER Zeile', async ({
    page,
  }) => {
    const leiste = await oeffneLiedblatt(page);
    await expect(page.getByRole('button', { name: 'Zurück zu Ablauf' })).toHaveText('Ablauf');
    await expect(page.getByText(/Gottesdienst \(Stub\) – /)).toBeVisible();
    const l = (await leiste.boundingBox())!;
    const k = (await page.getByRole('button', { name: 'Aussehen', exact: true }).boundingBox())!;
    // Gleiche Zeile: die Knöpfe stehen rechts neben der Leiste, nicht darunter.
    expect(Math.abs(k.y + k.height / 2 - (l.y + l.height / 2))).toBeLessThan(6);
    expect(k.x).toBeGreaterThan(l.x + l.width - 1);

    // Fenster gehen UNTER der Kopfkarte auf – ihre Unterkante wird gemessen (vorher feste Höhe der Kapselzeile).
    const karte = (await leiste.locator('xpath=ancestor::div[2]').boundingBox())!;
    await page.getByRole('button', { name: 'Tempo', exact: true }).click();
    const fenster = (await page.locator('[class*="tempoMenu"]').boundingBox())!;
    expect(fenster.y).toBeGreaterThanOrEqual(karte.y + karte.height);
  });
});

test('ein Lied aus der Liederliste: der Liedname als Titel, „← Lieder“, in der Leiste ohne Nummer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.addInitScript(
    (touren: string[]) => {
      for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
    },
    [TOUR_TERMINE, TOUR_CHART, TOUR_SETLIST, TOUR_SETLIST_EDIT],
  );
  await page.goto('/');
  await page.getByLabel(/E-Mail/i).fill('test@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
  await page.getByRole('button', { name: 'Lieder', exact: true }).click();
  await page.getByText('Testlied aus ChurchTools').first().click();
  const leiste = page.getByRole('navigation', { name: 'Lieder im Ablauf' });
  await expect(leiste).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Zurück zu Lieder' })).toHaveText('Lieder');
  await expect(leiste.locator('[data-lied]')).toHaveCount(1);
  await expect(leiste.locator('[class*="nummer"]')).toHaveCount(0);
});
