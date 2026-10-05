import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Vorlauf vor dem Gottesdienstbeginn (#423, Alwin, 04.10.2026): Der Soundcheck stand als erster Punkt
 * im Ablauf, ChurchTools rechnete ab 10:00 – der eigentliche Beginn landete bei 11:00.
 *
 * Geprüft wird der ganze Weg: Schalter im Dialog → eigener Server → ChurchTools (Stub) bekommt NUR
 * die Grenze → der neu geladene Ablauf zeigt die Linie „Beginn". Als E2E, weil die Teile einzeln
 * getestet sind, das Zusammenspiel (Speichern, Neuladen, Linie in der Bearbeiten-Liste) aber nicht.
 *
 * Der Stub ist für alle Tests derselbe Prozess – der Test schaltet den Vorlauf am Ende wieder aus.
 */
const STUB = 'http://localhost:4599';
const EVENT_ID = 1500;

async function grenzeImStub(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get(`${STUB}/api/events/${EVENT_ID}/agenda`);
  const { data } = (await res.json()) as { data: { eventStartPosition: number } };
  return data.eventStartPosition;
}

test('Vor Gottesdienstbeginn: Schalter setzt die Grenze, die Linie erscheint', async ({
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
  // Ausgangslage: kein Vorlauf, keine Linie.
  await expect(page.getByRole('separator', { name: /^Beginn/ })).toHaveCount(0);

  // ── Begrüßung als Vorlauf markieren ─────────────────────────────────────────
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  await page.locator('button', { hasText: 'Begrüßung' }).first().click();
  const schalter = page.getByRole('button', { name: /Vor Gottesdienstbeginn/ });
  await expect(schalter).toHaveAttribute('aria-pressed', 'false');
  // Der alte, falsch beschriftete Schalter ist weg.
  await expect(page.getByText('Uhrzeit ausblenden')).toHaveCount(0);
  await schalter.click();
  await page.getByRole('button', { name: 'Speichern' }).click();

  // ChurchTools hat die Grenze unter der Begrüßung bekommen …
  await expect.poll(() => grenzeImStub(request)).toBe(1);
  // … und die Bearbeiten-Liste zeigt die Linie zwischen Begrüßung und Lied.
  const linie = page.getByRole('separator', { name: /^Beginn/ });
  await expect(linie).toBeVisible();

  // ── Auch in der Ansicht ─────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(linie).toBeVisible();

  // ── Wieder ausschalten (der Stub ist geteilt) ───────────────────────────────
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  await page.locator('button', { hasText: 'Begrüßung' }).first().click();
  await expect(schalter).toHaveAttribute('aria-pressed', 'true');
  await schalter.click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => grenzeImStub(request)).toBe(0);
  await expect(linie).toHaveCount(0);
});
