import { test, expect, type Page } from '@playwright/test';
import { TOUR_CHART } from '../client/src/utils/onboarding';
import { pedalZiel } from '../client/src/utils/pedalSchritt';
import type { PedalRichtung } from '../client/src/utils/pedalTasten';

/**
 * **Scroll-Modus** (#551, Dev-Stammtisch 14.10.2026): Mit „Liedansicht: Scrollen" stehen die Seiten
 * untereinander, jede in voller Breite. Als E2E, weil es um echte Geometrie geht – gerenderte Seiten,
 * CSS, Scrollen – und weil der lokale Browser den Seitenaufbau drosselt, sobald die Vorschau verdeckt ist.
 *
 * Geprüft wird der Weg, den Alwin am Gerät geht: je Lied EINE lange Seite (Rolle, #607), Pedal (↓,
 * Leertaste) scrollt ⅔ Bildschirm, die Kopfzeile folgt dem Lied in der Bildmitte, ein Tipp blendet die
 * Leisten aus, ein Lied-Punkt springt hin. Gemalt wird direkt auf der Rolle (#608).
 */
// Niedriges Fenster: Die Demo-Lieder sind kurz, als Rollen (#607) stünden sie auf einem ganzen iPhone-
// Bildschirm komplett da – und es gäbe nichts zu scrollen.
test.use({ viewport: { width: 390, height: 420 } });

const deck = (page: Page) => page.getByTestId('scroll-deck');

async function scrollTop(page: Page): Promise<number> {
  return deck(page).evaluate((el) => Math.round(el.scrollTop));
}

/** Warten, bis eine (weiche) Scroll-Bewegung zur Ruhe gekommen ist. */
async function ruhig(page: Page): Promise<number> {
  let vorher = -1;
  for (let i = 0; i < 40; i++) {
    const jetzt = await scrollTop(page);
    if (jetzt === vorher) return jetzt;
    vorher = jetzt;
    await page.waitForTimeout(100);
  }
  return vorher;
}

/** Das gewählte Lied in der Ablauf-Leiste der Kopfkarte (Scheibe B2). */
const kopfTitel = (page: Page) =>
  page.getByRole('navigation', { name: 'Lieder im Ablauf' }).locator('[aria-current="true"]');

/** Wo das Pedal anhält – die Ansicht schreibt es bei jedem Tritt an die Scroll-Fläche (#609). */
async function halteStellen(page: Page): Promise<number[]> {
  return deck(page).evaluate((el) =>
    (el.dataset.halte ?? '').split(',').filter(Boolean).map(Number),
  );
}

/**
 * Ein Pedal-Tritt – und die Prüfung, dass er dort landet, wo `pedalZiel` (die Regel der App) es mit den
 * Halte-Stellen der Ansicht sagt; am Ende des Inhalts begrenzt der Browser.
 */
async function tritt(page: Page, taste: string, richtung: PedalRichtung) {
  const vorher = await scrollTop(page);
  const { hoehe, ende } = await deck(page).evaluate((el) => ({
    hoehe: el.clientHeight,
    ende: el.scrollHeight - el.clientHeight,
  }));
  await page.keyboard.press(taste);
  const halte = await halteStellen(page);
  const soll = Math.min(ende, pedalZiel(vorher, hoehe, halte, richtung));
  expect(await ruhig(page)).toBe(soll);
  return { vorher, nachher: soll, halte, hoehe };
}

/** Steht in diesen Zeilen der Scroll-Fläche (linke Hälfte der ersten Rolle) dunkle Schrift? */
async function schriftZwischen(page: Page, y0: number, y1: number): Promise<boolean> {
  return deck(page).evaluate(
    (el, b) => {
      const c = el.querySelector('canvas')!;
      const box = c.parentElement!;
      const s = c.height / box.offsetHeight;
      const oben = Math.round((b.y0 - box.offsetTop) * s);
      const hoch = Math.max(1, Math.round((b.y1 - b.y0) * s));
      const d = c.getContext('2d')!.getImageData(0, oben, Math.round(c.width / 2), hoch).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 200) return true;
      return false;
    },
    { y0, y1 },
  );
}

