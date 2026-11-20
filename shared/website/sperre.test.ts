import { describe, expect, it, vi } from 'vitest';
import { sperreVon } from '../ct/sperre';
import { einheitLoeschen, seiteSpeichern, websiteAusWerten } from './speicher';
import { bearbeitungBeenden, bearbeitungBeginnen, istSperrWert, sperreAusWerten } from './sperre';
import { fakeSpeicher, fehlerMit } from './speicher.testutil';
import { seite } from './website.testdaten';

const JETZT = new Date('2026-11-20T10:00:00Z');
const vor = (minuten: number) => new Date(JETZT.getTime() - minuten * 60_000);
const ICH = { person: 1, name: 'Helene Wiebe', fenster: 'f1' };
const ANDERER = { person: 2, name: 'Jonas Peters', fenster: 'g1' };

/** Der Wert, den die Website für die Sperre einer Seite ablegt. */
const sperrWert = (id: string, von: typeof ICH | null, wann = JETZT) =>
  JSON.stringify({
    art: 'website-sperre',
    fassung: 1,
    einheit: 'seite',
    id,
    sperre: von ? sperreVon(von, wann) : null,
  });

describe('Sperre nehmen', () => {
  it('niemand bearbeitet: die Sperre wird angelegt, nachgelesen und gehört uns', async () => {
    const s = fakeSpeicher();
    const r = await bearbeitungBeginnen(s.ort, 'a', ICH, JETZT);
    expect(r.art).toBe('ok');
    expect(s.schreibzugriffe()).toEqual(['POST']);
    expect(sperreAusWerten(s.werte, 'seite', 'a')?.sperre).toMatchObject({ von: 1, fenster: 'f1' });
    // ... und der Stand, den der Aufrufer bekommt, ist der frisch gelesene
    if (r.art === 'ok') expect(r.werte).toHaveLength(1);
  });

  it('die eigene Sperre erneuern: derselbe Wert wird geändert, es entsteht kein zweiter', async () => {
    const s = fakeSpeicher();
    await bearbeitungBeginnen(s.ort, 'a', ICH, vor(5));
    s.neuesLog();
    const r = await bearbeitungBeginnen(s.ort, 'a', ICH, JETZT);
    expect(r.art).toBe('ok');
    expect(s.schreibzugriffe()).toEqual(['PUT 1']);
    expect(s.werte).toHaveLength(1);
    expect(sperreAusWerten(s.werte, 'seite', 'a')?.sperre?.seit).toBe(JETZT.toISOString());
  });

  it('jemand anderes bearbeitet (frisch): gesperrt – und es wird NICHTS geschrieben', async () => {
    const s = fakeSpeicher();
    s.lege(sperrWert('a', ANDERER, vor(2)));
    const r = await bearbeitungBeginnen(s.ort, 'a', ICH, JETZT);
    expect(r).toMatchObject({ art: 'gesperrt', sperre: { von: 2, name: 'Jonas Peters' } });
    expect(s.schreibzugriffe()).toEqual([]);
  });

  it('dieselbe Person in einem ANDEREN Fenster sperrt sich selbst', async () => {
    const s = fakeSpeicher();
    s.lege(sperrWert('a', { ...ICH, fenster: 'anderes' }, vor(1)));
    expect((await bearbeitungBeginnen(s.ort, 'a', ICH, JETZT)).art).toBe('gesperrt');
    expect(s.schreibzugriffe()).toEqual([]);
  });

  it('eine verlassene fremde Sperre (zehn Minuten ohne Lebenszeichen) wird übernommen', async () => {
    const s = fakeSpeicher();
    s.lege(sperrWert('a', ANDERER, vor(11)));
    expect((await bearbeitungBeginnen(s.ort, 'a', ICH, JETZT)).art).toBe('ok');
    expect(s.schreibzugriffe()).toEqual(['PUT 1']);
  });

  it('eine freigegebene Sperre (`sperre: null`) ist frei', async () => {
    const s = fakeSpeicher();
    s.lege(sperrWert('a', null));
    expect((await bearbeitungBeginnen(s.ort, 'a', ICH, JETZT)).art).toBe('ok');
  });

  it('die Sperre gilt je Seite: eine fremde Sperre auf Seite „b“ stört „a“ nicht', async () => {
    const s = fakeSpeicher();
    s.lege(sperrWert('b', ANDERER, vor(1)));
    expect((await bearbeitungBeginnen(s.ort, 'a', ICH, JETZT)).art).toBe('ok');
  });

  it('zwei fast gleichzeitige Nehmer: wessen Wert nachher dasteht, gewinnt – der andere sieht es beim Nachlesen und schreibt nichts', async () => {
    const s = fakeSpeicher();
    s.lege(sperrWert('a', null));
    // Nach unserem Schreiben (zweites Lesen) hat der andere die Sperre überschrieben:
    s.steuerung.ausfall = (z, nr) => {
      if (z.art === 'LESEN' && nr === 2) s.werte[0].value = sperrWert('a', ANDERER, JETZT);
      return undefined;
    };
    const r = await bearbeitungBeginnen(s.ort, 'a', ICH, JETZT);
    expect(r).toMatchObject({ art: 'gesperrt', sperre: { von: 2 } });
  });

  it('ein „Erfolg“ ohne Wirkung ist keiner: liegt die Sperre nach dem Schreiben nicht da, wird geworfen', async () => {
    const s = fakeSpeicher();
    s.steuerung.ausfall = (z, nr) => {
      if (z.art === 'LESEN' && nr === 2) s.werte.length = 0;
      return undefined;
    };
    await expect(bearbeitungBeginnen(s.ort, 'a', ICH, JETZT)).rejects.toThrow(/nicht übernommen/);
  });

  it('ein Lesefehler wird geworfen – nicht als „gesperrt“ und nicht als „frei“ gedeutet', async () => {
    const s = fakeSpeicher();
    s.steuerung.ausfall = () => fehlerMit(503);
    await expect(bearbeitungBeginnen(s.ort, 'a', ICH, JETZT)).rejects.toMatchObject({
      status: 503,
    });
    expect(s.schreibzugriffe()).toEqual([]);
  });
});

