import type { Page } from '@playwright/test';

/**
 * Ein Werkzeug des Liedblatts öffnen. Seit Scheibe B1 (28.10.2026) stehen die Werkzeuge immer als beschriftete Knöpfe
 * in der Kopfkarte – am Handy im Raster mit Kurzwort, der volle Name bleibt ihr zugänglicher Name. Eine Stelle, die
 * den Weg kennt, statt in jedem Test eine eigene Fassung.
 */
export async function oeffneWerkzeug(page: Page, name: 'Tempo' | 'Anmerken' | 'Aussehen') {
  await page.getByRole('button', { name, exact: true }).click();
}

/**
 * **Cursor an den Anfang einer Zeile des Lied-Editors** – ganz links geklickt, mitten in der Zeile träfe man womöglich
 * ein Akkord-Kärtchen. Eine Stelle für alle Editor-Tests (vorher vier Kopien).
 *
 * Gemessen wird erst, wenn die Schriften geladen sind (28.10.2026): Unter Last kam die Webschrift später, mit der
 * Ersatzschrift brach die Zeile am Handy auf zwei Reihen um (62 px statt 31 px). Der Klick auf die halbe, alte Höhe
 * landete danach genau auf der Zeile darunter – „<div class="cm-line"> intercepts pointer events“, 60 s lang, in 4 von
 * 24 Läufen (`--repeat-each=24 --workers=8`).
 */
export async function anDenZeilenanfang(page: Page, text: string): Promise<void> {
  const zeile = page.locator('.cm-line', { hasText: text });
  // `document.fonts` kennen die E2E-Typen nicht (ohne DOM-Schrift-Typen) – deshalb ausdrücklich so beschrieben.
  await page.evaluate(async () => {
    await (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready;
  });
  const h = (await zeile.boundingBox())!.height;
  await zeile.click({ position: { x: 1, y: h / 2 } });
}
