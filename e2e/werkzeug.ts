import { expect, type Page } from '@playwright/test';

/**
 * Ein Werkzeug des Liedblatts öffnen. Seit Scheibe B1 (28.10.2026) stehen die Werkzeuge immer als beschriftete Knöpfe
 * in der Kopfkarte – am Handy im Raster mit Kurzwort, der volle Name bleibt ihr zugänglicher Name. Eine Stelle, die
 * den Weg kennt, statt in jedem Test eine eigene Fassung.
 */
export async function oeffneWerkzeug(page: Page, name: 'Tempo' | 'Anmerken' | 'Aussehen') {
  await page.getByRole('button', { name, exact: true }).click();
}

/**
 * **Den Cursor im Lied-Editor hinter die ersten `zeichen` Zeichen einer Zeile setzen** – eine Stelle für alle
 * Editor-Tests (bis zum 29.10.2026 stand dieselbe Klick-Folge viermal in den Tests, je eine Kopie).
 *
 * Geklickt wird ganz links in die Zeile (mitten in der Zeile träfe man womöglich ein Kärtchen), dann mit den Pfeilen
 * weiter. **Erst auf die Schrift warten:** Solange Lato lädt, zeichnet der Browser eine Ersatzschrift, und am Handy
 * bricht die Zeile damit um – 62 px statt 31. Die Kopien maßen die Höhe zu früh und klickten auf ihre halbe Höhe;
 * nach dem Laden lag dort schon die NÄCHSTE Zeile, und Playwright versuchte den Klick 60 s lang („another cm-line
 * intercepts pointer events“). Unter Last – wenn die Schrift später kam – scheiterte so „Schreibansicht am Handy“
 * gelegentlich, auch auf main. Geklickt wird deshalb nach `document.fonts.ready` und in die ERSTE Bildschirmzeile
 * (8 px unter der Oberkante), nicht in die Mitte. Jede der beiden Vorkehrungen reicht für den Klick allein
 * (Gegenprobe mit zurückgehaltener Schrift, `editor-schreiben.spec.ts`); das Warten auf die Schrift schützt zusätzlich
 * alles, was ein Test danach misst (Lage der Kärtchen).
 */
export async function cursorInZeile(page: Page, text: string, zeichen: number) {
  const zeile = page.locator('.cm-line', { hasText: text });
  await expect(zeile).toBeVisible({ timeout: 30_000 });
  // Als Zeichenkette: Die E2E-Typen kennen das DOM nicht (`e2e/tsconfig.json`, nur `node`).
  await page.evaluate('document.fonts.ready.then(() => true)');
  await zeile.click({ position: { x: 1, y: 8 } });
  for (let i = 0; i < zeichen; i++) await page.keyboard.press('ArrowRight');
}
