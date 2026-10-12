import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { leeren, tempVerzeichnis } from '../testHilfen/tempAblage.js';
import { nasAnmerkungAnlegen } from '../testHilfen/altbestand.js';

// Temporären Ablageort setzen, BEVOR das Modul (und damit config.ts) importiert wird.
const dir = tempVerzeichnis('annotations-test');
process.env.ANNOTATIONS_PATH = dir;

type Mod = typeof import('./annotations.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./annotations.js');
});

beforeEach(async () => {
  await leeren(dir);
});

/**
 * Der **Altbestand** der Anmerkungen auf dem Volume – nur noch gelesen (Umzug nach ChurchTools) und nach
 * dem Umzug gelöscht. Die Schreibfunktionen samt Konto-Obergrenzen (#139) und ihre Tests sind am
 * 12.10.2026 entfallen.
 */
describe('Altbestand lesen', () => {
  it('liefert die Seiten der gefragten Lieder, andere nicht', async () => {
    const user = 5001;
    await nasAnmerkungAnlegen(user, 'song1_vorig_1', { strokes: 'EINS' });
    await nasAnmerkungAnlegen(user, 'song2_vorig_1', { strokes: 'ZWEI' });
    const eins = await mod.getAnnotations(user, [1]);
    expect(Object.keys(eins)).toEqual(['song1_vorig_1']);
    expect(eins['song1_vorig_1'].strokes).toBe('EINS');
  });

  it('kontoLoeschen räumt Datei und Zwischenspeicher', async () => {
    const user = 5002;
    await nasAnmerkungAnlegen(user, 'song1_vorig_1', { strokes: 'EINS' });
    expect(Object.keys(await mod.getAnnotations(user, []))).toHaveLength(1);
    await mod.kontoLoeschen(user);
    expect(await mod.getAnnotations(user, [])).toEqual({});
  });
});

/**
 * #273: Ein Lesefehler darf nicht als „keine Anmerkungen" gelten – sonst zöge der Umzug einen leeren
 * Stand als fertig durch. Nur `ENOENT` heißt „leer".
 *
 * Die Fehler entstehen ohne `chmod`: Ein **Verzeichnis** an der Stelle der Datei liefert verlässlich
 * `EISDIR` (`chmod 000` griffe als root nicht – der Test wäre still wirkungslos). Jedes `it` nutzt ein
 * EIGENES Konto, damit wirklich von der Platte gelesen wird.
 */
describe('Lesefehler (#273)', () => {
  it('Lesefehler: getAnnotations wirft, statt „keine Anmerkungen" zu behaupten', async () => {
    const user = 5102;
    await fs.mkdir(path.join(dir, `${user}.json`), { recursive: true }); // → EISDIR
    await expect(mod.getAnnotations(user, [])).rejects.toMatchObject({ status: 500 });
  });

  it('beschädigte Datei: getAnnotations wirft und der Inhalt bleibt erhalten', async () => {
    const user = 5101;
    const file = path.join(dir, `${user}.json`);
    const kaputt = '{"song1_vorig_1":{"strokes":"WICHTIGE-ANMERKUNG"} dann Müll';
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, kaputt, 'utf-8');
    await expect(mod.getAnnotations(user, [])).rejects.toMatchObject({ status: 500 });
    expect(await fs.readFile(file, 'utf-8')).toBe(kaputt);
  });

  it('fehlende Datei bleibt der normale Leerfall (niemand bekommt einen Fehler)', async () => {
    const user = 5103;
    await expect(mod.getAnnotations(user, [])).resolves.toEqual({});
  });
});