describe('Sperre freigeben', () => {
  it('die eigene: `sperre` wird `null`, der Wert bleibt', async () => {
    const s = fakeSpeicher();
    await bearbeitungBeginnen(s.ort, 'a', ICH, JETZT);
    s.neuesLog();
    await bearbeitungBeenden(s.ort, 'a', ICH, JETZT);
    expect(s.schreibzugriffe()).toEqual(['PUT 1']);
    expect(sperreAusWerten(s.werte, 'seite', 'a')).toMatchObject({ sperre: null });
  });

  it('eine fremde oder keine: es wird nichts geschrieben', async () => {
    const s = fakeSpeicher();
    s.lege(sperrWert('a', ANDERER, vor(1)));
    await bearbeitungBeenden(s.ort, 'a', ICH, JETZT);
    await bearbeitungBeenden(s.ort, 'zzz', ICH, JETZT);
    expect(s.schreibzugriffe()).toEqual([]);
  });
});

describe('Das Lesen der Website kennt die Sperr-Werte', () => {
  it('ein Sperr-Wert ist kein Problem, kein verwaister Teil und keine Seite – und steht unter `sperren`', () => {
    const s = fakeSpeicher();
    s.lege(sperrWert('a', ANDERER, vor(1)));
    s.lege(sperrWert('b', null));
    const stand = websiteAusWerten(s.werte);
    expect(stand.probleme).toEqual([]);
    expect(stand.verwaist).toBe(0);
    expect(stand.seiten).toEqual([]);
    expect(Object.keys(stand.sperren)).toEqual(['a']); // „b“ ist freigegeben
    expect(stand.sperren.a.name).toBe('Jonas Peters');
    expect(istSperrWert(s.werte[0])).toBe(true);
  });

  it('bei zwei Werten für dieselbe Seite gilt der mit der kleinsten ID (wie beim Nehmen)', () => {
    const s = fakeSpeicher();
    s.lege(sperrWert('a', null)); // kleinste ID: freigegeben
    s.lege(sperrWert('a', ANDERER, vor(1)));
    expect(websiteAusWerten(s.werte).sperren).toEqual({});
    expect(sperreAusWerten(s.werte, 'seite', 'a')?.sperre).toBeNull();
  });

  it('ein beschädigter Sperr-Wert gilt als freigegeben, nicht als Sperre', () => {
    const s = fakeSpeicher();
    s.lege(
      JSON.stringify({
        art: 'website-sperre',
        fassung: 1,
        einheit: 'seite',
        id: 'a',
        sperre: { von: 'x' },
      }),
    );
    expect(websiteAusWerten(s.werte).sperren).toEqual({});
  });

  it('eine Seite löschen räumt ihre Sperre mit weg – andere Sperren bleiben', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a', startseite: false }), JETZT);
    s.lege(sperrWert('a', ANDERER, vor(1)));
    s.lege(sperrWert('b', ANDERER, vor(1)));
    await einheitLoeschen(s.ort, 'seite', 'a');
    expect(sperreAusWerten(s.werte, 'seite', 'a')).toBeNull();
    expect(sperreAusWerten(s.werte, 'seite', 'b')).not.toBeNull();
  });

  it('scheitert das Aufräumen der Sperre, ist die Seite trotzdem gelöscht (nur eine Warnung)', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a', startseite: false }), JETZT);
    const sperreId = s.lege(sperrWert('a', ANDERER, vor(1)));
    s.steuerung.ausfall = (z) =>
      z.art === 'DELETE' && z.id === sperreId ? fehlerMit(503) : undefined;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(einheitLoeschen(s.ort, 'seite', 'a')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(websiteAusWerten(s.werte).seiten).toEqual([]);
    warn.mockRestore();
  });
});
