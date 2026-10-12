import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { leeren, tempVerzeichnis } from '../testHilfen/tempAblage.js';
import { AblageFake, BILD } from '../testHilfen/ablageFake.js';

/**
 * **Umzug der Server-Ablage nach ChurchTools** (09.10.2026) – der Server-Teil: Lesen während des
 * Umzugs, Schreiben auf eine Seite, die erst auf dem Volume liegt, fertig erst nach Prüfung, Abbau nach
 * 90 Tagen, Staging zieht nicht um.
 */
const dir = tempVerzeichnis('ablage-umzug-test');
process.env.ANNOTATIONS_PATH = dir;
process.env.SEEN_SETLISTS_PATH = path.join(dir, 'seen.json');

const fake = vi.hoisted(() => ({ aktuell: null as unknown as AblageFake }));
vi.mock('./ctPersonenAblage.js', async () => {
  const { erstellePersonenAblage } = await import('@shared/ct/personenAblage');
  const ablagen = new Map<number, ReturnType<typeof erstellePersonenAblage>>();
  return {
    ablagePortFuer: (_cookie: string, userId: number) => fake.aktuell.port(userId),
    ablageVon: (userId: number) => {
      if (!ablagen.has(userId)) ablagen.set(userId, erstellePersonenAblage());
      return ablagen.get(userId)!;
    },
    __reset: () => ablagen.clear(),
  };
});
vi.mock('./ctTeilenServer.js', () => ({ teilenSetzen: vi.fn() }));

const { config } = await import('../config.js');
const annotations = await import('./annotations.js');
const userSettings = await import('./userSettings.js');
const umzug = await import('./ablageUmzug.js');
const seen = await import('./seenSetlists.js');
const konto = await import('./kontoAblage.js');
const ctAblage = (await import('./ctPersonenAblage.js')) as unknown as { __reset: () => void };

const ICH = 7;
const COOKIE = 'ct=1';
const NAS_SEITE = 'song1_a1_voriginal_0';
const CT_SEITE = 'song1_a1_voriginal_1';

beforeEach(async () => {
  await leeren(dir);
  fake.aktuell = new AblageFake();
  ctAblage.__reset();
  umzug.__resetUmzugForTests();
  // Die Volume-Ablagen halten einen Zwischenspeicher – leeren, sonst trüge ein Test den Stand des vorigen.
  await annotations.kontoLoeschen(ICH);
  await userSettings.kontoLoeschen(ICH);
  seen.__resetForTests();
  (config as { ablageUmzug: boolean }).ablageUmzug = true;
});

async function fertigUmgezogen(): Promise<void> {
  await umzug.__laufenderUmzug(ICH);
}

describe('Lesen während des Umzugs', () => {
  it('ChurchTools plus die Seiten vom Volume – und danach liegt alles in ChurchTools', async () => {
    await annotations.putAnnotation(ICH, NAS_SEITE, { strokes: BILD });
    await konto.anmerkungSchreiben(COOKIE, ICH, CT_SEITE, { strokes: BILD });

    const gelesen = await konto.anmerkungenHolen(COOKIE, ICH, [1]);
    expect(Object.keys(gelesen).sort()).toEqual([NAS_SEITE, CT_SEITE].sort());

    await fertigUmgezogen();
    expect(fake.aktuell.namen(ICH)).toContain(`musikapp_${NAS_SEITE}.png`);
    expect(await umzug.altFuerLesen(ICH)).toBeNull(); // fertig und geprüft
  });

  it('Einstellungen: ChurchTools gewinnt, das Volume füllt Lücken', async () => {
    await userSettings.putSettings(ICH, {
      worship_key_1_original: 'D',
      worship_capo_1_original: '2',
    });
    await konto.einstellungenSchreiben(COOKIE, ICH, { worship_key_1_original: 'E' });
    expect(await konto.einstellungenHolen(COOKIE, ICH, [1])).toEqual({
      worship_key_1_original: 'E',
      worship_capo_1_original: '2',
    });
    await fertigUmgezogen();
  });
});