test('Scrollen: Rollen untereinander, Pedal, Tipp, Lied-Punkt', async ({ page }) => {
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
    localStorage.setItem('worship:liedansicht', 'scrollen');
  }, TOUR_CHART);
  await page.goto('/?demo=chart');

  // Die Seiten stehen untereinander, jede so breit wie der Bildschirm, ohne Lücke.
  await expect(deck(page)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      () =>
        deck(page).evaluate(
          (el) =>
            el.querySelectorAll('canvas').length === 3 && el.scrollHeight > el.clientHeight * 2,
        ),
      {
        timeout: 30_000,
      },
    )
    .toBe(true);
  const seiten = await deck(page).evaluate((el) =>
    [...el.querySelectorAll('canvas')].map((c) => {
      const box = c.parentElement!;
      return { top: box.offsetTop, h: box.offsetHeight, w: box.offsetWidth };
    }),
  );
  // Je Lied EINE Rolle (#607): drei Demo-Lieder, drei Seiten – und keine davon im A4-Format (die
  // Demo-Lieder sind kurz, ihre Rolle ist deutlich niedriger als ein A4-Blatt).
  expect(seiten.length).toBe(3);
  for (const s of seiten) expect(s.h / s.w).toBeLessThan(1.2);
  for (let i = 1; i < seiten.length; i++) {
    // nahtlos (±1 px: offsetTop/offsetHeight runden je für sich)
    expect(Math.abs(seiten[i].top - (seiten[i - 1].top + seiten[i - 1].h))).toBeLessThanOrEqual(1);
    expect(seiten[i].w).toBe(390);
  }
  await expect(kopfTitel(page)).toContainText('Großer Gott');

  // Pedal Teil für Teil (#609): Die Demo-Lieder sind kurz – der nächste Teil-Anfang ist immer schon zu
  // sehen, ein Tritt holt ihn also nach oben (kein ⅔-Schritt).
  const erster = await tritt(page, 'ArrowDown', 1);
  expect(erster.halte).toContain(erster.nachher);
  // Oben steht jetzt die Überschrift des ersten Teils: Darüber etwas Luft – ohne einen Streifen des
  // Titelkopfs an der Kante –, darunter Schrift.
  expect(await schriftZwischen(page, erster.nachher, erster.nachher + 3)).toBe(false);
  expect(await schriftZwischen(page, erster.nachher + 3, erster.nachher + 30)).toBe(true);
  // Weiter (↓ und Leertaste) bis zum nächsten Lied – jeder Tritt nach der Regel; die Kopfzeile folgt.
  let schritte = 0;
  while (!(await kopfTitel(page).textContent())?.includes('Welch ein Freund')) {
    const t = await tritt(page, schritte % 2 ? 'Space' : 'ArrowDown', 1);
    expect(t.nachher).toBeGreaterThan(t.vorher);
    expect(t.nachher - t.vorher).toBeLessThanOrEqual(t.hoehe); // nie mehr als ein Bildschirm
    expect(++schritte).toBeLessThan(12);
  }
  // Zurück: zum Anfang des aktuellen bzw. vorigen Teils.
  await tritt(page, 'ArrowUp', -1);

  // Ein Tipp aufs Blatt blendet die Leisten aus – und wieder ein.
  await deck(page).click({ position: { x: 195, y: 200 } });
  await expect(page.getByRole('navigation', { name: 'Lieder im Ablauf' })).toHaveCount(0);
  await deck(page).click({ position: { x: 195, y: 200 } });
  await expect(kopfTitel(page)).toBeVisible();

  // Ein Lied in der Ablauf-Leiste oben holt das Lied an den Anfang des Bildschirms (seit Scheibe B3 statt der
  // Punktreihe unten); der Pfeil unten scrollt wie das Pedal.
  const lied = (i: number) =>
    page.getByRole('navigation', { name: 'Lieder im Ablauf' }).locator(`[data-lied="${i}"]`);
  // Erst ein anderes Lied (ein Tipp auf das gewählte öffnet sein Lied-Menü statt zu springen), dann zurück zum ersten.
  await lied(2).click();
  await expect(kopfTitel(page)).toContainText('Treu');
  await lied(0).click();
  expect(await ruhig(page)).toBe(0);
  await expect(kopfTitel(page)).toContainText('Großer Gott');
  await page.getByRole('button', { name: 'Weiter / nächste Seite' }).click();
  expect(await ruhig(page)).toBe(pedalZiel(0, erster.hoehe, await halteStellen(page), 1));
});

