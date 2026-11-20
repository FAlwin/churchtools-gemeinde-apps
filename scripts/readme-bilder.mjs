#!/usr/bin/env node
/**
 * **Bilder und Videos fürs README neu aufnehmen** – ein Befehl statt Handarbeit: `npm run readme-bilder`.
 *
 * Startet die Dev-Server der Musik-App und der veröffentlichten Erweiterungen (falls sie nicht schon aus DIESER
 * Arbeitskopie laufen), nimmt deren **Demo-Modi** (`?demo`) mit Playwright auf und baut daraus mit `ffmpeg` die GIFs
 * und Bilder in `docs/bilder/`. Zu sehen sind also nur Beispieldaten, nie echte Personen. Zwischenstände (Rohvideos)
 * landen in `test-results/readme-bilder/` (nicht im Repo).
 *
 * Voraussetzungen: `ffmpeg` (z. B. `brew install ffmpeg`) und der Playwright-Chromium (`npx playwright install
 * chromium`, steht nach einem E2E-Lauf ohnehin bereit).
 *
 * Bewusst so gewählt (README-Umbau, 16.11.2026):
 * - **Nur gemeinfreie Lieder:** Die Liedblatt-Demo blättert nie bis zum dritten Demo-Lied – dessen Text ist geschützt;
 *   aus demselben Grund fehlt die Editor-Demo ganz.
 * - **Kein fremder Dienst im Video:** Der Video-Dienst des Gebetsabends wird nicht geladen, an seiner Stelle steht
 *   eine dunkle Fläche.
 * - **Keine Einführungs-Blasen:** Alle Touren gelten als gesehen.
 *
 * Aufruf:
 * - `npm run readme-bilder` – alles neu aufnehmen; `npm run readme-bilder -- protokolle` nur Aufnahmen **und GIFs**,
 *   deren Name so beginnt – es starten nur die Dev-Server der passenden App, und alle anderen Bilder in `docs/bilder/`
 *   bleiben unangetastet (jede neue Aufnahme wäre ein anderes Binärfile im Verlauf).
 * - `npm run readme-bilder -- --offen` – welche gemergten PRs seit dem letzten Bilder-Stand das Label „README-Bilder“
 *   tragen, also sichtbar etwas geändert haben. **Teil der Release-Routine** (siehe `CLAUDE.md`).
 * - `--standbilder <ziel> [<arbeitskopie>]` und `--vergleichen <alt> <neu>` – für die CI-Erinnerung
 *   (`.github/workflows/readme-bilder.yml`): Standbilder der Demo-Ansichten vor und nach einem PR, bei Unterschied
 *   bekommt der PR das Label. Standbilder sind auf DEMSELBEN Rechner Byte für Byte gleich, solange sich die Ansicht
 *   nicht ändert (Uhr fest auf {@link FESTE_ZEIT}); zwischen Rechnern nicht (Schriften) – deshalb entstehen beide
 *   Seiten im selben CI-Lauf.
 */
import { spawn, execFileSync } from 'node:child_process';
import {
  mkdirSync,
  renameSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  appendFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ERWEITERUNGEN } from '../e2e/erweiterungen.ts';
import { pruefeFremdeServer, belegtAuf } from './fremde-server.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROH = join(WURZEL, 'test-results', 'readme-bilder');
const ZIEL = join(WURZEL, 'docs', 'bilder');
const ARGS = process.argv.slice(2);
const MODUS = ARGS[0]?.startsWith('--') ? ARGS[0] : '--aufnehmen';
const NUR = MODUS === '--aufnehmen' ? (ARGS[0] ?? '') : '';
/** Label, das die CI-Erinnerung an PRs hängt, die sichtbar etwas ändern. */
const LABEL = 'README-Bilder';
/** Feste Uhrzeit für Standbilder – sonst ändern „in 4 Tagen“ oder „läuft seit 10:42“ das Bild von selbst. */
const FESTE_ZEIT = new Date('2026-11-16T09:00:00');

const QUER = { width: 840, height: 560 };
const HOCH = { width: 640, height: 900 };
const IPAD = { width: 1180, height: 820 };
const HANDY = { width: 390, height: 844 };
const FPS = 12;

