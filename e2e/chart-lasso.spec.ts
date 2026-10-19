import { test, expect, type Page } from '@playwright/test';
import { TOUR_CHART } from '../client/src/utils/onboarding';
import { oeffneWerkzeug } from './werkzeug';

/**
 * **Lasso** (#615, Alwin 17.10.2026): einkreisen, verschieben, vergrößern – beim Blättern und auf der Rolle.
 * Als E2E, weil es um echte Leinwände geht (Ausschneiden, Ablegen, als Bild speichern); jsdom hat keine.
 *
 * Geprüft wird am gespeicherten Bild der A4-Seite, nicht an der Anzeige: Dort muss der Strich nach dem
 * Ablegen an der neuen Stelle stehen und an der alten nicht mehr.
 */
const SEITE = 'worship_docdraw_song999001_a999001_voriginal_0';

async function vorbereiten(page: Page, ansicht: 'blaettern' | 'scrollen', texte?: unknown[]) {
  await page.addInitScript(
    ({ tour, ansicht, texte, seite }) => {
      localStorage.setItem(`worship:onboard-${tour}`, '1');
      localStorage.setItem('worship:liedansicht', ansicht);
      if (texte) localStorage.setItem(`${seite}_text`, JSON.stringify(texte));
    },
    { tour: TOUR_CHART, ansicht, texte, seite: SEITE },
  );
  await page.goto('/?demo=chart');
  // Erst wenn das Blatt steht, gibt es die Werkzeuge (je nach Breite als Menü oder einzeln).
  await expect(page.getByRole('button', { name: /^(Werkzeuge|Anmerken)$/ }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
}

/** Ein Zug mit der Maus durch die Punkte (Bildschirm-Koordinaten). */
async function zug(page: Page, punkte: [number, number][]) {
  await page.mouse.move(...punkte[0]);
  await page.mouse.down();
  for (const p of punkte.slice(1)) await page.mouse.move(p[0], p[1], { steps: 6 });
  await page.mouse.up();
}

/** Ein Rechteck als Lasso-Form um (x0,y0)–(x1,y1). */
const umkreisen = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0 + 2],
];

/** Deckkraft im gespeicherten Bild der A4-Seite an einer Stelle (Anteile 0..1) – das Maximum ringsum. */
async function strichBei(page: Page, fx: number, fy: number): Promise<number> {
  return page.evaluate(
    async ({ key, fx, fy }) => {
      const daten = localStorage.getItem(key);
      if (!daten) return 0;
      const img = new Image();
      img.src = daten;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const x = Math.round(fx * c.width);
      const y = Math.round(fy * c.height);
      const d = ctx.getImageData(x - 3, y - 3, 7, 7).data;
      let max = 0;
      for (let i = 3; i < d.length; i += 4) max = Math.max(max, d[i]);
      return max;
    },
    { key: SEITE, fx, fy },
  );
}

