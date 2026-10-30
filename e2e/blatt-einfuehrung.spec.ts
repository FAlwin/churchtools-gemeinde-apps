import { test, expect, type Page } from '@playwright/test';
import { CHART_STEPS, chartSchritte } from '../client/src/utils/onboarding';

/**
 * **Scheibe B5: Die Einführung im Liedblatt findet jedes Ziel** (30.10.2026). Fehlt das Ziel eines Schritts, überspringt
 * `Coachmarks` ihn stillschweigend – ein Umbau des Liedblatts (B1–B4) könnte so Schritte verlieren, ohne dass es
 * jemand merkt. Hier wird die Einführung durchgeklickt: Jeder Schritt muss in seiner Reihenfolge erscheinen.
 * Die Titel kommen aus `onboarding.ts` selbst, nicht von Hand.
 */
async function durchklicken(page: Page, titel: string[]) {
  const blase = page.locator('[role="dialog"]').filter({ hasText: 'Schritt' });
  for (let i = 0; i < titel.length; i++) {
    await expect(blase).toContainText(titel[i], { timeout: 30_000 });
    await expect(blase).toContainText(`Schritt ${i + 1} von ${titel.length}`);
    await blase.getByRole('button', { name: i + 1 === titel.length ? 'Fertig' : 'Weiter' }).click();
  }
  await expect(blase).toHaveCount(0);
}

for (const [name, breite, hoehe] of [
  ['iPad quer', 1180, 820],
  ['iPad hochkant', 834, 1194],
  ['Handy', 390, 844],
] as const) {
  test(`${name}: alle Schritte der Einführung im Liedblatt erscheinen`, async ({ page }) => {
    await page.setViewportSize({ width: breite, height: hoehe });
    await page.goto('/?demo=chart');
    await durchklicken(
      page,
      CHART_STEPS.map((s) => s.title),
    );
  });
}

test('Scroll-Modus: erst „Scrollen“, dann dieselben Schritte', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('worship:liedansicht', 'scrollen'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?demo=chart');
  await durchklicken(
    page,
    chartSchritte(true).map((s) => s.title),
  );
});