// ---------- Dev-Server ----------

const MUSIK = { port: 5173, befehl: ['run', 'dev:client'], pfad: '/' };
/** @param {'dienstplaner' | 'organigramm' | 'protokolle' | 'gebetsabend'} app */
function erweiterung(app) {
  const port = /** @type {number} */ (ERWEITERUNGEN.find((e) => e.app === app)?.port);
  return {
    port,
    befehl: ['run', 'dev', `--workspace=${app}`, '--', '--port', String(port), '--strictPort'],
    pfad: `/ccm/${app}/`,
  };
}
const SERVER = {
  musik: MUSIK,
  dienstplaner: erweiterung('dienstplaner'),
  organigramm: erweiterung('organigramm'),
  protokolle: erweiterung('protokolle'),
  gebetsabend: erweiterung('gebetsabend'),
};

/** @type {import('node:child_process').ChildProcess[]} */
const gestartet = [];

/** @param {string} url */
async function antwortet(url) {
  try {
    const r = await fetch(url);
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * @param {{ port: number; befehl: string[]; pfad: string }} s
 * @param {string} wurzel Arbeitskopie, aus der der Server läuft
 */
async function sicherstellen(s, wurzel) {
  const url = `http://localhost:${s.port}${s.pfad}`;
  if (await antwortet(url)) return;
  const kind = spawn('npm', s.befehl, { cwd: wurzel, stdio: 'ignore', detached: true });
  gestartet.push(kind);
  for (let i = 0; i < 240; i++) {
    if (await antwortet(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev-Server auf Port ${s.port} antwortet nicht (npm ${s.befehl.join(' ')}).`);
}

function aufraeumen() {
  for (const kind of gestartet.splice(0)) {
    try {
      // `detached` → eigene Prozessgruppe; so endet auch der Vite-Prozess hinter `npm`.
      if (kind.pid) process.kill(-kind.pid, 'SIGTERM');
    } catch {
      // schon beendet
    }
  }
}

/** @param {keyof typeof SERVER} app @param {string} [demo] */
function demoUrl(app, demo = '') {
  return `http://localhost:${SERVER[app].port}${SERVER[app].pfad}?demo${demo ? `=${demo}` : ''}`;
}

// ---------- Aufnahmen ----------

/** @type {Record<string, { start: number }>} */
const starts = existsSync(join(ROH, 'aufnahmen.json'))
  ? /** @type {Record<string, { start: number }>} */ (
      JSON.parse(readFileSync(join(ROH, 'aufnahmen.json'), 'utf8'))
    )
  : {};

/** @param {import('@playwright/test').Page} page */
async function vorbereiten(page) {
  // Als Text, weil es im Browser läuft (dort gibt es `Storage`, hier in Node nicht).
  await page.addInitScript({
    content: `{ const orig = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k) { return /onboard|tour/i.test(k) ? '1' : orig.call(this, k); }; }`,
  });
  await page.route(/vdo\.ninja/, (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<body style="margin:0;background:#1f2937"></body>',
    }),
  );
}

/** @param {import('@playwright/test').Page} page */
async function fertig(page) {
  await page.waitForLoadState('networkidle');
  await page
    .getByText('Lieder werden vorbereitet')
    .waitFor({ state: 'detached', timeout: 30_000 })
    .catch(() => undefined);
  await page.waitForTimeout(300);
}

/**
 * @typedef {(page: import('@playwright/test').Page, pause: (ms: number) => Promise<void>,
 *   knopf: (name: string) => import('@playwright/test').Locator) => Promise<void>} Ablauf
 */

/**
 * Nimmt einen Ablauf als Video auf und merkt sich, ab welcher Sekunde die Seite fertig geladen war.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string} name
 * @param {{ width: number; height: number }} groesse
 * @param {string} url
 * @param {Ablauf} ablauf
 */
async function video(browser, name, groesse, url, ablauf) {
  if (!name.startsWith(NUR)) return;
  const t0 = Date.now();
  const ctx = await browser.newContext({
    viewport: groesse,
    locale: 'de-DE',
    recordVideo: { dir: ROH, size: groesse },
  });
  const page = await ctx.newPage();
  await vorbereiten(page);
  await page.goto(url);
  await fertig(page);
  const start = (Date.now() - t0) / 1000;
  await ablauf(
    page,
    (ms) => page.waitForTimeout(ms),
    (n) => page.getByRole('button', { name: n, exact: true }).first(),
  );
  const v = page.video();
  await ctx.close();
  if (v) renameSync(await v.path(), join(ROH, `${name}.webm`));
  starts[name] = { start };
  writeFileSync(join(ROH, 'aufnahmen.json'), JSON.stringify(starts, null, 2));
  console.log(`  Video ${name}`);
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {string} name
 * @param {{ width: number; height: number }} groesse
 * @param {string} url
 */
async function bild(browser, name, groesse, url) {
  if (!name.startsWith(NUR)) return;
  const ctx = await browser.newContext({
    viewport: groesse,
    deviceScaleFactor: 2,
    locale: 'de-DE',
  });
  const page = await ctx.newPage();
  await vorbereiten(page);
  await page.goto(url);
  await fertig(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(ZIEL, `${name}.png`) });
  await ctx.close();
  console.log(`  Bild ${name}`);
}

/**
 * Liedblatt-Demo: Liedmenü → Transponieren nach A, dann „Nur Text“ und zurück.
 *
 * @param {import('@playwright/test').Page} page
 * @param {(ms: number) => Promise<void>} p
 */
async function liedblatt(page, p) {
  const menue = () => page.getByText('Akustik').first().click();
  const zu = async () => {
    const x = page.getByRole('dialog').getByRole('button', { name: /schlie/i });
    if (await x.count()) await x.first().click();
  };
  await p(1400);
  await menue();
  await p(1100);
  await page.getByText('Transponieren').click();
  await p(1100);
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await p(500);
  await zu();
  await p(2200);
  await menue();
  await p(900);
  await page.getByText('Nur Text', { exact: true }).click();
  await p(500);
  await zu();
  await p(2000);
  await menue();
  await p(800);
  await page.getByText('Akkorde & Text', { exact: true }).click();
  await p(500);
  await zu();
  await p(1800);
}

/** @param {import('@playwright/test').Browser} browser */
async function aufnehmen(browser) {
  const url = demoUrl;

  await bild(browser, 'musik-liedblatt', IPAD, url('musik', 'chart'));
  await bild(browser, 'musik-handy', HANDY, url('musik', 'chart'));
  await video(browser, 'musik', HOCH, url('musik', 'chart'), (page, p) => liedblatt(page, p));

  await video(browser, 'dienstplaner', QUER, url('dienstplaner'), async (page, p, knopf) => {
    await p(1800);
    await knopf('Zusagen').click();
    await p(1600);
    await knopf('Dienste').click();
    await p(2000);
    // Seit E5c-1c (#1031) heißt der Reiter „Wann kann ich?“ und hat je Termin Ja · Vielleicht · Nein statt des Hakens.
    await knopf('Wann kann ich?').click();
    await p(1200);
    await page
      .getByRole('button', { name: /^Vielleicht – / })
      .nth(2)
      .click();
    await p(1600);
    await knopf('Planen').click();
    await p(2800);
  });

  await video(browser, 'organigramm', QUER, url('organigramm'), async (page, p, knopf) => {
    await p(1600);
    await knopf('Mindmap').click();
    await p(2000);
    await knopf('Karten').click();
    await p(2000);
    await knopf('Präsentieren').click();
    await p(2000);
    await page
      .getByRole('button', { name: /Weiter/ })
      .last()
      .click();
    await p(2000);
    await page.getByRole('dialog').getByRole('button', { name: 'Mindmap', exact: true }).click();
    await p(2200);
  });

  await video(browser, 'protokolle', QUER, url('protokolle'), async (page, p, knopf) => {
    await p(1400);
    await knopf('Sitzungen').click();
    await p(1000);
    // Den Entwurf in „Kommend“ öffnen – nicht das erste „Leitungssitzung“: Das steht seit v1.0.1 im Block „Noch ohne
    // Protokoll“ (vergangen, nur „Protokoll beginnen“) und öffnet nichts.
    await page.getByText('Mi, 21.10.2026 · 19:00 Uhr', { exact: true }).first().click();
    await p(1300);
    // Der Editor mit Tagesordnung, To-Dos und Beschluss.
    await page.mouse.move(420, 380);
    await page.mouse.wheel(0, 520);
    await p(1400);
    await page.mouse.wheel(0, 420);
    await p(1500);
    await page.mouse.wheel(0, -2000);
    await p(600);
    await page
      .getByRole('button', { name: /^Teilen/ })
      .first()
      .click();
    await p(1800);
    await knopf('Abbrechen').click();
    await p(500);
    // Der Reiter trägt seit v1.1.0 den Zähler im Namen („To-Dos, 4 fällig“).
    await page.getByRole('button', { name: REITER_TODOS }).first().click();
    await p(900);
    await page.getByText('Board', { exact: true }).first().click();
    await p(1800);
  });

  await video(
    browser,
    'gebetsabend-zuhoeren',
    QUER,
    url('gebetsabend', 'zuhoerer'),
    async (_page, p) => {
      await p(2200);
    },
  );
  await video(
    browser,
    'gebetsabend',
    QUER,
    url('gebetsabend', 'technik'),
    async (_page, p, knopf) => {
      await p(1500);
      await knopf('Nur Ton').click();
      await p(900);
      await knopf('Bild + Ton').click();
      await p(700);
      await knopf('Übertragung starten').click();
      await p(2600);
    },
  );
}

// ---------- GIFs ----------

/**
 * Setzt Rohvideos und Standbilder hintereinander und macht daraus eine GIF mit eigener Farbpalette.
 *
 * @param {({ video: string } | { bild: string; sekunden: number })[]} stuecke
 * @param {number} breite
 * @param {number} hoehe
 * @param {string} datei
 * @param {number} [farben]
 */
function gif(stuecke, breite, hoehe, datei, farben = 128) {
  /** @type {string[]} */
  const eingaben = [];
  const filter = stuecke.map((st, i) => {
    if ('video' in st) {
      const start = starts[st.video]?.start;
      if (start === undefined)
        throw new Error(`Rohvideo ${st.video} fehlt – erst ohne Einschränkung aufnehmen.`);
      eingaben.push('-ss', (start + 0.25).toFixed(2), '-i', join(ROH, `${st.video}.webm`));
    } else {
      eingaben.push(
        '-loop',
        '1',
        '-t',
        String(st.sekunden),
        '-framerate',
        String(FPS),
        '-i',
        join(ROH, st.bild),
      );
    }
    return (
      `[${i}:v]fps=${FPS},scale=${breite}:${hoehe}:force_original_aspect_ratio=decrease:flags=lanczos,` +
      `pad=${breite}:${hoehe}:(ow-iw)/2:(oh-ih)/2:color=0xf1f4f9,setsar=1[v${i}]`
    );
  });
  const labels = stuecke.map((_, i) => `[v${i}]`).join('');
  filter.push(`${labels}concat=n=${stuecke.length}:v=1:a=0[cat]`);
  filter.push(
    `[cat]split[a][b];[a]palettegen=max_colors=${farben}:stats_mode=diff[p];` +
      '[b][p]paletteuse=dither=none:diff_mode=rectangle',
  );
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    ...eingaben,
    '-filter_complex',
    filter.join(';'),
    join(ZIEL, datei),
  ]);
  console.log(`  GIF ${datei}`);
}

function gifsBauen() {
  /** Mit Filter (`npm run readme-bilder -- protokolle`) entstehen nur GIFs, deren Name so beginnt. */
  const dran = (/** @type {string} */ datei) => datei.startsWith(NUR);
  /** @type {(...a: Parameters<typeof gif>) => void} */
  const bauen = (stuecke, breite, hoehe, datei, farben) => {
    if (dran(datei)) gif(stuecke, breite, hoehe, datei, farben);
  };
  bauen([{ video: 'musik' }], 560, 788, 'musik-demo.gif', 96);
  bauen([{ video: 'dienstplaner' }], 720, 480, 'dienstplaner-demo.gif');
  bauen([{ video: 'organigramm' }], 720, 480, 'organigramm-demo.gif');
  bauen([{ video: 'protokolle' }], 720, 480, 'protokolle-demo.gif');
  bauen(
    [{ video: 'gebetsabend-zuhoeren' }, { video: 'gebetsabend' }],
    720,
    480,
    'gebetsabend-demo.gif',
  );
}

// ---------- Standbilder für die CI-Erinnerung ----------

/**
 * Die Ansichten, die die README-Videos zeigen – je eine als Standbild. Der Name beginnt mit der App: daran hängt die
 * Meldung, WELCHE App sich sichtbar geändert hat. Eine neue App bekommt hier ihre Ansichten, sobald sie ins README
 * kommt.
 *
 * @type {[name: string, app: keyof typeof SERVER, demo: string, groesse: { width: number; height: number },
 *   schritt?: (page: import('@playwright/test').Page) => Promise<void>][]}
 */
const STANDBILDER = [
  ['musik-liedblatt', 'musik', 'chart', IPAD],
  ['musik-handy', 'musik', 'chart', HANDY],
  ['musik-liedmenue', 'musik', 'chart', QUER, (p) => p.getByText('Akustik').first().click()],
  ['dienstplaner-start', 'dienstplaner', '', QUER],
  ['dienstplaner-dienste', 'dienstplaner', '', QUER, (p) => knopfIn(p, 'Dienste').click()],
  [
    'dienstplaner-abwesenheiten',
    'dienstplaner',
    '',
    QUER,
    (p) => knopfIn(p, 'Wann kann ich?').click(),
  ],
  ['dienstplaner-planen', 'dienstplaner', '', QUER, (p) => knopfIn(p, 'Planen').click()],
  ['organigramm-baum', 'organigramm', '', QUER],
  ['organigramm-mindmap', 'organigramm', '', QUER, (p) => knopfIn(p, 'Mindmap').click()],
  ['organigramm-karten', 'organigramm', '', QUER, (p) => knopfIn(p, 'Karten').click()],
  ['organigramm-praesentation', 'organigramm', '', QUER, (p) => knopfIn(p, 'Präsentieren').click()],
  ['protokolle-start', 'protokolle', '', QUER],
  [
    'protokolle-sitzung',
    'protokolle',
    '',
    QUER,
    async (p) => {
      await knopfIn(p, 'Sitzungen').click();
      await p.getByText('Mi, 21.10.2026 · 19:00 Uhr', { exact: true }).first().click();
    },
  ],
  [
    'protokolle-todos',
    'protokolle',
    '',
    QUER,
    async (p) => {
      await p.getByRole('button', { name: REITER_TODOS }).first().click();
      await p.getByText('Board', { exact: true }).first().click();
    },
  ],
  ['gebetsabend-zuhoeren', 'gebetsabend', 'zuhoerer', QUER],
  ['gebetsabend-technik', 'gebetsabend', 'technik', QUER],
];

/** Reiter „To-Dos“ der Protokolle – mit oder ohne Zähler im Namen („To-Dos, 4 fällig“, seit v1.1.0). */
const REITER_TODOS = /^To-Dos(, \d+ fällig)?$/;

/** @param {import('@playwright/test').Page} page @param {string} name */
function knopfIn(page, name) {
  return page.getByRole('button', { name, exact: true }).first();
}

/**
 * Nimmt alle {@link STANDBILDER} auf. Eine Ansicht, die es (noch) nicht gibt – etwa vor dem PR, der eine App
 * einführt –, fehlt dann einfach; der Vergleich zählt sie als geändert.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string} ziel
 */
async function standbilder(browser, ziel) {
  mkdirSync(ziel, { recursive: true });
  for (const [name, app, demo, groesse, schritt] of STANDBILDER) {
    const ctx = await browser.newContext({ viewport: groesse, locale: 'de-DE' });
    const page = await ctx.newPage();
    try {
      await page.clock.setFixedTime(FESTE_ZEIT);
      await vorbereiten(page);
      await page.goto(demoUrl(app, demo));
      await fertig(page);
      if (schritt) {
        await schritt(page);
        await page.waitForLoadState('networkidle');
      }
      // Als Text: `document` gibt es nur im Browser.
      await page.evaluate('document.fonts.ready.then(() => true)');
      await page.waitForTimeout(800);
      await page.screenshot({
        path: join(ziel, `${name}.png`),
        animations: 'disabled',
        caret: 'hide',
      });
      console.log(`  Standbild ${name}`);
    } catch (e) {
      console.warn(`  Standbild ${name} fehlt: ${/** @type {Error} */ (e).message.split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }
}

/**
 * Wie viele Bildpunkte zweier gleich großer PNGs sichtbar abweichen. Gerechnet im Browser (Canvas), damit es ohne
 * weitere Bibliothek geht. „Sichtbar“ heißt: ein Farbkanal weicht um mehr als {@link TOLERANZ} ab – Kantenglättung
 * schwankt zwischen zwei Läufen um 1 (gemessen 16.11.2026: 4–7 von 470 400 Punkten im Organigramm).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} a
 * @param {string} b
 */
async function abweichendePunkte(page, a, b) {
  const [da, db] = [a, b].map((d) => `data:image/png;base64,${readFileSync(d).toString('base64')}`);
  return page.evaluate(
    `(async () => {
      const lade = (src) => new Promise((ok, fehler) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fehler; i.src = src; });
      const [ia, ib] = await Promise.all([lade(${JSON.stringify(da)}), lade(${JSON.stringify(db)})]);
      if (ia.width !== ib.width || ia.height !== ib.height) return Infinity;
      const pixel = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
      const pa = pixel(ia), pb = pixel(ib);
      let n = 0;
      for (let i = 0; i < pa.length; i += 4)
        if (Math.abs(pa[i] - pb[i]) > ${TOLERANZ} || Math.abs(pa[i + 1] - pb[i + 1]) > ${TOLERANZ} || Math.abs(pa[i + 2] - pb[i + 2]) > ${TOLERANZ}) n++;
      return n;
    })()`,
  );
}

/** Abweichung je Farbkanal, ab der ein Bildpunkt als geändert zählt. */
const TOLERANZ = 16;
/** Ab so vielen geänderten Bildpunkten gilt eine Ansicht als sichtbar geändert (ein Buchstabe sind schon mehr). */
const MINDESTENS = 20;

/**
 * Vergleicht zwei Ordner mit Standbildern und meldet, welche Apps sich sichtbar geändert haben. In der CI gehen die
 * Apps nach `$GITHUB_OUTPUT` (`apps=…`) und eine kleine Tabelle in die Zusammenfassung des Laufs.
 *
 * @param {string} alt
 * @param {string} neu
 */
async function vergleichen(alt, neu) {
  const namen = [
    ...new Set([...readdirSync(alt), ...readdirSync(neu)].filter((n) => n.endsWith('.png'))),
  ].sort();
  const browser = await chromium.launch();
  /** @type {string[]} */
  const geaendert = [];
  try {
    const page = await browser.newPage();
    for (const n of namen) {
      const a = join(alt, n);
      const b = join(neu, n);
      const punkte =
        existsSync(a) && existsSync(b) ? Number(await abweichendePunkte(page, a, b)) : Infinity;
      if (punkte >= MINDESTENS) geaendert.push(n);
      if (punkte > 0) console.log(`  ${n}: ${punkte} Bildpunkte anders`);
    }
  } finally {
    await browser.close();
  }
  const apps = [...new Set(geaendert.map((n) => n.split('-')[0]))];
  console.log(
    apps.length
      ? `Sichtbar geändert: ${apps.join(', ')} (${geaendert.join(', ')})`
      : 'Keine sichtbare Änderung an den README-Ansichten.',
  );
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `apps=${apps.join(',')}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      apps.length
        ? `### README-Bilder\n\nDieser PR ändert sichtbar: **${apps.join(', ')}** – beim nächsten Release ` +
            `\`npm run readme-bilder\` laufen lassen.\n\n| Ansicht |\n| --- |\n${geaendert.map((n) => `| ${n} |`).join('\n')}\n`
        : '### README-Bilder\n\nKeine sichtbare Änderung an den Ansichten im README.\n',
    );
  }
}

/** Gemergte PRs mit dem Label seit dem letzten Commit, der `docs/bilder/` geändert hat. */
function offen() {
  const seit = execFileSync('git', ['log', '-1', '--format=%cI', '--', 'docs/bilder'], {
    cwd: WURZEL,
    encoding: 'utf8',
  }).trim();
  const roh = execFileSync(
    'gh',
    [
      'pr',
      'list',
      '--state',
      'merged',
      '--label',
      LABEL,
      '--search',
      `merged:>${seit}`,
      '--json',
      'number,title,mergedAt',
    ],
    { cwd: WURZEL, encoding: 'utf8' },
  );
  const prs = /** @type {{ number: number; title: string; mergedAt: string }[]} */ (
    JSON.parse(roh)
  );
  console.log(`Letzter Bilder-Stand: ${seit.slice(0, 10)}`);
  if (!prs.length) {
    console.log(
      'Seitdem hat kein gemergter PR sichtbar etwas geändert – die README-Bilder sind aktuell.',
    );
    return;
  }
  console.log(`Seitdem ${prs.length} PR(s) mit sichtbarer Änderung – README-Bilder neu aufnehmen:`);
  for (const pr of prs) console.log(`  #${pr.number} ${pr.title} (${pr.mergedAt.slice(0, 10)})`);
}

// ---------- Ablauf ----------

/** Startet (falls nötig) die Dev-Server aus `wurzel`, führt `arbeit` aus und räumt danach auf. */
async function mitServern(
  /** @type {string} */ wurzel,
  /** @type {(b: import('@playwright/test').Browser) => Promise<void>} */ arbeit,
  /** @type {string} */ nur = '',
) {
  // Mit Filter nur die Server der passenden Apps – `gebetsabend-zuhoeren` gehört zu `gebetsabend`.
  const noetig = Object.entries(SERVER).filter(
    ([app]) => app.startsWith(nur) || nur.startsWith(app),
  );
  const ports = Object.values(SERVER).map((s) => s.port);
  // Ein Server aus einer ANDEREN Arbeitskopie würde still deren Stand aufnehmen – dann lieber abbrechen.
  pruefeFremdeServer(ports, wurzel);
  const vorher = (belegtAuf(ports) ?? []).length;
  const browser = await chromium.launch();
  try {
    console.log(
      vorher
        ? 'Dev-Server: laufen teils schon, Rest wird gestartet …'
        : 'Dev-Server werden gestartet …',
    );
    await Promise.all(noetig.map(([, s]) => sicherstellen(s, wurzel)));
    await arbeit(browser);
  } finally {
    await browser.close();
    aufraeumen();
    // Erst weiter, wenn die Ports frei sind: Sonst fände ein zweiter Lauf (CI: Stand vor dem PR) noch den alten Server
    // und nähme still denselben Stand zweimal auf.
    for (let i = 0; i < 40 && (belegtAuf(ports) ?? []).length; i++)
      await new Promise((r) => setTimeout(r, 250));
  }
}

if (MODUS === '--offen') {
  offen();
} else if (MODUS === '--vergleichen') {
  await vergleichen(resolve(ARGS[1] ?? ''), resolve(ARGS[2] ?? ''));
} else if (MODUS === '--standbilder') {
  const ziel = resolve(ARGS[1] ?? join(ROH, 'standbilder'));
  await mitServern(resolve(ARGS[2] ?? WURZEL), (b) => standbilder(b, ziel));
} else if (MODUS === '--aufnehmen') {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch {
    console.error('ffmpeg fehlt – bitte installieren (z. B. `brew install ffmpeg`).');
    process.exit(1);
  }
  mkdirSync(ROH, { recursive: true });
  mkdirSync(ZIEL, { recursive: true });
  await mitServern(
    WURZEL,
    async (browser) => {
      console.log('Aufnahmen:');
      await aufnehmen(browser);
    },
    NUR,
  );
  console.log('GIFs:');
  gifsBauen();
  console.log(`Fertig – Ergebnis in docs/bilder/. Vor dem Commit ansehen.`);
} else {
  console.error(`Unbekannte Option ${MODUS} – siehe Kopf von scripts/readme-bilder.mjs.`);
  process.exit(1);
}