test.describe('Blättern', () => {
  test.use({ viewport: { width: 390, height: 760 } });

  test('einkreisen, verschieben, ablegen – und Rückgängig holt es zurück', async ({ page }) => {
    await vorbereiten(page, 'blaettern');
    await oeffneWerkzeug(page, 'Anmerken');
    const anno = page.locator('canvas[class*="annoCanvas"]').nth(1);
    await expect(anno).toBeVisible({ timeout: 30_000 });
    const b = (await anno.boundingBox())!;
    const anteil = (x: number, y: number) => [(x - b.x) / b.width, (y - b.y) / b.height] as const;

    // Ein Strich, dann das Lasso drumherum.
    const y = b.y + b.height * 0.3;
    await zug(page, [
      [b.x + 80, y],
      [b.x + 180, y],
    ]);
    await expect.poll(() => strichBei(page, ...anteil(b.x + 130, y))).toBeGreaterThan(100);
    await page.getByRole('button', { name: 'Lasso', exact: true }).click();
    await zug(page, umkreisen(b.x + 60, y - 20, b.x + 200, y + 20));
    const auswahl = page.getByTestId('lasso-auswahl');
    await expect(auswahl).toBeVisible();

    // Im Rahmen 100 px nach unten ziehen, daneben tippen = ablegen.
    await zug(page, [
      [b.x + 130, y],
      [b.x + 130, y + 50],
      [b.x + 130, y + 100],
    ]);
    await page.mouse.click(b.x + 20, b.y + b.height - 20);
    await expect(auswahl).toHaveCount(0);

    await expect.poll(() => strichBei(page, ...anteil(b.x + 130, y + 100))).toBeGreaterThan(100);
    expect(await strichBei(page, ...anteil(b.x + 130, y))).toBe(0);

    // EIN Schritt zurück: der Strich steht wieder oben – nicht doppelt, nicht weg.
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect.poll(() => strichBei(page, ...anteil(b.x + 130, y))).toBeGreaterThan(100);
    expect(await strichBei(page, ...anteil(b.x + 130, y + 100))).toBe(0);
  });

  test('der Griff vergrößert – Strich und Text gleichmäßig', async ({ page }) => {
    await vorbereiten(page, 'blaettern', [
      { id: 7, fx: 0.5, fy: 0.5, text: 'Bass!', color: '#d92d20', sizeCqh: 2 },
    ]);
    await oeffneWerkzeug(page, 'Anmerken');
    const anno = page.locator('canvas[class*="annoCanvas"]').nth(1);
    await expect(anno).toBeVisible({ timeout: 30_000 });
    const b = (await anno.boundingBox())!;
    const mx = b.x + b.width * 0.5;
    const my = b.y + b.height * 0.5;
    const anteil = (x: number, y: number) => [(x - b.x) / b.width, (y - b.y) / b.height] as const;
    // Ein kurzer Strich unter dem Text.
    await zug(page, [
      [mx - 50, my + 10],
      [mx - 20, my + 10],
    ]);
    await expect.poll(() => strichBei(page, ...anteil(mx - 35, my + 10))).toBeGreaterThan(100);

    await page.getByRole('button', { name: 'Lasso', exact: true }).click();
    await zug(page, umkreisen(mx - 60, my - 30, mx + 60, my + 30));
    const griff = page.getByTestId('lasso-griff');
    await expect(griff).toBeVisible();
    const g = (await griff.boundingBox())!;
    // Rahmen 120 px breit → 120 px nach rechts = doppelt so groß.
    await zug(page, [
      [g.x + g.width / 2, g.y + g.height / 2],
      [g.x + g.width / 2 + 120, g.y + g.height / 2],
    ]);
    // Werkzeug wechseln legt ebenfalls ab.
    await page.getByRole('button', { name: 'Stift' }).click();
    await expect(page.getByTestId('lasso-auswahl')).toHaveCount(0);

    const texte = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(`${k}_text`)!) as { sizeCqh: number; fx: number }[],
      SEITE,
    );
    expect(texte).toHaveLength(1);
    expect(texte[0].sizeCqh).toBeCloseTo(4, 0);
    // Die Mitte der Auswahl wandert mit: vom linken oberen Eck aus vergrößert.
    expect(texte[0].fx).toBeGreaterThan(0.55);
    // Der Strich ebenso – gespeichert, obwohl erst der Werkzeugwechsel ihn abgelegt hat:
    // (mx−35 | my+10) liegt 25 | 40 px vom Eck (mx−60 | my−30) entfernt, verdoppelt 50 | 80.
    await expect.poll(() => strichBei(page, ...anteil(mx - 10, my + 50))).toBeGreaterThan(100);
    expect(await strichBei(page, ...anteil(mx - 35, my + 10))).toBe(0);
  });
});

