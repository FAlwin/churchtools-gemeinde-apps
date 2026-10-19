import { test, expect, type Page } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * „Rückgängig" nach dem Löschen und Verschieben (Alwin, 12.10.2026).
 *
 * Als E2E, weil der Weg über drei Schichten geht: Die App merkt sich beim Löschen den Punkt (Antwort
 * des Servers), legt ihn beim Zurückholen neu an und schiebt ihn an seine alte Stelle. Einzeln getestet
 * sind die Teile; ob der Merkzettel heil durch Server und Prüfung kommt, zeigt nur der ganze Weg.
 * Eigener Termin im Stub („Rückgängig-Probe"), weil die Tests parallel laufen – und die beiden Tests
 * hier nacheinander (`serial`), denn sie teilen sich diesen Ablauf.
 */
test.describe.configure({ mode: 'serial' });
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
  await page.getByText('Rückgängig-Probe (Stub)').click();
  await expect(page.locator('#root').getByText('Zwei (Stub)')).toBeVisible();
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
}

/** Die Titel der Bearbeiten-Liste in ihrer Reihenfolge. */
async function reihenfolge(page: Page): Promise<string[]> {
  // Nur die Liste (#root) – der Hinweis unten hängt an `body` und nennt entfernte Punkte auch.
  const titel = await page
    .locator('#root')
    .getByText(/^(Eins|Zwei|Drei) \(Stub\)$/)
    .allTextContents();
  return titel.map((t) => t.replace(' (Stub)', ''));
}

test('Löschen → Rückgängig: der Punkt steht wieder an seiner Stelle', async ({ page }) => {
  await oeffneBearbeiten(page);
  await page.locator('#root').getByText('Zwei (Stub)').click();
  await page.getByRole('button', { name: /Eintrag löschen/ }).click();
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();

  const hinweis = page.getByRole('status').filter({ hasText: '„Zwei (Stub)" gelöscht' });
  await expect(hinweis).toBeVisible();
  await expect.poll(() => reihenfolge(page)).toEqual(['Eins', 'Drei']);

  await hinweis.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(hinweis).toHaveCount(0);
  await expect.poll(() => reihenfolge(page)).toEqual(['Eins', 'Zwei', 'Drei']);

  // Wirklich im (Stub-)ChurchTools, nicht nur auf dem Bildschirm: den Ablauf beim Server abfragen.
  // (Nicht per Neuladen – die App zeigt dann kurz ihren gespeicherten Stand, das prüfte nichts.)
  const res = await page.request.get('/api/services/1504/setlist');
  // Nur echte Punkte – „entfernt"-Platzhalter hängen vom Gesehen-Stand des Testkontos ab.
  const titel = ((await res.json()) as { title: string; removed?: boolean }[])
    .filter((i) => !i.removed)
    .map((i) => i.title);
  expect(titel).toEqual(['Eins (Stub)', 'Zwei (Stub)', 'Drei (Stub)']);
});

test('Verschieben → Rückgängig: die alte Reihenfolge kommt zurück', async ({ page }) => {
  await oeffneBearbeiten(page);
  await expect.poll(() => reihenfolge(page)).toEqual(['Eins', 'Zwei', 'Drei']);

  // Am Griff ziehen wie mit dem Finger: „Drei" über „Zwei" (in Schritten – dnd-kit startet erst
  // nach 6 px Bewegung).
  const griffe = page.getByRole('button', { name: 'Verschieben' });
  // Der Griff ist ein Baustein aus `ui/ablauf` (E6-2b-1, Styles von `Setlist` dorthin verschoben): Ohne
  // `touch-action: none` ließe er sich am Handy nicht ziehen, ohne die Breite spränge die Zeile beim Umschalten.
  await expect(griffe.nth(2)).toHaveCSS('touch-action', 'none');
  await expect(griffe.nth(2)).toHaveCSS('width', '42px');
  const von = (await griffe.nth(2).boundingBox())!;
  const nach = (await griffe.nth(1).boundingBox())!;
  await page.mouse.move(von.x + von.width / 2, von.y + von.height / 2);
  await page.mouse.down();
  await page.mouse.move(von.x + von.width / 2, nach.y + 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => reihenfolge(page)).toEqual(['Eins', 'Drei', 'Zwei']);

  const hinweis = page.getByRole('status').filter({ hasText: '„Drei (Stub)" verschoben' });
  await expect(hinweis).toBeVisible();
  await hinweis.getByRole('button', { name: 'Rückgängig' }).click();
  await expect.poll(() => reihenfolge(page)).toEqual(['Eins', 'Zwei', 'Drei']);
});
