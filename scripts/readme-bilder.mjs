#!/usr/bin/env node
/**
 * **Bilder und Videos fürs README neu aufnehmen** – ein Befehl statt Handarbeit: `npm run readme-bilder`.
 *
 * Startet die Dev-Server der Musik-App und der veröffentlichten Erweiterungen (falls sie nicht schon aus DIESER
 * Arbeitskopie laufen), nimmt deren **Demo-Modi** (`?demo`) mit Playwright auf und baut daraus mit `ffmpeg` die GIFs
 * und Bilder in `docs/bilder/`. Zu sehen sind also nur Beispieldaten, nie echte Personen. Zwischenstände (Rohvideos,
 * Namensschilder) landen in `test-results/readme-bilder/` (nicht im Repo).
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
 * Aufruf: `npm run readme-bilder` (alles) oder `npm run readme-bilder -- dienstplaner` (nur Aufnahmen, deren Name so
 * beginnt; die GIFs werden danach aus allen vorhandenen Rohvideos neu gebaut).
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { ERWEITERUNGEN } from '../e2e/erweiterungen.ts';
import { pruefeFremdeServer, belegtAuf } from './fremde-server.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROH = join(WURZEL, 'test-results', 'readme-bilder');
const ZIEL = join(WURZEL, 'docs', 'bilder');
const NUR = process.argv[2] ?? '';

const QUER = { width: 840, height: 560 };
const HOCH = { width: 640, height: 900 };
const IPAD = { width: 1180, height: 820 };
const HANDY = { width: 390, height: 844 };
const FPS = 12;

// ---------- Dev-Server ----------

const MUSIK = { port: 5173, befehl: ['run', 'dev:client'], pfad: '/' };
/** @param {'dienstplaner' | 'organigramm' | 'gebetsabend'} app */
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