describe('fertig heißt geprüft', () => {
  it('fehlt nach dem Hochladen noch etwas, gilt der Umzug NICHT als fertig', async () => {
    await annotations.putAnnotation(ICH, NAS_SEITE, { strokes: BILD });
    const { ablageVon } = await import('./ctPersonenAblage.js');
    // Ein Umzug, der „erledigt" meldet, aber nichts hochgeladen hat – ein Erfolgssignal ist kein Beleg.
    vi.spyOn(ablageVon(ICH), 'uebernimmAltbestand').mockResolvedValue({ bilder: 1, felder: 0 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await konto.anmerkungenHolen(COOKIE, ICH, [1]);
    await fertigUmgezogen();
    expect(await umzug.altFuerLesen(ICH)).not.toBeNull();
    expect(warn.mock.calls.flat().join(' ')).toMatch(/fehlen noch 1 Bilder/);
  });
});

describe('Schreiben auf eine Seite, die erst auf dem Volume liegt', () => {
  it('ein Zoom nimmt Striche und Texte der Seite mit – nichts bleibt auf dem Volume zurück', async () => {
    const text = { id: 1, fx: 0, fy: 0, text: 'NAS', color: '#000', sizeCqh: 2 };
    await annotations.putAnnotation(ICH, NAS_SEITE, { strokes: BILD, texts: [text] });
    await konto.anmerkungSchreiben(COOKIE, ICH, NAS_SEITE, { zoom: { x: 1, y: 1, scale: 2 } });

    const { ablageVon } = await import('./ctPersonenAblage.js');
    const inCt = await ablageVon(ICH).holeAnmerkungen(fake.aktuell.port(ICH), [1]);
    expect(inCt[NAS_SEITE]).toEqual({
      strokes: expect.any(String),
      texts: [text],
      zoom: { x: 1, y: 1, scale: 2 },
    });
  });

  it('ganz gelöscht bleibt gelöscht – weder das Lesen noch der Umzug holt die Seite zurück', async () => {
    await annotations.putAnnotation(ICH, NAS_SEITE, { strokes: BILD });
    await konto.anmerkungSchreiben(COOKIE, ICH, NAS_SEITE, {
      strokes: null,
      texts: [],
      zoom: null,
    });

    expect(await konto.anmerkungenHolen(COOKIE, ICH, [1])).toEqual({});
    await fertigUmgezogen();
    expect(fake.aktuell.namen(ICH)).not.toContain(`musikapp_${NAS_SEITE}.png`);
  });
});

describe('Abbau der alten Ablage nach 90 Tagen', () => {
  it('löscht erst 90 Tage nach dem geprüften Umzug – vorher nicht', async () => {
    await annotations.putAnnotation(ICH, NAS_SEITE, { strokes: BILD });
    await konto.anmerkungenHolen(COOKIE, ICH, [1]);
    await fertigUmgezogen();
    const datei = path.join(dir, `${ICH}.json`);
    expect(existsSync(datei)).toBe(true);

    await umzug.aufraeumen(Date.now() + umzug.NAS_AUFBEWAHRUNG_MS - 60_000);
    expect(existsSync(datei)).toBe(true);
    await umzug.aufraeumen(Date.now() + umzug.NAS_AUFBEWAHRUNG_MS + 60_000);
    expect(existsSync(datei)).toBe(false);
  });

  it('ohne fertigen Umzug wird nie gelöscht', async () => {
    await annotations.putAnnotation(ICH, NAS_SEITE, { strokes: BILD });
    await umzug.aufraeumen(Date.now() + 10 * umzug.NAS_AUFBEWAHRUNG_MS);
    expect(existsSync(path.join(dir, `${ICH}.json`))).toBe(true);
  });
});

describe('Staging zieht nicht um', () => {
  it('ohne Umzug: kein Lesen vom Volume, kein Hochladen', async () => {
    (config as { ablageUmzug: boolean }).ablageUmzug = false;
    await annotations.putAnnotation(ICH, NAS_SEITE, { strokes: BILD });
    expect(await konto.anmerkungenHolen(COOKIE, ICH, [1])).toEqual({});
    expect(umzug.__laufenderUmzug(ICH)).toBeUndefined();
    expect(fake.aktuell.hochgeladen).toEqual([]);
  });

  it('die Regel: Version staging-… → aus, sonst an; ABLAGE_UMZUG übersteuert', async () => {
    const neu = async (env: Record<string, string | undefined>) => {
      vi.resetModules();
      const vorher = { ...process.env };
      Object.assign(process.env, env);
      for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
      const { config: c } = await import('../config.js');
      process.env = vorher;
      return c.ablageUmzug;
    };
    expect(await neu({ APP_VERSION: 'staging-abc1234', ABLAGE_UMZUG: undefined })).toBe(false);
    expect(await neu({ APP_VERSION: 'v2.33.0', ABLAGE_UMZUG: undefined })).toBe(true);
    expect(await neu({ APP_VERSION: 'staging-abc1234', ABLAGE_UMZUG: 'an' })).toBe(true);
  });
});
