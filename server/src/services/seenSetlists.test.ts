import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { leeren, tempDatei } from '../testHilfen/tempAblage.js';

// Ablageort VOR dem Modul-Import setzen (config.ts liest beim Import).
const file = tempDatei('seen-setlists-test', 'seen.json');
process.env.SEEN_SETLISTS_PATH = file;

type Mod = typeof import('./seenSetlists.js');
let mod: Mod;

beforeAll(async () => {
  mod = await import('./seenSetlists.js');
});

beforeEach(async () => {
  await leeren(file);
  mod.__resetForTests();
});

const USER = 42;

/** Den Altbestand so anlegen, wie ihn die Server-App vor dem Umzug geschrieben hat. */
async function altbestand(inhalt: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(inhalt), 'utf-8');
}

/**
 * Der **Altbestand** der gesehenen Stände (#143) – nur noch gelesen (Umzug nach ChurchTools) und je
 * Konto vergessen. `markSeenSetlist` und seine Tests sind am 12.10.2026 entfallen.
 */
describe('seenSetlists – Altbestand', () => {
  it('nichts gemerkt → leeres Objekt', async () => {
    expect(await mod.getSeenSetlists(USER)).toEqual({});
  });

  it('liest die Stände je Konto, andere Konten getrennt', async () => {
    await altbestand({ [USER]: { '1001': { hash: 'hashA', seenAt: 1 } }, '99': {} });
    expect((await mod.getSeenSetlists(USER))['1001']?.hash).toBe('hashA');
    expect(await mod.getSeenSetlists(99)).toEqual({});
  });

  it('kontoVergessen nimmt nur dieses Konto heraus', async () => {
    await altbestand({
      [USER]: { '1001': { hash: 'a', seenAt: 1 } },
      '99': { '2002': { hash: 'b', seenAt: 1 } },
    });
    await mod.kontoVergessen(USER);
    mod.__resetForTests(); // von der Platte neu lesen
    expect(await mod.getSeenSetlists(USER)).toEqual({});
    expect((await mod.getSeenSetlists(99))['2002']?.hash).toBe('b');
  });
});

/**
 * **Eine unlesbare Ablage wird nicht überschrieben** (#404). Vorher wurde jeder Lesefehler als „leer"
 * übernommen und beim nächsten Schreiben zurückgeschrieben – die Daten ALLER Konten waren weg.
 * Geprüft mit einer beschädigten Datei statt mit entzogenen Rechten: Das trifft genau den Fall und
 * hängt nicht davon ab, unter welchem Benutzer die Tests laufen (als root griffe `chmod 000` nicht).
 */
describe('Gesehene Abläufe – beschädigte Datei (#404)', () => {
  it('liefert beim Lesen „nichts gemerkt" und Vergessen überschreibt die Datei nicht', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{"kaputt": ', 'utf-8');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await mod.getSeenSetlists(USER)).toEqual({});
    await expect(mod.kontoVergessen(USER)).rejects.toThrow();

    expect(await fs.readFile(file, 'utf-8')).toBe('{"kaputt": ');
    expect(errors).toHaveBeenCalled(); // laut – ein Blick aufs Volume ist nötig
    errors.mockRestore();
  });
});
