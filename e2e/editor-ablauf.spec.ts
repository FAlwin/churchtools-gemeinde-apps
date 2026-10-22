import { test, expect, type Page } from '@playwright/test';
import { DEMO_EDITOR_TEXT } from '../client/src/dev/demoEditorText';
import { flowSetzen } from '../client/src/utils/chordpro';

/**
 * **Lied-Editor L2: Ablauf als Kärtchen** (22.10.2026, Alwin: „wie in ProPresenter“). Geprüft am gespeicherten
 * Text: Er muss genau die Flow-Zeile tragen, die `flowSetzen` für die Kärtchen-Reihenfolge schreibt – und sonst
 * Zeichen für Zeichen gleich sein. Im Text selbst ist die Flow-Zeile unsichtbar.
 */
const gespeichert = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __gespeichert?: { text: string } }).__gespeichert?.text,
  );

/** Der erwartete Text: die Demo mit dieser Reihenfolge – über denselben Erzeuger wie die App. */
function mitAblauf(eintraege: string[]): string {
  const a = flowSetzen(DEMO_EDITOR_TEXT, eintraege);
  return a
    ? DEMO_EDITOR_TEXT.slice(0, a.from) + a.insert + DEMO_EDITOR_TEXT.slice(a.to)
    : DEMO_EDITOR_TEXT;
}

async function oeffnen(page: Page) {
  await page.goto('/?demo=editor');
  await expect(page.getByRole('region', { name: 'Text' })).toBeAttached({ timeout: 30_000 });
}

const kaertchen = (page: Page) =>
  page.getByRole('region', { name: 'Ablauf' }).getByRole('listitem').locator('span').first();

async function reihenfolge(page: Page): Promise<string[]> {
  return page
    .getByRole('region', { name: 'Ablauf' })
    .getByRole('listitem')
    .evaluateAll((li) => li.map((x) => x.querySelector('span')?.textContent ?? ''));
}

test.describe('breit (iPad)', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('hinzufügen und ziehen – gespeichert wird genau diese Flow-Zeile, im Text ist sie unsichtbar', async ({
    page,
  }) => {
    await oeffnen(page);
    const ablauf = page.getByRole('region', { name: 'Ablauf' });
    expect(await reihenfolge(page)).toEqual(['Vers', 'Chorus']);
    await ablauf.getByRole('button', { name: 'Chorus', exact: true }).click();
    expect(await reihenfolge(page)).toEqual(['Vers', 'Chorus', 'Chorus']);
    await expect(page.locator('.cm-content')).not.toContainText('{flow');

    // „Vers“ am Griff hinter das letzte Kärtchen ziehen.
    const griff = ablauf.getByRole('button', { name: 'Vers verschieben' });
    const ziel = ablauf.getByRole('listitem').last();
    const g = (await griff.boundingBox())!;
    const z = (await ziel.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + 20, g.y + g.height / 2, { steps: 5 });
    await page.mouse.move(z.x + z.width - 4, z.y + z.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => reihenfolge(page)).toEqual(['Chorus', 'Chorus', 'Vers']);
    // dnd-kit fängt Klicks ab, bis das Ablegen ganz durch ist (damit das Ablegen nichts antippt) – in echt
    // liegt zwischen Ablegen und Speichern immer mehr Zeit.
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Speichern' }).click();
    expect(await gespeichert(page)).toBe(mitAblauf(['Chorus', 'Chorus', 'Vers']));
  });

  test('Rückgängig nimmt die Ablauf-Änderung zurück; „Wie im Text“ entfernt die Zeile', async ({
    page,
  }) => {
    await oeffnen(page);
    const ablauf = page.getByRole('region', { name: 'Ablauf' });
    await ablauf.getByRole('button', { name: 'Chorus', exact: true }).click();
    await page
      .getByRole('region', { name: 'Text' })
      .getByRole('button', { name: 'Rückgängig' })
      .click();
    expect(await reihenfolge(page)).toEqual(['Vers', 'Chorus']);
    await ablauf.getByRole('button', { name: 'Vers aus dem Ablauf nehmen' }).click();
    expect(await reihenfolge(page)).toEqual(['Chorus']);
    await ablauf.getByRole('button', { name: 'Wie im Text' }).click();
    expect(await reihenfolge(page)).toEqual(['Vers', 'Chorus']);
    await page.getByRole('button', { name: 'Speichern' }).click();
    expect(await gespeichert(page)).toBe(DEMO_EDITOR_TEXT);
  });
});

test.describe('schmal (Handy)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Reiter „Ablauf“: Liste, × und „+ Teil“ – gespeichert wie gewollt', async ({ page }) => {
    await oeffnen(page);
    await page
      .getByRole('group', { name: 'Ansicht' })
      .getByRole('button', { name: 'Ablauf' })
      .click();
    const ablauf = page.getByRole('region', { name: 'Ablauf' });
    await expect(ablauf).toBeVisible();
    await expect(page.getByRole('region', { name: 'Text' })).toBeHidden();
    await ablauf.getByRole('button', { name: 'Chorus', exact: true }).click();
    await ablauf.getByRole('button', { name: 'Vers aus dem Ablauf nehmen' }).click();
    expect(await reihenfolge(page)).toEqual(['Chorus', 'Chorus']);
    // Daumengröße: das × ist mindestens 44 px groß.
    const x = (await ablauf
      .getByRole('button', { name: /aus dem Ablauf nehmen/ })
      .first()
      .boundingBox())!;
    expect(x.height).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Speichern' }).click();
    expect(await gespeichert(page)).toBe(mitAblauf(['Chorus', 'Chorus']));
    await expect(kaertchen(page)).toHaveText('Chorus');
  });
});