test.describe('langes Lied, niedriges Fenster', () => {
  // So niedrig, dass ein Teil (neun Zeilen) nicht mehr auf den Bildschirm passt – und so schmal wie ein
  // kleines Handy: Dort war der Abstand über einem Teil kleiner als die Luft (feste 8 px), und oben schaute
  // ein Streifen der Zeile davor herein (Alwin 19.10.2026).
  test.use({ viewport: { width: 320, height: 300 } });

  test('Pedal: lange Teile in ⅔-Schritten, hält am ---- (#609)', async ({ page }) => {
    await page.addInitScript((tour: string) => {
      localStorage.setItem(`worship:onboard-${tour}`, '1');
      localStorage.setItem('worship:liedansicht', 'scrollen');
    }, TOUR_CHART);
    await page.goto('/?demo=chart&lied=lang');
    await expect
      .poll(() => deck(page).evaluate((el) => el.querySelectorAll('canvas').length), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(() => deck(page).evaluate((el) => el.scrollHeight > el.clientHeight * 3))
      .toBe(true);

    const erster = await tritt(page, 'ArrowDown', 1);
    // Ein Lied: Titel, sechs Teile, ein ---- in Vers 3.
    expect(erster.halte).toHaveLength(8);
    const trenner = erster.halte[4];
    // Vers 1 oben – vom Titelkopf darüber kein Streifen an der Kante.
    expect(erster.nachher).toBe(erster.halte[1]);
    expect(await schriftZwischen(page, erster.nachher, erster.nachher + 1)).toBe(false);

    const ziele: number[] = [erster.nachher];
    let zweiDrittel = 0;
    for (let i = 0; i < 40; i++) {
      const t = await tritt(page, 'ArrowDown', 1);
      if (t.nachher === t.vorher) break; // am Ende
      expect(t.nachher - t.vorher).toBeLessThanOrEqual(t.hoehe);
      if (!t.halte.includes(t.nachher)) zweiDrittel++;
      // An einer Halte-Stelle schneidet die Kante keine Zeile an – weder über einem Teil noch am ----.
      else expect(await schriftZwischen(page, t.nachher, t.nachher + 1)).toBe(false);
      ziele.push(t.nachher);
    }
    // Die Teile sind länger als der Bildschirm: Es gab ⅔-Schritte – und trotzdem hielt das Pedal am ----.
    expect(zweiDrittel).toBeGreaterThan(0);
    expect(ziele).toContain(trenner);
  });
});

test.describe('iPad quer', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('eine Seite in voller Breite statt zwei nebeneinander – und nur ein Lied sichtbar', async ({
    page,
  }) => {
    await page.addInitScript((tour: string) => {
      localStorage.setItem(`worship:onboard-${tour}`, '1');
      localStorage.setItem('worship:liedansicht', 'scrollen');
    }, TOUR_CHART);
    await page.goto('/?demo=chart');
    await expect
      .poll(() => deck(page).evaluate((el) => el.querySelectorAll('canvas').length), {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(3);
    const breiten = await deck(page).evaluate((el) =>
      [...el.querySelectorAll('canvas')].map((c) => c.parentElement!.offsetWidth),
    );
    expect(new Set(breiten)).toEqual(new Set([1180]));
    // Beim Blättern wären hier zwei Lieder sichtbar (in der Leiste hinterlegt) – im Scroll-Modus eins.
    await expect(
      page.getByRole('navigation', { name: 'Lieder im Ablauf' }).locator('[class*="liedSichtbar"]'),
    ).toHaveCount(1);

    // Ganz nach unten: Die Kopfzeile zeigt das letzte Lied (die Seite in der Mitte zählt).
    await deck(page).evaluate((el) => (el.scrollTop = el.scrollHeight));
    await expect(kopfTitel(page)).toContainText('Treu');
    // Der Stift ist da (#608) – gemalt wird auf der Rolle, nicht auf einer Einzelseite.
    await page.getByRole('button', { name: 'Anmerken', exact: true }).click();
    await expect(page.getByTestId('rollen-malen')).toBeVisible();
    await expect(page.locator('[class*="_slot_"]')).toHaveCount(0);
  });
});

test('Anmerkungen vom Blättern erscheinen auf der Rolle (#614)', async ({ page }) => {
  // Ein Textfeld auf A4-Seite 1 von „Großer Gott" (Demo-Lied 999001), unten im Refrain.
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
    localStorage.setItem('worship:liedansicht', 'scrollen');
    localStorage.setItem(
      'worship_docdraw_song999001_a999001_voriginal_0_text',
      JSON.stringify([
        { id: 1, fx: 0.7, fy: 0.25, text: 'leise!', color: '#d92d20', sizeCqh: 1.5, bold: true },
      ]),
    );
  }, TOUR_CHART);
  await page.goto('/?demo=chart');
  await expect(deck(page)).toBeVisible({ timeout: 30_000 });
  const text = deck(page).getByText('leise!');
  await expect(text).toBeVisible({ timeout: 30_000 });
  // Er steht auf der Rolle von „Großer Gott" (der ersten), nicht auf einer anderen.
  const rolle1 = deck(page).locator('canvas').first();
  const t = await text.boundingBox();
  const r = await rolle1.boundingBox();
  expect(t && r).toBeTruthy();
  expect(t!.y).toBeGreaterThan(r!.y);
  expect(t!.y + t!.height).toBeLessThan(r!.y + r!.height);
  // Gleich groß wie auf A4 (1,5 % von 297 mm), nicht 1,5 % der viel kürzeren Rolle – sonst hätte die
  // Rolle die Anmerkung als eigene Seite behandelt statt umgerechnet.
  const pxProMm = r!.width / 210;
  const schrift = await text.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(schrift).toBeCloseTo(0.015 * 297 * pxProMm, 0);
});

