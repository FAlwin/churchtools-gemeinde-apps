import type { Page } from '@playwright/test';

/**
 * Ein Werkzeug des Liedblatts öffnen – in BEIDEN Ausrichtungen (03.10.2026).
 *
 * Hochformat: hinter dem runden Werkzeuge-Knopf (Menü). Querformat: einzeln als Knopf neben dem
 * Titel (#421). Die Tests prüfen das Werkzeug, nicht den Weg dorthin – deshalb eine Stelle, die den
 * Weg kennt, statt in jedem Test eine eigene Fassung.
 */
export async function oeffneWerkzeug(page: Page, name: 'Tempo' | 'Anmerken' | 'Aussehen') {
  const sammelknopf = page.getByRole('button', { name: 'Werkzeuge', exact: true });
  if (await sammelknopf.isVisible()) {
    await sammelknopf.click();
    await page.getByRole('menuitem', { name: new RegExp(name) }).click();
  } else {
    await page.getByRole('button', { name, exact: true }).click();
  }
}
