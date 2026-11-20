import { test, expect, type Page } from '@playwright/test';
import { demoAdresse, ERWEITERUNGEN, type Erweiterung } from './erweiterungen';

/**
 * **Rauchtest je Erweiterung** (#845, Schritt 2 von „Netz zuerst“). Bis hier gab es E2E nur für die Musik-App; die
 * vier Erweiterungen waren nur durch Unit-Tests gedeckt. Bevor Ladeschicht und große Komponenten umgebaut werden,
 * hält dieser Test fest: Jede Erweiterung startet im Demo-Modus (`?demo`, `ui/erweiterung/starten.tsx`), zeigt ihre
 * Startseite, ein Hauptweg führt weiter – und dabei gibt es weder Seiten- noch Konsolenfehler.
 *
 * Nichts gegen eine echte Instanz – die Demo spielt ChurchTools nach; Prüfpunkte ohne Datum (die Demos rechnen
 * relativ zu heute).
 */
const WEGE: Record<
  Erweiterung,
  { start: string; gehe: (p: Page) => Promise<void>; ziel?: RegExp; da: string }
> = {
  anmeldungen: {
    start: 'Neue Veranstaltung',
    // Seit B7 ist jede Veranstaltung eine ganze Zeile als Knopf; die Zeile oben unter „Braucht deine Aufmerksamkeit“
    // ist ein Link nach ChurchTools (Nachrücken) – deshalb der Knopf, nicht der erste Text.
    gehe: (p) =>
      p
        .getByRole('button', { name: /Lobpreisabend/ })
        .first()
        .click(),
    ziel: /#\/v\/40$/,
    da: 'Anmeldeschluss',
  },
  dienstplaner: {
    start: 'Wann kann ich?',
    gehe: (p) => p.getByRole('button', { name: 'Planen', exact: true }).click(),
    ziel: /#\/planen$/,
    da: 'Wer wie oft?',
  },
  organigramm: {
    // Seit 20.11.2026 steht „Neue Gliederung“ im ⋯ statt als Reiter – „Präsentieren“ steht fest in der Werkzeugzeile.
    start: 'Präsentieren',
    gehe: (p) => p.getByRole('button', { name: 'Personen', exact: true }).first().click(),
    ziel: /#personen$/,
    da: 'Einsätze (6 Monate)',
  },
  protokolle: {
    start: 'Einstellungen',
    gehe: (p) => p.getByRole('button', { name: 'Sitzungen', exact: true }).click(),
    ziel: /#\/sitzungen$/,
    da: 'Kommend',
  },
  // Ohne Fall ist der Gebetsabend noch nicht eingerichtet; „Einrichten“ legt in der Demo nur im Speicher an.
  // Nicht „zuhören“: das lädt VDO.Ninja aus dem Netz.
  gebetsabend: {
    start: 'Einrichten',
    gehe: (p) => p.getByRole('button', { name: 'Einrichten', exact: true }).click(),
    da: 'Noch keine Übertragung',
  },
  // Ohne Fall ist die Website noch nicht eingerichtet (Admin); „Einrichten“ legt in der Demo nur im Speicher an. Die
  // Gruppe „Website“ ist vorgewählt, danach fehlt noch die Startseite – der Hinweis mit seinem Knopf ist der Beleg.
  website: {
    start: 'Einrichten',
    gehe: (p) => p.getByRole('button', { name: 'Einrichten', exact: true }).click(),
    da: 'Diese Website hat noch keine Startseite',
  },
};

for (const { app } of ERWEITERUNGEN) {
  test(`${app}: startet im Demo-Modus, Hauptweg ohne Fehler`, async ({ page }) => {
    const fehler: string[] = [];
    page.on('pageerror', (e) => fehler.push(`Seite: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') fehler.push(`Konsole: ${m.text()}`);
    });
    const weg = WEGE[app];

    await page.goto(demoAdresse(app));
    await expect(page.getByText(weg.start, { exact: true }).first()).toBeVisible();
    // Die Klasse aus dem gemeinsamen Start – ohne sie liegt die App nicht unter der ChurchTools-Leiste.
    await expect(page.locator('html')).toHaveClass(/\bct-extension\b/);

    await weg.gehe(page);
    if (weg.ziel) await expect(page).toHaveURL(weg.ziel);
    await expect(page.getByText(weg.da, { exact: true }).first()).toBeVisible();

    expect(fehler, fehler.join('\n')).toEqual([]);
  });
}
