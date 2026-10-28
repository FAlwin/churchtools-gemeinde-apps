import type { Page } from '@playwright/test';

/**
 * Ein Werkzeug des Liedblatts öffnen. Seit Scheibe B1 (28.10.2026) stehen die Werkzeuge immer als beschriftete Knöpfe
 * in der Kopfkarte – am Handy im Raster mit Kurzwort, der volle Name bleibt ihr zugänglicher Name. Eine Stelle, die
 * den Weg kennt, statt in jedem Test eine eigene Fassung.
 */
export async function oeffneWerkzeug(page: Page, name: 'Tempo' | 'Anmerken' | 'Aussehen') {
  await page.getByRole('button', { name, exact: true }).click();
}