test('Malen auf der Rolle: ein Strich landet auf der A4-Seite und bleibt sichtbar (#608)', async ({
  page,
}) => {
  await page.addInitScript((tour: string) => {
    localStorage.setItem(`worship:onboard-${tour}`, '1');
    localStorage.setItem('worship:liedansicht', 'scrollen');
  }, TOUR_CHART);
  await page.goto('/?demo=chart');
  await expect
    .poll(() => deck(page).evaluate((el) => el.querySelectorAll('canvas').length), {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(3);

  await page.getByRole('button', { name: 'Anmerken', exact: true }).click();
  const malen = page.getByTestId('rollen-malen');
  await expect(malen).toBeVisible();
  // Der Scroll-Modus bleibt – keine Einzelseite mehr.
  await expect(deck(page)).toBeVisible();

  // Ein waagerechter Strich mitten auf die erste Rolle.
  const box = (await malen.boundingBox())!;
  const y = box.y + Math.min(120, box.height / 2);
  await page.mouse.move(box.x + 60, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, y, { steps: 8 });
  await page.mouse.move(box.x + 260, y, { steps: 8 });
  await page.mouse.up();

  // Gespeichert auf der A4-Seite des Lieds (nicht auf einer Rollen-Ebene).
  await expect
    .poll(
      () =>
        page.evaluate(
          () => localStorage.getItem('worship_docdraw_song999001_a999001_voriginal_0')?.length ?? 0,
        ),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(500);

  // Gespeichert als A4-Seite (Seitenverhältnis 297 : 210) – nicht als Bild der Rolle.
  const verhaeltnis = await page.evaluate(async () => {
    const img = new Image();
    img.src = localStorage.getItem('worship_docdraw_song999001_a999001_voriginal_0')!;
    await img.decode();
    return img.height / img.width;
  });
  expect(verhaeltnis).toBeCloseTo(297 / 210, 2);

  // Stift aus: Die Rolle zeigt den Strich jetzt aus der A4-Seite.
  await page.getByRole('button', { name: 'Anmerken beenden' }).click();
  await expect(malen).toHaveCount(0);
  await expect
    .poll(
      () =>
        deck(page).evaluate(
          (el, p) => {
            const c = el.querySelector('canvas')!;
            const r = c.getBoundingClientRect();
            const sx = c.width / r.width;
            const px = c
              .getContext('2d')!
              .getImageData(
                Math.round((p.x - r.left) * sx),
                Math.round((p.y - r.top) * sx),
                1,
                1,
              ).data;
            return px[0] + px[1] + px[2] < 600; // nicht (fast) weiß
          },
          { x: box.x + 160, y },
        ),
      { timeout: 5_000 },
    )
    .toBe(true);
});

// 22.10.2026: Beim Einschalten des Stifts ging einmal eine leere Textliste hinaus – auf der Rolle löschte das
// die eigenen Texte im Lied von der A4-Seite (auch im Konto). Gefunden beim Bau von #626.
test('Stift an auf der Rolle: eigene Texte im Lied bleiben – auf der A4-Seite und im Bild', async ({
  page,
}) => {
  const SEITE = 'worship_docdraw_song999001_a999001_voriginal_0';
  const text = JSON.stringify([
    { id: 4, fx: 0.5, fy: 0.3, text: 'Bleib da', color: '#d92d20', sizeCqh: 1.2 },
  ]);
  await page.addInitScript(
    ({ tour, seite, text }) => {
      localStorage.setItem(`worship:onboard-${tour}`, '1');
      localStorage.setItem('worship:liedansicht', 'scrollen');
      localStorage.setItem(`${seite}_text`, text);
    },
    { tour: TOUR_CHART, seite: SEITE, text },
  );
  await page.goto('/?demo=chart');
  await expect
    .poll(() => deck(page).evaluate((el) => el.querySelectorAll('canvas').length), {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(3);
  await expect(deck(page).getByText('Bleib da')).toBeVisible();
  await page.getByRole('button', { name: 'Anmerken', exact: true }).click();
  await expect(page.getByTestId('rollen-malen')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000); // Speichern der Rolle läuft verzögert
  expect(await page.evaluate((k) => localStorage.getItem(`${k}_text`), SEITE)).toBe(text);
  await expect(page.getByTestId('rollen-malen').getByText('Bleib da')).toBeVisible();
});

test.describe('mit Touch', () => {
  test.use({ hasTouch: true });

  test('Text auf der Rolle: landet als Textfeld auf der A4-Seite (#608)', async ({ page }) => {
    await page.addInitScript((tour: string) => {
      localStorage.setItem(`worship:onboard-${tour}`, '1');
      localStorage.setItem('worship:liedansicht', 'scrollen');
    }, TOUR_CHART);
    await page.goto('/?demo=chart');
    await expect
      .poll(() => deck(page).evaluate((el) => el.querySelectorAll('canvas').length), {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(3);
    await page.getByRole('button', { name: 'Anmerken', exact: true }).click();
    await page.getByRole('button', { name: 'Text', exact: true }).click();

    const malen = page.getByTestId('rollen-malen');
    const box = (await malen.boundingBox())!;
    // Antippen wie am iPad: Ein Maus-Klick verschöbe den Fokus nach dem Antippen wieder auf die Seite.
    await page.touchscreen.tap(box.x + 200, box.y + 100);
    await page.keyboard.type('leise!');
    // Daneben tippen übernimmt den Text.
    await page.touchscreen.tap(box.x + 80, box.y + 160);
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            localStorage.getItem('worship_docdraw_song999001_a999001_voriginal_0_text'),
          ),
        { timeout: 5_000 },
      )
      .toContain('leise!');
    // Auf der A4-Seite steht er, wo er auf der Rolle stand – in A4-Anteilen (die Rolle ist kürzer).
    const fy = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('worship_docdraw_song999001_a999001_voriginal_0_text')!)[0]
          .fy,
    );
    const mm = ((box.y + 100 - box.y) * 210) / box.width;
    expect(fy).toBeCloseTo(mm / 297, 2);
  });
});
