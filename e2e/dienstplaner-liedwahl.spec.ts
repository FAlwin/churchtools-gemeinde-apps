import { test, expect } from '@playwright/test';
import { demoAdresse } from './erweiterungen';

/**
 * **Die Liedauswahl im Dienstplaner** (Bauplan E9, Wunsch 4 „LW2b“, 06.11.2026) – im echten Browser, mit der echten
 * Liedauswahl aus `ui/lied` (nachgeladen) und dem Liedzugriff des Dienstplaners.
 *
 * Die Unit-Tests ersetzen die Liedauswahl durch eine Attrappe. Was nur hier auffällt: Fehlt der Liedzugriff oder der
 * Zwischenspeicher der Abfragen (Provider in `App.tsx`), bricht das Fenster beim Öffnen ab – genau so lag es bei der
 * Musik-App in #887, wo nur die Demos außerhalb des Providers standen.
 */
test('Punkt-Fenster: „Lied“ öffnet die Liedauswahl mit der Liederliste – ohne Fehler', async ({
  page,
}) => {
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(`Seite: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') fehler.push(`Konsole: ${m.text()}`);
  });

  await page.goto(`${demoAdresse('dienstplaner')}#/termin/101`);
  await page.getByRole('button', { name: 'Ablauf bearbeiten' }).click();
  // Der Punkt „Lied“ mit „Halleluja“ (Demo-Ablauf von Termin 101) – antippen öffnet das Punkt-Fenster.
  await page.getByRole('button', { name: /Halleluja$/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Lied' });
  await expect(dialog.getByRole('button', { name: 'Verknüpfung aufheben' })).toBeVisible();
  await dialog.getByRole('button', { name: /^Lied: .* – anderes wählen$/ }).click();

  await expect(page.getByRole('dialog', { name: 'Lied verknüpfen' })).toBeVisible();
  // Die Liste kommt über den Liedzugriff aus ChurchTools (Demo: drei Lieder).
  await expect(page.getByText('Way Maker', { exact: true })).toBeVisible();
  await expect(page.getByText('Treu', { exact: true }).first()).toBeVisible();

  // Abbrechen führt zurück ins Punkt-Fenster.
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog.getByRole('button', { name: 'Verknüpfung aufheben' })).toBeVisible();

  expect(fehler, fehler.join('\n')).toEqual([]);
});