test.describe('Rolle', () => {
  test.use({ viewport: { width: 390, height: 420 } });

  test('auf der Rolle verschoben – gespeichert auf der A4-Seite an der neuen Stelle', async ({
    page,
  }) => {
    await vorbereiten(page, 'scrollen');
    await oeffneWerkzeug(page, 'Anmerken');
    const malen = page.getByTestId('rollen-malen');
    await expect(malen).toBeVisible({ timeout: 30_000 });
    const b = (await malen.boundingBox())!;
    // Die erste Rolle beginnt wie die A4-Seite: gleiche mm, nur die Seitenhöhe ist eine andere.
    const a4 = (x: number, yy: number) =>
      [(x - b.x) / b.width, ((yy - b.y) * 210) / b.width / 297] as const;

    const y = b.y + 110;
    await zug(page, [
      [b.x + 80, y],
      [b.x + 180, y],
    ]);
    await expect
      .poll(() => strichBei(page, ...a4(b.x + 130, y)), { timeout: 5_000 })
      .toBeGreaterThan(100);

    await page.getByRole('button', { name: 'Lasso', exact: true }).click();
    await zug(page, umkreisen(b.x + 60, y - 15, b.x + 200, y + 15));
    await expect(page.getByTestId('lasso-auswahl')).toBeVisible();
    await zug(page, [
      [b.x + 130, y],
      [b.x + 130, y + 15],
      [b.x + 130, y + 30],
    ]);
    await page.mouse.click(b.x + 30, y + 70);
    await expect(page.getByTestId('lasso-auswahl')).toHaveCount(0);

    await expect
      .poll(() => strichBei(page, ...a4(b.x + 130, y + 30)), { timeout: 5_000 })
      .toBeGreaterThan(100);
    expect(await strichBei(page, ...a4(b.x + 130, y))).toBe(0);
  });

  test('ein Text aus der Lücke unter dem letzten Teil lässt sich greifen und zurechtrücken', async ({
    page,
  }) => {
    await vorbereiten(page, 'scrollen');
    // Knapp über dem Ende der ersten Rolle: auf A4 Leerraum unter dem letzten Teil (eine Lücke), auf der
    // Rolle am Ende des Lieds – also innerhalb der Rolle.
    const rolle = (await page.getByTestId('scroll-deck').locator('canvas').first().boundingBox())!;
    const hoeheMm = (rolle.height * 210) / rolle.width;
    await page.evaluate(
      ({ k, fy }) =>
        localStorage.setItem(
          `${k}_text`,
          JSON.stringify([
            { id: 3, fx: 0.5, fy, text: 'Schluss!', color: '#d92d20', sizeCqh: 1.2 },
          ]),
        ),
      { k: SEITE, fy: (hoeheMm - 4) / 297 },
    );
    await page.reload();
    await expect(page.getByRole('button', { name: /^(Werkzeuge|Anmerken)$/ }).first()).toBeVisible({
      timeout: 30_000,
    });
    await oeffneWerkzeug(page, 'Anmerken');
    const malen = page.getByTestId('rollen-malen');
    await expect(malen).toBeVisible({ timeout: 30_000 });
    const text = page.getByTestId('scroll-deck').getByText('Schluss!');
    await text.scrollIntoViewIfNeeded();
    const vorher = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(`${k}_text`)!)[0].fy as number,
      SEITE,
    );
    const t = (await text.boundingBox())!;
    const m = (await malen.boundingBox())!;
    // Er steht auf der Rolle, auf der gemalt wird – sonst prüfte der Test die falsche.
    expect(t.y).toBeGreaterThan(m.y);
    expect(t.y + t.height).toBeLessThan(m.y + m.height);

    await page.getByRole('button', { name: 'Lasso', exact: true }).click();
    const cx = t.x + t.width / 2;
    const cy = t.y + t.height / 2;
    await zug(page, umkreisen(cx - 50, cy - 10, cx + 50, cy + 10));
    await expect(page.getByTestId('lasso-auswahl')).toBeVisible();
    await zug(page, [
      [cx, cy],
      [cx, cy - 40],
      [cx, cy - 80],
    ]);
    await page.mouse.click(m.x + 20, cy - 110);
    await expect(page.getByTestId('lasso-auswahl')).toHaveCount(0);

    // Genau einmal gespeichert – nicht in der Lücke geblieben und zusätzlich im Teil.
    await expect
      .poll(() =>
        page.evaluate((k) => {
          const alle = JSON.parse(localStorage.getItem(`${k}_text`) ?? '[]') as { text: string }[];
          return alle.filter((x) => x.text === 'Schluss!').length;
        }, SEITE),
      )
      .toBe(1);
    const nachher = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(`${k}_text`)!)[0].fy as number,
      SEITE,
    );
    // 80 px nach oben auf der Rolle = so viele mm weiter oben auf A4.
    expect((vorher - nachher) * 297).toBeCloseTo((80 * 210) / m.width, 0);

    // Rückgängig: wieder an der Stelle, an der die Rolle ihn vorher zeigte – aber nicht verloren.
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect
      .poll(() =>
        page.evaluate((k) => {
          const alle = JSON.parse(localStorage.getItem(`${k}_text`) ?? '[]') as { text: string }[];
          return alle.filter((x) => x.text === 'Schluss!').length;
        }, SEITE),
      )
      .toBe(1);
    await expect(page.getByTestId('scroll-deck').getByText('Schluss!')).toBeVisible();
  });

  test('unter das Lied geschoben: Hinweis statt Verlust – Rückgängig lässt den Strich, wo er war', async ({
    page,
  }) => {
    await vorbereiten(page, 'scrollen');
    await oeffneWerkzeug(page, 'Anmerken');
    const malen = page.getByTestId('rollen-malen');
    await expect(malen).toBeVisible({ timeout: 30_000 });
    const b = (await malen.boundingBox())!;
    const a4 = (x: number, yy: number) =>
      [(x - b.x) / b.width, ((yy - b.y) * 210) / b.width / 297] as const;
    const y = b.y + 110;
    await zug(page, [
      [b.x + 80, y],
      [b.x + 180, y],
    ]);
    await expect
      .poll(() => strichBei(page, ...a4(b.x + 130, y)), { timeout: 5_000 })
      .toBeGreaterThan(100);

    await page.getByRole('button', { name: 'Lasso', exact: true }).click();
    await zug(page, umkreisen(b.x + 60, y - 15, b.x + 200, y + 15));
    await expect(page.getByTestId('lasso-auswahl')).toBeVisible();
    // Bis ans untere Ende der Rolle – unter den letzten Teil.
    const unten = b.y + b.height - 12;
    await zug(page, [
      [b.x + 130, y],
      [b.x + 130, (y + unten) / 2],
      [b.x + 130, unten],
    ]);
    await page.mouse.click(b.x + 30, y + 40);
    await expect(page.getByText('Hier wird nichts gespeichert')).toBeVisible();
    await expect(page.getByTestId('lasso-auswahl')).toBeVisible();

    // Rückgängig legt zwingend ab – zurück an die alte Stelle – und nimmt dann den Lasso-Schritt zurück.
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.getByTestId('lasso-auswahl')).toHaveCount(0);
    await page.waitForTimeout(1_000); // Speichern der Rolle läuft verzögert
    expect(await strichBei(page, ...a4(b.x + 130, y))).toBeGreaterThan(100);
  });

  test('ein Strich aus der Lücke am Seitenende (über dem nächsten Teil) lässt sich greifen', async ({
    page,
  }) => {
    // Langes Lied: Seite 1 endet mit einer Lücke, die Rolle zeigt sie über dem sechsten Teil.
    await page.addInitScript((tour: string) => {
      localStorage.setItem(`worship:onboard-${tour}`, '1');
      localStorage.setItem('worship:liedansicht', 'scrollen');
    }, TOUR_CHART);
    await page.goto('/?demo=chart&lied=lang');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    // Ein roter Strich ganz unten auf A4-Seite 1 (287 mm) – dort steht auf A4 nichts.
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1191;
      c.height = 1684;
      const ctx = c.getContext('2d')!;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 10;
      const mm = c.width / 210;
      ctx.beginPath();
      ctx.moveTo(60 * mm, 287 * mm);
      ctx.lineTo(150 * mm, 287 * mm);
      ctx.stroke();
      localStorage.setItem('worship_docdraw_song999009_a999009_voriginal_0', c.toDataURL());
    });
    await page.reload();
    await expect(page.getByRole('button', { name: /^(Werkzeuge|Anmerken)$/ }).first()).toBeVisible({
      timeout: 30_000,
    });
    await oeffneWerkzeug(page, 'Anmerken');
    await expect(page.getByTestId('rollen-malen')).toBeVisible({ timeout: 30_000 });

    /** Bildschirm-Zeilen, in denen die Anzeige der Rolle bei x = 105 mm Rot zeigt. */
    const rot = () =>
      page.getByTestId('scroll-deck').evaluate((el) => {
        const c = el.querySelector('canvas')!;
        const r = c.getBoundingClientRect();
        const d = c.getContext('2d')!.getImageData(Math.round(c.width / 2), 0, 1, c.height).data;
        const zeilen: number[] = [];
        for (let y = 0; y < c.height; y++) {
          const i = y * 4;
          if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90)
            zeilen.push(r.top + (y * r.height) / c.height);
        }
        return zeilen;
      });
    await expect.poll(async () => (await rot()).length).toBeGreaterThan(0);
    // Hinscrollen: der Strich in die Bildmitte.
    const vorher = await rot();
    await page
      .getByTestId('scroll-deck')
      .evaluate((el, y) => (el.scrollTop += y - window.innerHeight / 2), vorher[0]);
    await expect.poll(async () => Math.round((await rot())[0])).toBeLessThan(260);
    const y = (await rot())[0];
    const b = (await page.getByTestId('rollen-malen').boundingBox())!;
    const xMm = (mm: number) => b.x + (mm * b.width) / 210;

    await page.getByRole('button', { name: 'Lasso', exact: true }).click();
    await zug(page, umkreisen(xMm(50), y - 12, xMm(160), y + 12));
    await expect(page.getByTestId('lasso-auswahl')).toBeVisible();
    await zug(page, [
      [xMm(105), y],
      [xMm(105), y - 15],
      [xMm(105), y - 30],
    ]);
    await page.mouse.click(xMm(20), y + 40);
    await expect(page.getByTestId('lasso-auswahl')).toHaveCount(0);
    await page.getByRole('button', { name: 'Anmerken beenden' }).click();

    // Die Rolle zeigt ihn jetzt 30 px höher – und an der alten Stelle nicht mehr (dort wäre er doppelt,
    // wenn er auf der A4-Seite in der Lücke geblieben wäre).
    await expect
      .poll(async () => {
        const z = await rot();
        return z.length > 0 && z.every((v) => Math.abs(v - (y - 30)) < 8);
      })
      .toBe(true);
  });

  test('unter das Lied geschoben und Stift aus: zurück an die alte Stelle, nicht verloren', async ({
    page,
  }) => {
    await vorbereiten(page, 'scrollen');
    await oeffneWerkzeug(page, 'Anmerken');
    const malen = page.getByTestId('rollen-malen');
    await expect(malen).toBeVisible({ timeout: 30_000 });
    const b = (await malen.boundingBox())!;
    const a4 = (x: number, yy: number) =>
      [(x - b.x) / b.width, ((yy - b.y) * 210) / b.width / 297] as const;
    const y = b.y + 110;
    await zug(page, [
      [b.x + 80, y],
      [b.x + 180, y],
    ]);
    await expect
      .poll(() => strichBei(page, ...a4(b.x + 130, y)), { timeout: 5_000 })
      .toBeGreaterThan(100);
    await page.getByRole('button', { name: 'Lasso', exact: true }).click();
    await zug(page, umkreisen(b.x + 60, y - 15, b.x + 200, y + 15));
    await expect(page.getByTestId('lasso-auswahl')).toBeVisible();
    const unten = b.y + b.height - 12;
    await zug(page, [
      [b.x + 130, y],
      [b.x + 130, (y + unten) / 2],
      [b.x + 130, unten],
    ]);
    // Stift aus, während die Auswahl noch unter dem Lied schwebt.
    await page.getByRole('button', { name: 'Anmerken beenden' }).click();
    await expect(malen).toHaveCount(0);
    await page.waitForTimeout(1_000); // Speichern der Rolle läuft verzögert
    expect(await strichBei(page, ...a4(b.x + 130, y))).toBeGreaterThan(100);
  });

  test('ein Strich unter dem letzten Teil bleibt in seiner Lücke – das Lasso nimmt ihn nicht mit', async ({
    page,
  }) => {
    await vorbereiten(page, 'scrollen');
    const rolle = (await page.getByTestId('scroll-deck').locator('canvas').first().boundingBox())!;
    const hoeheMm = (rolle.height * 210) / rolle.width;
    // Rot, 4 mm über dem Ende der Rolle: auf A4 Leerraum unter dem letzten Teil.
    await page.evaluate((yMm) => {
      const c = document.createElement('canvas');
      c.width = 1191;
      c.height = 1684;
      const ctx = c.getContext('2d')!;
      const mm = c.width / 210;
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(60 * mm, yMm * mm);
      ctx.lineTo(150 * mm, yMm * mm);
      ctx.stroke();
      localStorage.setItem('worship_docdraw_song999001_a999001_voriginal_0', c.toDataURL());
    }, hoeheMm - 4);
    await page.reload();
    await expect(page.getByRole('button', { name: /^(Werkzeuge|Anmerken)$/ }).first()).toBeVisible({
      timeout: 30_000,
    });
    await oeffneWerkzeug(page, 'Anmerken');
    const malen = page.getByTestId('rollen-malen');
    await expect(malen).toBeVisible({ timeout: 30_000 });
    const b = (await malen.boundingBox())!;
    const y = b.y + ((hoeheMm - 4) * b.width) / 210;

    await page.getByRole('button', { name: 'Lasso', exact: true }).click();
    await zug(page, umkreisen(b.x + 80, y - 6, b.x + 310, y + 6));
    await page.waitForTimeout(500); // das Holen läuft asynchron
    // Nichts Greifbares: kein Rahmen. Daneben tippen, Stift aus.
    await expect(page.getByTestId('lasso-auswahl')).toHaveCount(0);
    await page.mouse.click(b.x + 30, b.y + 110);
    await page.getByRole('button', { name: 'Anmerken beenden' }).click();
    await page.waitForTimeout(1_000);
    expect(await strichBei(page, 0.5, (hoeheMm - 4) / 297)).toBeGreaterThan(100);
  });
});
