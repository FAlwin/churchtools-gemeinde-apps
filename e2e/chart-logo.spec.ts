import { test, expect, type Page } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * **Logo auf dem Liedblatt ein/aus** (Alwin, 19.10.2026: der Admin entscheidet für die Gemeinde). Geprüft
 * am gezeichneten Blatt: Oben rechts stehen die bunten Balken des Logos – der türkise mittlere ist im Lied
 * sonst nirgends. Die Gemeinde-Einstellung wird dem Browser vorgesetzt (`page.route`), statt sie über die
 * Verwaltung zu speichern: Die gespeicherte Einstellung teilen sich alle Tests eines Laufs, und ein
 * gleichzeitiges Speichern in einem anderen Test könnte sie zurückdrehen. Den Schalter selbst prüfen
 * `Settings.test.tsx` und die Speicher-Tests.
 */
const TOUREN = [TOUR_TERMINE, TOUR_CHART, TOUR_SETLIST, TOUR_SETLIST_EDIT];

async function liedOeffnen(page: Page, liedblattLogo: boolean) {
  await page.addInitScript((touren: string[]) => {
    for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
  }, TOUREN);
  await page.route('**/api/site-config', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const antwort = await route.fetch();
    const cfg = (await antwort.json()) as Record<string, unknown>;
    await route.fulfill({ response: antwort, json: { ...cfg, liedblattLogo } });
  });
  await page.goto('/');
  await page.getByLabel(/E-Mail/i).fill('test@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();
  await page.getByText('Gottesdienst (Stub)').click({ timeout: 20_000 });
  await page.getByText('Testlied aus ChurchTools').first().click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
}

/** Wie viele türkise Bildpunkte (Logo-Balken) im oberen rechten Eck der ersten Seite stehen. */
function logoPunkte(page: Page): Promise<number> {
  return page
    .locator('canvas')
    .first()
    .evaluate((c: HTMLCanvasElement) => {
      const ctx = c.getContext('2d');
      if (!ctx || !c.width) return -1;
      const w = Math.round(c.width * 0.15);
      const h = Math.round(c.height * 0.1);
      const d = ctx.getImageData(c.width - w, 0, w, h).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (
          Math.abs(d[i] - 18) < 40 &&
          Math.abs(d[i + 1] - 178) < 40 &&
          Math.abs(d[i + 2] - 162) < 40
        )
          n++;
      }
      return n;
    });
}

test('Logo an (Vorgabe): oben rechts auf dem Liedblatt', async ({ page }) => {
  await liedOeffnen(page, true);
  await expect.poll(() => logoPunkte(page), { timeout: 10_000 }).toBeGreaterThan(50);
});

test('Logo von der Gemeinde ausgeblendet: das Liedblatt hat keins', async ({ page }) => {
  await liedOeffnen(page, false);
  // Auf den ENDZUSTAND warten, nicht eine feste Zeit: Ohne gemerkte Einstellung (frische Anmeldung) zeichnet
  // die App erst mit der Vorgabe (Logo an) und nach dem Laden der Einstellung neu. Unter Last dauerte das
  // länger als die zuerst gewählte eine Sekunde (19.10.2026). -1 = Seite noch nicht gezeichnet.
  await expect.poll(() => logoPunkte(page), { timeout: 15_000 }).toBe(0);
});
