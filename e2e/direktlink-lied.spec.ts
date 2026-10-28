import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * Direktlink aus dem Dienstplaner (E6-O O4, Alwin 28.10.2026): „In der Musik-App öffnen“ in der Lied-Ansicht führt auf
 * `#/termin/<Termin>/punkt/<Punkt>`. Die App öffnet dann gleich das Blatt dieses Lieds im Ablauf dieses Termins – und
 * nimmt den Direktlink aus der Adresse, damit ein Neuladen nicht wieder hinspringt.
 */
async function anmelden(page: import('@playwright/test').Page) {
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
  await expect(page.getByText('Gottesdienst (Stub)')).toBeVisible();
  // Erst neu laden, wenn der Anmeldestatus gespeichert ist: Der Abfrage-Speicher (IndexedDB `worship-rq-cache`) schreibt
  // höchstens einmal je Sekunde, und `['me']` gilt 60 s als frisch. Wer früher neu lädt, bekommt den Stand von VOR der
  // Anmeldung zurück und sieht wieder das Anmelden – parallel kam das in jedem zweiten bis dritten Lauf vor
  // (28.10.2026). Eine feste Wartezeit wäre geraten; das hier wartet auf genau den Zustand.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        // Nur öffnen, wenn es die Datenbank schon gibt – sonst legte `open` sie leer an, ohne den Speicher von idb-keyval.
        if (!(await indexedDB.databases()).some((d) => d.name === 'keyval-store')) return false;
        return new Promise<boolean>((ok) => {
          const r = indexedDB.open('keyval-store');
          r.onerror = () => ok(false);
          r.onsuccess = () => {
            try {
              const g = r.result
                .transaction('keyval')
                .objectStore('keyval')
                .get('worship-rq-cache');
              g.onsuccess = () =>
                ok(typeof g.result === 'string' && g.result.includes('"authenticated":true'));
              g.onerror = () => ok(false);
            } catch {
              ok(false);
            } finally {
              r.result.close();
            }
          };
        });
      }),
    )
    .toBe(true);
}

test('Punkt mit Lied: öffnet gleich das Blatt; der Direktlink verschwindet aus der Adresse', async ({
  page,
}) => {
  await anmelden(page);
  // Ein frischer Seitenaufruf wie aus dem Dienstplaner – ein Hash-Wechsel allein lädt die Seite nicht neu.
  await page.evaluate(() => window.history.replaceState(null, '', '/#/termin/1500/punkt/2'));
  await page.reload();
  await expect(page.getByText('Testlied aus ChurchTools').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Ablauf bearbeiten' })).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('');
});

test('Punkt ohne Lied: öffnet den Ablauf des Termins', async ({ page }) => {
  await anmelden(page);
  // Ein frischer Seitenaufruf wie aus dem Dienstplaner – ein Hash-Wechsel allein lädt die Seite nicht neu.
  await page.evaluate(() => window.history.replaceState(null, '', '/#/termin/1500/punkt/1'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ablauf bearbeiten' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Begrüßung')).toBeVisible();
});

/** Der Tag vor `tage` Tagen in Ortszeit (`YYYY-MM-DD`) – wie der Dienstplaner ihn in den Link schreibt. */
function tagVor(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() - tage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('Termin außerhalb der geladenen Wochen: der Tag im Link holt ihn nach (Test-Instanz, 28.10.2026)', async ({
  page,
}) => {
  await anmelden(page);
  await page.evaluate(
    (h) => window.history.replaceState(null, '', h),
    `/#/termin/1512/punkt/1202?am=${tagVor(20)}`,
  );
  await page.reload();
  await expect(page.getByText('Testlied aus ChurchTools').first()).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).hash).toBe('');
});

test('derselbe Termin ohne Tag im Link: wie bisher die Übersicht – nichts hängt im Laden', async ({
  page,
}) => {
  await anmelden(page);
  await page.evaluate(() => window.history.replaceState(null, '', '/#/termin/1512/punkt/1202'));
  await page.reload();
  await expect(page.getByText('Gottesdienst (Stub)')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Testlied aus ChurchTools')).toHaveCount(0);
});
