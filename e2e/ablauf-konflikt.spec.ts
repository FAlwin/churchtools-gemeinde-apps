import { test, expect, type Page } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Nicht still überschreiben (E6-3c, #659; entschieden mit Alwin 22.10.2026: nur bei echtem Konflikt).
 *
 * Der Test spielt „die andere App“: Er ändert im Stub direkt einen Punkt bzw. die Reihenfolge, während die Musik-App
 * den alten Stand zeigt. Als E2E, weil `gesehen` durch Client, Server-Schema und Schreibkern muss – zod striche es
 * sonst still weg, und alles sähe gut aus. Eigener Termin („Konflikt-Probe“), Tests nacheinander, am Ende
 * zurückgesetzt.
 */
test.describe.configure({ mode: 'serial' });

const STUB = 'http://localhost:4599';
const EVENT_ID = 1509;
type Punkt = { id: number; title: string; note: string; position: number };

async function stubAblauf(page: Page): Promise<Punkt[]> {
  const res = await page.request.get(`${STUB}/api/events/${EVENT_ID}/agenda`);
  return ((await res.json()) as { data: { items: Punkt[] } }).data.items;
}

async function vonAussen(page: Page, id: number, felder: { title: string; note?: string }) {
  await page.request.put(`${STUB}/api/events/${EVENT_ID}/agenda/items/${id}`, {
    data: { duration: 300, responsible: '', note: '', ...felder },
  });
}

async function oeffneBearbeiten(page: Page): Promise<void> {
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
  await page.getByText('Konflikt-Probe (Stub)').click();
  await expect(page.locator('#root').getByText('Ansage (Konflikt)')).toBeVisible();
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
}

test.afterEach(async ({ page }) => {
  // Zurücksetzen: Titel, Notiz und Reihenfolge wie im Stub angelegt.
  await vonAussen(page, 951, { title: 'Ansage (Konflikt)' });
  await vonAussen(page, 952, { title: 'Gebet (Konflikt)' });
  await page.request.put(`${STUB}/api/events/${EVENT_ID}/agenda`, {
    data: { items: [{ id: 951 }, { id: 952 }] },
  });
});

test('derselbe Punkt woanders geändert → Rückfrage; „Trotzdem speichern“ schreibt meinen Titel', async ({
  page,
}) => {
  await oeffneBearbeiten(page);
  await page.locator('#root').getByText('Ansage (Konflikt)').click();
  await vonAussen(page, 951, { title: 'Ansage (von außen)' });

  await page.getByPlaceholder('Titel').fill('Ansage (meins)');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('alert')).toContainText('Dieser Punkt wurde eben woanders geändert');
  // Nichts still überschrieben – und die Liste dahinter ist neu geladen.
  expect((await stubAblauf(page))[0].title).toBe('Ansage (von außen)');
  await expect(page.locator('#root').getByText('Ansage (von außen)')).toHaveCount(1);

  await page.getByRole('button', { name: 'Trotzdem speichern' }).click();
  await expect.poll(async () => (await stubAblauf(page))[0].title).toBe('Ansage (meins)');
});

test('ein ANDERES Feld woanders geändert → kein Konflikt, beides bleibt', async ({ page }) => {
  await oeffneBearbeiten(page);
  await page.locator('#root').getByText('Ansage (Konflikt)').click();
  await vonAussen(page, 951, { title: 'Ansage (Konflikt)', note: 'von außen' });

  await page.getByPlaceholder('Titel').fill('Ansage (meins)');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect
    .poll(async () => (await stubAblauf(page))[0])
    .toMatchObject({ title: 'Ansage (meins)', note: 'von außen' });
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Reihenfolge woanders geändert → mein Ziehen überschreibt sie nicht', async ({ page }) => {
  await oeffneBearbeiten(page);
  // Von außen: Gebet nach vorn.
  await page.request.put(`${STUB}/api/events/${EVENT_ID}/agenda`, {
    data: { items: [{ id: 952 }, { id: 951 }] },
  });
  // In der App (alter Stand Ansage, Gebet): Gebet über Ansage ziehen – hier wäre das dieselbe Reihenfolge,
  // geschrieben würde aber auf der alten. Erwartet: Hinweis, nichts geschrieben, neu geladen.
  const griffe = page.getByRole('button', { name: 'Verschieben' });
  const von = (await griffe.nth(1).boundingBox())!;
  const nach = (await griffe.nth(0).boundingBox())!;
  await page.mouse.move(von.x + von.width / 2, von.y + von.height / 2);
  await page.mouse.down();
  await page.mouse.move(von.x + von.width / 2, nach.y + 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText(/Die Reihenfolge wurde eben woanders geändert/)).toBeVisible();
  expect((await stubAblauf(page)).map((p) => p.id)).toEqual([952, 951]);
  // Neu geladen: Die Liste zeigt jetzt den Stand von außen.
  await expect
    .poll(() =>
      page
        .locator('#root')
        .getByText(/\((Konflikt)\)$/)
        .allTextContents(),
    )
    .toEqual(['Gebet (Konflikt)', 'Ansage (Konflikt)']);
});