/** @param {{ port: number; befehl: string[]; pfad: string }} s */
async function sicherstellen(s) {
  const url = `http://localhost:${s.port}${s.pfad}`;
  if (await antwortet(url)) return;
  const kind = spawn('npm', s.befehl, { cwd: WURZEL, stdio: 'ignore', detached: true });
  gestartet.push(kind);
  for (let i = 0; i < 240; i++) {
    if (await antwortet(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev-Server auf Port ${s.port} antwortet nicht (npm ${s.befehl.join(' ')}).`);
}

function aufraeumen() {
  for (const kind of gestartet) {
    try {
      // `detached` → eigene Prozessgruppe; so endet auch der Vite-Prozess hinter `npm`.
      if (kind.pid) process.kill(-kind.pid, 'SIGTERM');
    } catch {
      // schon beendet
    }
  }
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
 * Liedblatt-Demo: Liedmenü → Transponieren nach A; lang zusätzlich „Nur Text“ und zurück.
 *
 * @param {import('@playwright/test').Page} page
 * @param {(ms: number) => Promise<void>} p
 * @param {boolean} lang
 */
async function liedblatt(page, p, lang) {
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
  if (!lang) return;
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
  const url = (/** @type {keyof typeof SERVER} */ app, demo = '') =>
    `http://localhost:${SERVER[app].port}${SERVER[app].pfad}?demo${demo ? `=${demo}` : ''}`;

  await bild(browser, 'musik-liedblatt', IPAD, url('musik', 'chart'));
  await bild(browser, 'musik-handy', HANDY, url('musik', 'chart'));
  await video(browser, 'musik', HOCH, url('musik', 'chart'), (page, p) => liedblatt(page, p, true));
  await video(browser, 'musik-kurz', QUER, url('musik', 'chart'), (page, p) =>
    liedblatt(page, p, false),
  );

  await video(browser, 'dienstplaner', QUER, url('dienstplaner'), async (page, p, knopf) => {
    await p(1800);
    await knopf('Zusagen').click();
    await p(1600);
    await knopf('Dienste').click();
    await p(2000);
    await knopf('Abwesenheiten').click();
    await p(1200);
    await page.getByText('Abwesend', { exact: true }).nth(1).click();
    await p(1600);
    await knopf('Planen').click();
    await p(2800);
  });
  await video(browser, 'dienstplaner-kurz', QUER, url('dienstplaner'), async (page, p, knopf) => {
    await p(1600);
    await knopf('Zusagen').click();
    await p(1300);
    await knopf('Planen').click();
    await p(2200);
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
  await video(browser, 'organigramm-kurz', QUER, url('organigramm'), async (_page, p, knopf) => {
    await p(1300);
    await knopf('Mindmap').click();
    await p(1600);
    await knopf('Karten').click();
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

// ---------- Namensschilder für den Rundgang ----------

const KARTEN = [
  ['titel', 'Gemeinde-Apps für ChurchTools', 'Vier Apps, direkt mit eurem ChurchTools verbunden'],
  ['musik', 'Musik-App', 'Chord Charts der Setlist – automatisch in der richtigen Tonart'],
  ['dienstplaner', 'Dienstplaner', 'Dienste planen, zusagen und tauschen – für alle Gruppen'],
  ['organigramm', 'Organigramm', 'Bereiche, Gruppen und Leitung auf einen Blick'],
  ['gebetsabend', 'Gebetsabend', 'Übertragung des Gebetsabends nur für Mitglieder'],
];

/** @param {import('@playwright/test').Browser} browser */
async function namensschilder(browser) {
  const icon = readFileSync(join(WURZEL, 'client', 'public', 'icon-192.png')).toString('base64');
  const page = await browser.newPage({ viewport: QUER });
  for (const [name, titel, zeile] of KARTEN) {
    const istTitel = name === 'titel';
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>
      body{margin:0;height:${QUER.height}px;display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:#f1f4f9;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;color:#1e293b;text-align:center}
      img{width:84px;height:84px;margin-bottom:22px}
      h1{font-size:${istTitel ? 40 : 52}px;margin:0 0 14px;font-weight:700;letter-spacing:-.5px}
      p{font-size:22px;margin:0;color:#475569;max-width:640px;line-height:1.35}
      .strich{width:64px;height:5px;border-radius:3px;background:#2563eb;margin:0 0 22px}
    </style>${istTitel ? `<img src="data:image/png;base64,${icon}">` : '<div class="strich"></div>'}<h1>${titel}</h1><p>${zeile}</p>`);
    await page.screenshot({ path: join(ROH, `karte-${name}.png`) });
  }
  await page.close();
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
  gif([{ video: 'musik' }], 560, 788, 'musik-demo.gif', 96);
  gif([{ video: 'dienstplaner' }], 720, 480, 'dienstplaner-demo.gif');
  gif([{ video: 'organigramm' }], 720, 480, 'organigramm-demo.gif');
  gif(
    [{ video: 'gebetsabend-zuhoeren' }, { video: 'gebetsabend' }],
    720,
    480,
    'gebetsabend-demo.gif',
  );
  gif(
    [
      { bild: 'karte-titel.png', sekunden: 2 },
      { bild: 'karte-musik.png', sekunden: 1.4 },
      { video: 'musik-kurz' },
      { bild: 'karte-dienstplaner.png', sekunden: 1.4 },
      { video: 'dienstplaner-kurz' },
      { bild: 'karte-organigramm.png', sekunden: 1.4 },
      { video: 'organigramm-kurz' },
      { bild: 'karte-gebetsabend.png', sekunden: 1.4 },
      { video: 'gebetsabend' },
    ],
    720,
    480,
    'apps-uebersicht.gif',
  );
}

// ---------- Ablauf ----------

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('ffmpeg fehlt – bitte installieren (z. B. `brew install ffmpeg`).');
  process.exit(1);
}
mkdirSync(ROH, { recursive: true });
mkdirSync(ZIEL, { recursive: true });

const ports = Object.values(SERVER).map((s) => s.port);
// Ein Server aus einer ANDEREN Arbeitskopie würde still deren Stand aufnehmen – dann lieber abbrechen.
pruefeFremdeServer(ports, WURZEL);
const vorher = (belegtAuf(ports) ?? []).length;

const browser = await chromium.launch();
try {
  console.log(
    vorher
      ? 'Dev-Server: laufen teils schon, Rest wird gestartet …'
      : 'Dev-Server werden gestartet …',
  );
  await Promise.all(Object.values(SERVER).map(sicherstellen));
  console.log('Aufnahmen:');
  await aufnehmen(browser);
  await namensschilder(browser);
  console.log('GIFs:');
  gifsBauen();
  console.log(`Fertig – Ergebnis in docs/bilder/. Vor dem Commit ansehen.`);
} finally {
  await browser.close();
  aufraeumen();
}
