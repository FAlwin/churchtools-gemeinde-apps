import { test, expect } from '@playwright/test';
import {
  TOUR_CHART,
  TOUR_SETLIST,
  TOUR_SETLIST_EDIT,
  TOUR_TERMINE,
} from '../client/src/utils/onboarding';

/**
 * **Ablauf in der App anlegen** (Alwin, 13.10.2026) – der ganze Weg über den echten Server. Seit dem 05.11.2026 über
 * den Filter der Terminliste statt über die Verwaltung: Kalender „Anlegeprobe“ → „auch ohne Ablauf“ → die
 * Veranstaltung steht mit „Kein Ablauf" in der Liste → „Ablauf anlegen" → die Vorlage ist vorausgewählt → angelegt, der
 * neue Ablauf öffnet sich mit den Punkten der Vorlage. Das Suchwort gibt es nicht mehr – der Gebetsabend im selben
 * Kalender steht mit da.
 *
 * Eigener Kalender und eigener Admin im Stub. Der Filter liegt im Browser (je Gerät), die parallel laufenden Tests
 * sehen ihn nicht. Der Startwert kommt aber aus der früheren Einstellung der Gemeinde (`server/.e2e-data`) – also
 * den Zielzustand herstellen, nicht blind umschalten.
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

  // Filter der Terminliste: beim Kalender „Anlegeprobe“ auch Termine ohne Ablauf zeigen.
  await page.getByRole('button', { name: /^Filter/ }).click();
  const ohneAblauf = page.getByRole('checkbox', { name: 'Anlegeprobe: auch ohne Ablauf' });
  if (!(await ohneAblauf.isChecked())) await ohneAblauf.click();
  await expect(ohneAblauf).toBeChecked();
  // Die Zeile „Termine ohne Ablauf“ unter Mehr → Verwaltung gibt es nicht mehr.
  await page.keyboard.press('Escape');

  // Terminliste: der Gottesdienst ohne Ablauf – und der Gebetsabend im selben Kalender (kein Suchwort mehr).
  const zeile = page.getByRole('button', { name: /Gottesdienst zur Anlegeprobe.*Kein Ablauf/ });
  await expect(zeile).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Gebetsabend zur Anlegeprobe')).toBeVisible();

  // Je Kalender (05.11.2026): Der Musiker darf Abläufe nur in Kalender 1 bearbeiten – sein Filter bietet „auch ohne
  // Ablauf“ nur dort an (die Namen kommen aus `/api/kalender`, seit heute ohne Admin-Recht), und die Termine aus
  // „Anlegeprobe“ (Kalender 6) erscheinen bei ihm nicht. Eigener Browser-Kontext = eigene Anmeldung.
  const musiker = await browser.newContext();
  const mPage = await musiker.newPage();
  await mPage.addInitScript(tourenAus, TOUREN);
  await mPage.goto('/');
  await mPage.getByLabel(/E-Mail/i).fill('test@example.org');
  await mPage.getByLabel(/Passwort/i).fill('egal-der-stub-prueft-nicht');
  await mPage.getByRole('button', { name: /Anmelden/i }).click();
  await mPage.getByRole('button', { name: /^Filter/ }).click();
  await expect(
    mPage.getByRole('checkbox', { name: 'Gottesdienst: auch ohne Ablauf' }),
  ).toBeVisible();
  await expect(mPage.getByRole('checkbox', { name: 'Anlegeprobe: auch ohne Ablauf' })).toHaveCount(
    0,
  );
  await expect(mPage.getByText('Gottesdienst zur Anlegeprobe')).toHaveCount(0);
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
