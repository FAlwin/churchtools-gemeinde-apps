import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Querformat mit zwei Liedern nebeneinander (#421, Alwin am iPad, 03.10.2026; seit Scheibe B1+B2 über die
 * Ablauf-Leiste der Kopfkarte, 28.10.2026).
 *
 * Beide sichtbaren Lieder sind in der Leiste hinterlegt, eines ist gewählt (unterstrichen). Ein Tipp auf das andere
 * wählt es – ohne Vollbild; ein Tipp auf das gewählte öffnet sein Lied-Menü. Die Knöpfe wirken auf das gewählte. Ein
 * Tipp aufs Blatt schaltet nur das Vollbild.
 *
 * Der Stub kennt nur ein Lied – der Test verdoppelt den Lied-Punkt in der Ablauf-Antwort, damit zwei
 * verschiedene Lieder nebeneinander stehen. Als E2E, weil es um echte Geometrie (zwei Hälften) und
 * das Zusammenspiel von Kopf, Liedwechsel und Fenstern geht.
 */
test.use({ viewport: { width: 1180, height: 820 } });

test('Querformat: zweites sichtbares Lied in der Leiste wählen, Lied-Menü am gewählten, Blatt = nur Vollbild', async ({
  page,
}) => {
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
    const zweites = structuredClone(lied);
    zweites.id += 1000;
    zweites.song!.id += 1000;
    zweites.song!.title = 'Staunen';
    punkte.push(zweites);
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
  const lied = (i: number) => leiste.locator(`[data-lied="${i}"]`);
  // Beide sichtbar (hinterlegt), das linke gewählt.
  await expect(leiste.locator('[class*="liedSichtbar"]')).toHaveCount(2);
  await expect(lied(0)).toHaveAttribute('aria-current', 'true');

  // Tipp auf das andere sichtbare → gewählt, KEIN Vollbild, kein Menü.
  await lied(1).click();
  await expect(lied(1)).toHaveAttribute('aria-current', 'true');
  await expect(lied(0)).not.toHaveAttribute('aria-current', 'true');
  await expect(leiste).toBeVisible();
  await expect(lied(1)).toHaveAttribute('aria-expanded', 'false');

  // Tipp auf das gewählte → sein Lied-Menü, unter ihm.
  await lied(1).click();
  await expect(lied(1)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await page.mouse.click(1100, 780); // Menü schließen (Tipp daneben)

  // Aussehen wirkt auf das gewählte Lied und öffnet unter seinem Knopf.
  await page.getByRole('button', { name: 'Aussehen', exact: true }).click();
  await expect(page.getByText('Schriftgröße')).toBeVisible();
  await page.mouse.click(1100, 780); // Fenster schließen (Tipp daneben)

  // Tipp aufs Blatt → nur Vollbild; das gewählte Lied bleibt.
  const flaeche = (await page.locator('[class*="chartArea"]').boundingBox())!;
  await page.mouse.click(flaeche.x + flaeche.width * 0.7, flaeche.y + flaeche.height / 2);
  await expect(leiste).toHaveCount(0);
  await page.mouse.click(flaeche.x + flaeche.width * 0.7, flaeche.y + flaeche.height / 2);
  await expect(leiste).toBeVisible();
  await expect(lied(1)).toHaveAttribute('aria-current', 'true');
});
