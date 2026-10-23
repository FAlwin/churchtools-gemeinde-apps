import { test, expect, type Page } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * „Neu aufsetzen“ (E6-5b, #691) über den **echten Server**: Bestand lesen (`GET …/agenda/bestand`), Nachfrage, dann
 * `PUT …/agenda/neu` mit `gesehen` – zod verlangt das Feld, ein Weg, der es striche, scheiterte hier sofort. Der Stub
 * verhält sich wie gemessen (E6-5b-0): 1510 und 1511 teilen einen Ablauf, Leeren trifft beide, `DELETE` löst nur den
 * einen. Tests nacheinander, vorher zurückgesetzt.
 */
test.describe.configure({ mode: 'serial' });

const STUB = 'http://localhost:4599';
const HIER = 1510;
const ANDERER = 1511;

async function titelImStub(page: Page, eventId: number): Promise<string[] | null> {
  const res = await page.request.get(`${STUB}/api/events/${eventId}/agenda`);
  if (res.status() === 404) return null;
  return ((await res.json()) as { data: { items: { title: string }[] } }).data.items.map(
    (i) => i.title,
  );
}

async function oeffneNeuAufsetzen(page: Page): Promise<void> {
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
  await page.getByText('Neu-Probe (Stub)', { exact: true }).click();
  await expect(page.locator('#root').getByText('Predigt (geteilt)')).toBeVisible();
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  await page.getByRole('button', { name: /Neu aufsetzen/ }).click();
  await expect(page.getByText('Ablauf neu aufsetzen')).toBeVisible();
  // Bis die Vorlagen da sind, steht „Wie eine frühere“ vorn – erst danach ist die Vorlage gewählt.
  await expect(page.getByText('Probe-Vorlage (Stub)')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.request.post(`${STUB}/__stub/neu-zuruecksetzen`);
});

test('geteilt, „Nur für diesen Termin neu“: eigener Ablauf aus der Vorlage, der andere Termin behält seinen', async ({
  page,
}) => {
  await oeffneNeuAufsetzen(page);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();

  await expect(page.getByText(/gilt auch für einen weiteren Termin/)).toBeVisible();
  await expect(page.getByText(/Neu-Probe Teil 2 \(Stub\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Nur für diesen Termin neu' }).click();

  await expect
    .poll(() => titelImStub(page, HIER))
    .toEqual(['Ankommen (Vorlage)', 'Begrüßung (Vorlage)']);
  expect(await titelImStub(page, ANDERER)).toEqual(['Ankommen (geteilt)', 'Predigt (geteilt)']);
  // Die Liste zeigt den neuen Ablauf, man bleibt im Bearbeiten.
  await expect(page.locator('#root').getByText('Begrüßung (Vorlage)')).toBeVisible();
  await expect(page.getByRole('button', { name: /Neu aufsetzen/ })).toBeVisible();
});

test('geteilt, leer „Für beide leeren“: beide Termine stehen ohne Punkte da', async ({ page }) => {
  await oeffneNeuAufsetzen(page);
  await page.getByRole('button', { name: /^Leer/ }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();

  await expect(page.getByText('Ablauf leeren?')).toBeVisible();
  await page.getByRole('button', { name: 'Für beide leeren' }).click();

  await expect.poll(() => titelImStub(page, HIER)).toEqual([]);
  expect(await titelImStub(page, ANDERER)).toEqual([]);
  await expect(page.locator('#root').getByText('Predigt (geteilt)')).toHaveCount(0);
});

test('Abbrechen in der Nachfrage ändert nichts', async ({ page }) => {
  await oeffneNeuAufsetzen(page);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await expect(page.getByText('Ablauf ersetzen?')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  expect(await titelImStub(page, HIER)).toEqual(['Ankommen (geteilt)', 'Predigt (geteilt)']);
});
