import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Querformat mit zwei Liedern nebeneinander (#421, Alwin am iPad, 03.10.2026).
 *
 * Vorher wählte ein Tipp aufs Blatt das andere Lied UND schaltete ins Vollbild – die Auswahl sah man
 * erst nach dem Zurückschalten. Jetzt hat jedes Lied seinen Titel und seine Werkzeuge über seiner
 * Hälfte; ein Tipp aufs Blatt schaltet nur noch das Vollbild.
 *
 * Der Stub kennt nur ein Lied – der Test verdoppelt den Lied-Punkt in der Ablauf-Antwort, damit zwei
 * verschiedene Lieder nebeneinander stehen. Als E2E, weil es um echte Geometrie (zwei Hälften) und
 * das Zusammenspiel von Kopf, Liedwechsel und Fenstern geht.
 */
test.use({ viewport: { width: 1180, height: 820 } });

test('Querformat: Lied über seinen Titel wählen, Werkzeuge je Lied, Blatt = nur Vollbild', async ({
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

  const aktiv = page.locator('[data-tour="chart-lied"]');
  await expect(aktiv).toBeVisible({ timeout: 20_000 });
  const kopf = page.locator('[class*="hdr"]');

  /** Steht die aktive Kapsel links (0) oder rechts (1)? */
  const aktiveSeite = async () => {
    const box = (await aktiv.boundingBox())!;
    return box.x + box.width / 2 < 590 ? 0 : 1;
  };
  expect(await aktiveSeite()).toBe(0);

  // Tipp auf den blassen Titel → dieses Lied ist aktiv, KEIN Vollbild.
  // Der Titel kommt (wie bei der aktiven Kapsel) aus dem ANGEZEIGTEN Blatt – im Stub teilen sich
  // beide Lieder dasselbe ChordPro, deshalb über das Wortende gesucht.
  await page.getByRole('button', { name: /auswählen$/ }).click();
  await expect.poll(aktiveSeite).toBe(1);
  await expect(kopf).toBeVisible();

  // Werkzeug des anderen (jetzt linken) Lieds → wählt dieses Lied UND öffnet das Werkzeug.
  await page.getByRole('button', { name: /^Aussehen – / }).click();
  await expect.poll(aktiveSeite).toBe(0);
  await expect(page.getByText('Schriftgröße')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.click(1100, 780); // Fenster schließen (Tipp daneben)

  // Tipp aufs Blatt → nur Vollbild; das aktive Lied bleibt.
  const flaeche = (await page.locator('[class*="chartArea"]').boundingBox())!;
  await page.mouse.click(flaeche.x + flaeche.width * 0.7, flaeche.y + flaeche.height / 2);
  await expect(kopf).toHaveCount(0);
  await page.mouse.click(flaeche.x + flaeche.width * 0.7, flaeche.y + flaeche.height / 2);
  await expect(kopf).toBeVisible();
  expect(await aktiveSeite()).toBe(0);
});
