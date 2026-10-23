import { describe, expect, it } from 'vitest';
import type { CtSong } from './typen';
import type { CtVerwalter } from './liedVerwaltung';
import { liedinfoBeimImport } from './liedinfoImport';

/**
 * SongSelect-Import (Lied-Editor L4-4, 23.10.2026): leere ChurchTools-Felder aus den Kopfzeilen füllen, nie
 * überschreiben; danach frisch lesen und nur die Zeilen entfernen, deren Feld ChurchTools DANN hat.
 */
const SONGSELECT = `{title: Treu}
{artist: Tobias Gerster}
{key: D}
{tempo: 72}
{time: 4/4}
{ccli: 4328979}
{copyright: 2019 Gerster Music}
[D]Text`;

/** Eine kleine ChurchTools-Attrappe, die Schreibzugriffe wirklich übernimmt (oder eben nicht). */
function attrappe(
  lied: Partial<CtSong>,
  opts: { ablehnen?: boolean; uebernimmtNicht?: boolean } = {},
) {
  const song: CtSong = {
    id: 7,
    name: 'Treu',
    author: null,
    ccli: null,
    copyright: null,
    category: { id: 1, name: 'Lobpreis' },
    arrangements: [
      {
        id: 70,
        name: 'Standard',
        key: 'D',
        keyOfArrangement: 'D',
        bpm: null,
        beat: null,
        files: [],
      },
    ],
    ...lied,
  };
  const geschrieben: { pfad: string; json: Record<string, unknown> }[] = [];
  const s = {
    song: () => Promise.resolve(structuredClone(song)),
    fehler: (st: number, m: string) => Object.assign(new Error(m), { status: st }),
    bearbeitbareKategorien: () => Promise.resolve([{ id: 1, name: 'Lobpreis' }]),
    alleLieder: () => Promise.resolve([]),
    schreibe: (pfad: string, a: { json: Record<string, unknown> }) => {
      if (opts.ablehnen)
        return Promise.reject(Object.assign(new Error('Keine Berechtigung'), { status: 403 }));
      geschrieben.push({ pfad, json: a.json });
      if (opts.uebernimmtNicht) return Promise.resolve(null);
      if (pfad === '/songs/7')
        Object.assign(song, {
          author: a.json.author ?? null,
          ccli: a.json.ccli ?? null,
          copyright: a.json.copyright ?? null,
        });
      if (pfad === '/songs/7/arrangements/70') {
        const arr = song.arrangements[0];
        arr.bpm = (a.json.tempo as number | undefined) ?? null;
        arr.tempo = (a.json.tempo as number | undefined) ?? null;
        arr.beat = (a.json.beat as string | undefined) ?? null;
      }
      return Promise.resolve(null);
    },
  } as unknown as CtVerwalter;
  return { s, geschrieben, song };
}

describe('liedinfoBeimImport', () => {
  it('füllt leere Felder, liest frisch nach und entfernt dann die Zeilen – {key} bleibt', async () => {
    const { s, geschrieben, song } = attrappe({});
    const text = await liedinfoBeimImport(s, 7, 70, SONGSELECT);
    expect(geschrieben.map((g) => g.pfad)).toEqual(['/songs/7', '/songs/7/arrangements/70']);
    expect(song).toMatchObject({
      author: 'Tobias Gerster',
      ccli: '4328979',
      copyright: '2019 Gerster Music',
    });
    expect(song.arrangements[0]).toMatchObject({ tempo: 72, beat: '4/4' });
    expect(text).toBe('{key: D}\n[D]Text');
  });

  it('überschreibt nie, was ChurchTools schon hat – die Zeile geht trotzdem (ChurchTools gilt)', async () => {
    const { s, geschrieben, song } = attrappe({
      author: 'T. Gerster',
      ccli: '4328979',
      copyright: 'x',
    });
    const text = await liedinfoBeimImport(s, 7, 70, SONGSELECT);
    expect(song.author).toBe('T. Gerster');
    expect(geschrieben.map((g) => g.pfad)).toEqual(['/songs/7/arrangements/70']);
    expect(text).toBe('{key: D}\n[D]Text');
  });

  it('meldet ChurchTools nach dem Speichern ein Feld weiter leer, bleibt seine Zeile', async () => {
    const { s } = attrappe({}, { uebernimmtNicht: true });
    const text = await liedinfoBeimImport(s, 7, 70, SONGSELECT);
    expect(text).toBe(SONGSELECT.replace('{title: Treu}\n', ''));
  });

  it('verweigert ChurchTools das Schreiben: Text unverändert – das Notenblatt kommt trotzdem an', async () => {
    const { s } = attrappe({}, { ablehnen: true });
    expect(await liedinfoBeimImport(s, 7, 70, SONGSELECT)).toBe(SONGSELECT);
  });
});
