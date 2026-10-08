import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf, KeinSpeicherRecht } from './ctRuntime';
import { lied, liedtext, suchen } from './ctSongSelect';
import { notenblattAusCcli } from './ctSchreiben';
import { FakeCt } from './ctFake.testutil';

/**
 * CCLI SongSelect in der Erweiterung (#335, 3b-5). Die Regeln (Lizenzfilter, keine Interna, Tonart,
 * „erst holen, dann ersetzen") prüfen die Server-Tests – sie laufen seit dem Umzug durch dieselben
 * Funktionen in `@shared/ct/songselect`. Hier geht es um den Weg des Browsers: alte Schnittstelle mit
 * CSRF und `X-Requested-With`, die doppelt verpackte Antwort, das Schreiben in ChurchTools.
 */
let ct: FakeCt;
const AJAX = 'POST /index.php?q=churchservice/ajax';

/** Die doppelte Verpackung (gemessen): außen ChurchTools, innen als Zeichenkette die Antwort von CCLI. */
function ccli(innen: unknown): () => Response {
  return () =>
    new Response(JSON.stringify({ status: 'success', data: JSON.stringify(innen) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
}

const TREFFER = {
  title: 'Wo ich auch stehe',
  songNumber: 4330228,
  defaultKey: ['C'],
  authors: ['Albert Frey'],
  copyrights: ['2002 Immanuel Lobpreisverlag'],
  isPublicDomain: false,
  ccliAccountNumber: 999,
  content: {
    lyrics: { exists: true, isAuthorized: true },
    chordPro: { exists: true, isAuthorized: false },
  },
};

const ORIGINAL = {
  name: 'Treu.chordpro',
  fileUrl: 'https://ct.test/?q=public/filedownload&id=900',
};

function liedMitTonart(key: string | null) {
  ct.liefere('/api/songs/7', {
    data: {
      id: 7,
      name: 'Treu',
      category: { id: 1 },
      arrangements: [
        {
          id: 70,
          name: 'Standard',
          isDefault: true,
          key,
          keyOfArrangement: key,
          bpm: null,
          beat: null,
          files: [ORIGINAL],
        },
      ],
    },
  });
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  ct = new FakeCt();
  ct.installieren();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Suchen und Abfragen über die alte Schnittstelle', () => {
  it('Suche: richtige Funktion, CSRF-Token und X-Requested-With; Lizenz zählt, Interna bleiben draußen', async () => {
    ct.schreibAntworten[AJAX] = ccli({
      pagination: { totalItems: 147 },
      data: { results: [TREFFER] },
    });
    const r = await suchen('  Wo ich auch stehe ');
    expect(ct.geschrieben).toMatchObject([
      {
        was: AJAX,
        felder: { func: 'getCCLISongsMatchingTitle', songTitle: 'Wo ich auch stehe' },
        csrf: 'csrf-123',
        xrw: 'XMLHttpRequest',
      },
    ]);
    expect(r.vollstaendig).toBe(false);
    expect(r.treffer[0]).toMatchObject({ hasLyrics: true, hasChordPro: false, defaultKey: 'C' });
    expect(JSON.stringify(r)).not.toContain('999');
  });

  it('ein leerer Titel geht gar nicht erst raus', async () => {
    await expect(suchen('   ')).rejects.toMatchObject({ status: 400 });
    expect(ct.geschrieben).toEqual([]);
  });

  it('Abfrage per Nummer liefert das Copyright, Liedtext samt Hinweis von CCLI', async () => {
    ct.schreibAntworten[AJAX] = ccli({ data: TREFFER });
    expect(await lied(4330228)).toMatchObject({ copyright: '2002 Immanuel Lobpreisverlag' });
    ct.schreibAntworten[AJAX] = ccli({
      data: {
        songNumber: 4330228,
        lyricParts: [{ partLabel: 'Vers 1', lyrics: 'Wo ich auch stehe' }],
        disclaimer: 'For use solely with the SongSelect Terms of Use.',
      },
    });
    expect(await liedtext(4330228)).toMatchObject({
      teile: [{ label: 'Vers 1', text: 'Wo ich auch stehe' }],
      disclaimer: 'For use solely with the SongSelect Terms of Use.',
    });
  });

  it('kein Recht → die SongSelect-Meldung, kein „Sitzung abgelaufen"', async () => {
    ct.schreibAntworten[AJAX] = () =>
      new Response(JSON.stringify({ message: 'Die Session ist abgelaufen' }), { status: 401 });
    const fehler = await suchen('Treu').catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(KeinSpeicherRecht);
    expect((fehler as Error).message).toBe(
      'Keine Berechtigung für CCLI SongSelect in ChurchTools.',
    );
  });
});

describe('Notenblatt aus SongSelect holen', () => {
  it('in der Tonart des Arrangements – erst holen, dann hochladen, dann das alte Original löschen', async () => {
    liedMitTonart('D');
    ct.schreibAntworten[AJAX] = ccli({ data: { chordPro: '{title: Treu}\n{key: D}' } });
    await notenblattAusCcli(7, 70, 4330228);
    // Alle schreibenden Aufrufe – das Löschen verbucht das FakeCt nicht unter `geschrieben`.
    const reihe = ct.aufrufe.filter((a) => !a.startsWith('GET'));
    expect(reihe).toEqual([AJAX, 'POST /api/files/song_arrangement/70', 'DELETE /api/files/900']);
    expect(ct.geschrieben[0].felder).toMatchObject({
      func: 'getCCLIChordPro',
      songNumber: '4330228',
      title: 'Treu',
      tonality: 'D',
      arrangementID: '70',
    });
    expect(await ct.geschrieben[1].datei?.text()).toBe('{title: Treu}\n{key: D}');
  });

  it('liefert CCLI nichts, wird auch nichts gelöscht', async () => {
    liedMitTonart('D');
    ct.schreibAntworten[AJAX] = ccli({ data: { type: 'songChordPro' } });
    await expect(notenblattAusCcli(7, 70, 4330228)).rejects.toMatchObject({ status: 502 });
    expect(ct.aufrufe.filter((a) => !a.startsWith('GET'))).toEqual([AJAX]);
  });

  it('ohne Tonart am Arrangement und ohne Vorschlag von CCLI: Abbruch statt Raten, nichts geschrieben', async () => {
    liedMitTonart(null);
    ct.schreibAntworten[AJAX] = ccli({ data: { ...TREFFER, defaultKey: [] } });
    await expect(notenblattAusCcli(7, 70, 4330228)).rejects.toMatchObject({ status: 400 });
    expect(ct.geschrieben.map((g) => g.felder?.func ?? g.was)).toEqual(['getCCLISongData']);
  });
});
