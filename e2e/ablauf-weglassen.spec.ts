import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Auge „An diesem Termin weglassen“ (E6-3b, #652): Schalter im Punkt-Fenster → eigener Server
 * (`PUT …/weglassen`) → ChurchTools (Stub) bekommt `POST …/hide` → der neu geladene Ablauf zeigt den Punkt grau
 * mit „an diesem Termin weggelassen“. Als E2E, weil der Weg über den Server (Route, Schema, Weiche im Client)
 * sonst nirgends zusammen läuft.
 *
 * Der Stub ist für alle Tests derselbe Prozess – der Test zeigt den Punkt am Ende wieder.
 */
const STUB = 'http://localhost:4599';
const EVENT_ID = 1500;

async function zeitImStub(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get(`${STUB}/api/events/${EVENT_ID}/agenda`);
  const { data } = (await res.json()) as {
    data: { items: { id: number; startTimes: Record<string, string | null> }[] };
  };
  return data.items.find((i) => i.id === 1)?.startTimes[String(EVENT_ID)];
}

test('An diesem Termin weglassen: Schalter schreibt hide, die Zeile steht grau mit Hinweis', async ({
  page,
  request,
}) => {
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
  await page.getByText('Gottesdienst (Stub)').click();
  await expect(page.getByText('Begrüßung')).toBeVisible();
  const hinweis = page.getByText('an diesem Termin weggelassen');
  await expect(hinweis).toHaveCount(0);

  // ── Begrüßung weglassen ─────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  await page.locator('button', { hasText: 'Begrüßung' }).first().click();
  const schalter = page.getByRole('button', { name: /An diesem Termin weglassen/ });
  await expect(schalter).toHaveAttribute('aria-pressed', 'false');
  await schalter.click();
  await page.getByRole('button', { name: 'Speichern' }).click();

  // ChurchTools hat `hide` bekommen …
  await expect.poll(() => zeitImStub(request)).toBeNull();
  // … und die Bearbeiten-Liste zeigt den Hinweis – auch die Ansicht.
  await expect(hinweis).toBeVisible();
  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(hinweis).toBeVisible();

  // ── Wieder zeigen (der Stub ist geteilt) ────────────────────────────────────
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  await page.locator('button', { hasText: 'Begrüßung' }).first().click();
  await expect(schalter).toHaveAttribute('aria-pressed', 'true');
  await schalter.click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => zeitImStub(request)).toBeUndefined();
  await expect(hinweis).toHaveCount(0);
});
