import { SETTINGS_BASES, SETTINGS_KEY_RE, SETTINGS_SONGID_RE } from '@shared/keys/index';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { leeren, tempVerzeichnis } from '../testHilfen/tempAblage.js';
import { nasEinstellungenAnlegen } from '../testHilfen/altbestand.js';

// Temporären Ablageort setzen, BEVOR das Modul (und damit config.ts) importiert wird.
const dir = tempVerzeichnis('settings-test');
process.env.ANNOTATIONS_PATH = dir;

type Mod = typeof import('./userSettings.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./userSettings.js');
});

beforeEach(async () => {
  await leeren(dir);
});

let nextUser = 5000;
/** Frisches Konto je Test – das Modul cacht pro Konto im Speicher. */
function newUser(): number {
  return ++nextUser;
}

/**
 * #215: Der Filter bekam einen End-Anker. Der Test hält beide Seiten fest – was er ABWEISEN muss
 * (Müll) und was er unbedingt DURCHLASSEN muss (versionsbezogene Schlüssel). Ein zu strenges
 * `_\d+$` hätte Letztere still verworfen: Die Einstellungen wären geräteübergreifend verschwunden,
 * ohne jede Fehlermeldung.
 */
describe('SETTINGS_KEY_RE – was synchronisiert werden darf', () => {
  it('lässt die echten Schlüssel durch', () => {
    for (const k of [
      'worship_key_42',
      'worship_capo_7',
      'worship_cols_1',
      'worship_fs_1',
      'worship_lyrics_1',
      'worship_secshift_1',
      'worship_ver_1',
      'worship_view_1',
      'worship_key_42_original', // pro Version
      'worship_fs_42_akustik-2',
      'worship_cols_42_original_dlarge', // alter Geräte-Zusatz (nur noch lesend)
    ]) {
      expect(mod.SETTINGS_KEY_RE.test(k), k).toBe(true);
    }
  });

  it('weist Müll hinter der Lied-ID ab (das war die Lücke)', () => {
    for (const k of [
      'worship_key_1<Müll>',
      'worship_key_1 ',
      'worship_key_1;rm',
      'worship_key_1/../../etc',
      'worship_key_1_ORIGINAL_dlarge_zuviel',
    ]) {
      expect(mod.SETTINGS_KEY_RE.test(k), k).toBe(false);
    }
  });

  it('weist fremde Namensräume und fehlende Lied-ID ab', () => {
    for (const k of [
      'worship_docdraw_song1_voriginal_0',
      'worship_doczoom_1_0',
      'worship_key_',
      'worship_unbekannt_1',
      'key_1',
    ]) {
      expect(mod.SETTINGS_KEY_RE.test(k), k).toBe(false);
    }
  });
});

/**
 * #273 auch hier – der Zwilling der Anmerkungen hatte denselben Fehler.
 *
 * `read()` fing jeden Lesefehler und legte `{}` als Wahrheit in den Cache. Heute (nur noch Altbestand für
 * den Umzug) hieße das: Der Umzug hielte ein Konto mit unlesbarer Datei für „nichts umzuziehen".
 * Nur `ENOENT` darf „leer" heißen.
 */
describe('Lesefehler zerstört keine Einstellungen (#273)', () => {
  it('beschädigte Datei: getSettings wirft und der Inhalt bleibt erhalten', async () => {
    const user = 6201;
    const file = path.join(dir, `settings-${user}.json`);
    const kaputt = '{"worship_key_1":"D" kein gültiges JSON';
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, kaputt, 'utf-8');
    await expect(mod.getSettings(user, [])).rejects.toMatchObject({ status: 500 });
    expect(await fs.readFile(file, 'utf-8')).toBe(kaputt);
  });

  it('Lesefehler: getSettings wirft, statt „keine Einstellungen" zu behaupten', async () => {
    const user = 6202;
    await fs.mkdir(path.join(dir, `settings-${user}.json`), { recursive: true }); // → EISDIR
    await expect(mod.getSettings(user, [])).rejects.toMatchObject({ status: 500 });
  });

  it('fehlende Datei bleibt der normale Leerfall', async () => {
    await expect(mod.getSettings(6203, [])).resolves.toEqual({});
  });
});

describe('SETTINGS_BASES – eine Liste, kein zweites Vorkommen (#145)', () => {
  it('lässt JEDEN Namen der Liste durch – beide Muster stammen aus derselben Quelle', () => {
    // Der eigentliche Fehler war nicht ein fehlender Name, sondern eine ZWEITE Liste: Beim
    // Hinzufügen der Zählweise wurde keine von beiden nachgezogen, und die Einstellung blieb
    // still auf einem Gerät liegen. Dieser Test läuft über die Liste selbst – ein künftiger Name
    // ist damit automatisch mitgeprüft, statt hier von Hand nachgetragen werden zu müssen.
    for (const base of SETTINGS_BASES) {
      const proLied = `worship_${base}_5`;
      const proVersion = `worship_${base}_5_original`;
      expect(SETTINGS_KEY_RE.test(proLied), proLied).toBe(true);
      expect(SETTINGS_KEY_RE.test(proVersion), proVersion).toBe(true);
      expect(proVersion.match(SETTINGS_SONGID_RE)?.[1], proVersion).toBe('5');
    }
  });

  it('enthält die Zählweise – sie fehlte und wurde deshalb nie synchronisiert', () => {
    expect(SETTINGS_BASES).toContain('zaehl');
  });

  it('lässt Unbekanntes weiter draußen', () => {
    for (const k of ['worship_unsinn_5', 'worship_key_abc', 'worship_5', 'key_5']) {
      expect(SETTINGS_KEY_RE.test(k), k).toBe(false);
    }
  });
});

describe('getSettings – jede erlaubte Einstellung findet ihr Lied wieder (#145)', () => {
  it('gibt zu Lied 5 ALLE Namen der Liste zurück, nicht nur die alten', () => {
    // Das ist der Weg, auf dem sich die Dopplung bemerkbar macht: `getSettings` filtert über
    // `songIdOf`. Erkennt das Muster einen Namen nicht, fällt die Einstellung beim Abrufen STILL
    // heraus – gespeichert ist sie, zurück kommt sie nie. Genau so verschwand die Zählweise.
    //
    // Die Schleife läuft über SETTINGS_BASES: Ein künftiger Name ist damit automatisch mitgeprüft.
    const user = newUser();
    return (async () => {
      const eintraege: Record<string, string> = {};
      for (const base of SETTINGS_BASES) eintraege[`worship_${base}_5_original`] = 'x';
      await nasEinstellungenAnlegen(user, eintraege);

      const zurueck = await mod.getSettings(user, [5]);
      for (const base of SETTINGS_BASES) {
        expect(Object.keys(zurueck), `worship_${base}_5_original fehlt`).toContain(
          `worship_${base}_5_original`,
        );
      }
    })();
  });

  it('lässt die Einstellungen anderer Lieder weiterhin draußen', async () => {
    const user = newUser();
    await nasEinstellungenAnlegen(user, {
      worship_zaehl_5_original: '3',
      worship_zaehl_9_original: '2',
    });
    expect(Object.keys(await mod.getSettings(user, [5]))).toEqual(['worship_zaehl_5_original']);
  });
});
