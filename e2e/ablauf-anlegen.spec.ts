import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * **Ablauf in der App anlegen** (Alwin, 13.10.2026) – der ganze Weg über den echten Server:
 * Verwaltung → „Termine ohne Ablauf" (Kalender + Suchwort) → die Veranstaltung steht mit „Kein
 * Ablauf" in der Terminliste, der Gebetsabend im selben Kalender nicht → „Ablauf anlegen" → die
 * Vorlage ist vorausgewählt → angelegt, der neue Ablauf öffnet sich mit den Punkten der Vorlage.
 *
 * Eigener Kalender und eigener Admin im Stub. Die Namen enthalten bewusst NICHT „Gottesdienst (Stub)":
 * Ist die Funktion eingeschaltet, stehen die Termine auch in den Listen der parallel laufenden Tests – und
 * die suchen „Gottesdienst (Stub)" (so passiert beim ersten vollen Lauf).
 */
const TOUREN = [TOUR_TERMINE, TOUR_CHART, TOUR_SETLIST, TOUR_SETLIST_EDIT];
const tourenAus = (touren: string[]) => {
  for (const t of touren) localStorage.setItem(`worship:onboard-${t}`, '1');
};

test('Termin ohne Ablauf: aus der Vorlage anlegen', async ({ page, browser }) => {
  await page.addInitScript(tourenAus, TOUREN);

  await page.goto('/');
  await page.getByLabel(/E-Mail/i).fill('admin@example.org');
  await page.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await page.getByRole('button', { name: /Anmelden/i }).click();

  // Verwaltung: Kalender „Anlegeprobe" einschalten, nur Termine mit „Gottesdienst" im Namen.
  await page.getByRole('button', { name: 'Mehr', exact: true }).click();
  await page.getByRole('button', { name: /Termine ohne Ablauf/ }).click();
  // Die Einstellung bleibt zwischen Läufen gespeichert (`server/.e2e-data`) – also den Zielzustand
  // herstellen, nicht blind umschalten.
  const kalender = page.getByRole('checkbox', { name: 'Anlegeprobe' });
  if ((await kalender.getAttribute('aria-checked')) !== 'true') await kalender.click();
  await page.getByLabel('Suchwort im Terminnamen').fill('Gottesdienst');
  const speichern = page.getByRole('button', { name: 'Speichern' });
  if (await speichern.isVisible()) await speichern.click();
  else await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('button', { name: /Termine ohne Ablauf.*1 Kalender/ })).toBeVisible();

  // Terminliste: der Gottesdienst ohne Ablauf ja, der Gebetsabend im selben Kalender nicht.
  await page.getByRole('button', { name: 'Termine', exact: true }).click();
  const zeile = page.getByRole('button', { name: /Gottesdienst zur Anlegeprobe.*Kein Ablauf/ });
  await expect(zeile).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Gebetsabend zur Anlegeprobe')).toHaveCount(0);

  // Je Termin (#635): Der Musiker darf nur Kalender 1 bearbeiten – er sieht den Termin aus „Anlegeprobe"
  // (Kalender 6) mit „Kein Ablauf", aber ohne „Ablauf anlegen". Eigener Browser-Kontext = eigene Anmeldung.
  const musiker = await browser.newContext();
  const mPage = await musiker.newPage();
  await mPage.addInitScript(tourenAus, TOUREN);
  await mPage.goto('/');
  await mPage.getByLabel(/E-Mail/i).fill('test@example.org');
  await mPage.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await mPage.getByRole('button', { name: /Anmelden/i }).click();
  await expect(
    mPage.getByRole('button', { name: /Gottesdienst zur Anlegeprobe.*Kein Ablauf/ }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(mPage.getByLabel('Ablauf anlegen')).toHaveCount(0);
  await musiker.close();

  // Anlegen: „Vorlage zuerst" – die Vorlage des Kalenders ist gewählt.
  await zeile.click();
  await expect(page.getByRole('button', { name: /Probe-Vorlage \(Stub\)/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

  // Der neue Ablauf öffnet sich – mit den Punkten der Vorlage.
  await expect(page.locator('#root').getByText('Begrüßung (Vorlage)')).toBeVisible({
    timeout: 15_000,
  });
});
