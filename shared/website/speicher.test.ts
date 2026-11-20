import { describe, expect, it, vi } from 'vitest';
import { MAX_ZEICHEN } from '../ct/modulDaten';
import { TEIL_ZEICHEN } from '../ct/teile';
import { seiteAlsText, type Seite } from './modell';
import {
  einheitLoeschen,
  einheitSpeichern,
  einstellungenSpeichern,
  istKopf,
  istTeil,
  menueSpeichern,
  seiteLoeschen,
  seiteSpeichern,
  websiteAusWerten,
  websiteLesen,
  type WebsiteKopf,
} from './speicher';
import { fakeSpeicher, fehlerMit } from './speicher.testutil';
import { abschnitt, baustein, einstellungen, menue, seite, seiteMit } from './website.testdaten';

const JETZT = new Date('2026-11-20T10:00:00Z');

/** Eine Seite, die sicher mehr als einen Teil braucht (zufälliger Text packt sich schlecht; ein Textblock fasst höchstens 8000 Zeichen). */
function grosseSeite(id = 'gross'): Seite {
  let zustand = 12345;
  const zufall = () => {
    zustand = (zustand * 1103515245 + 12345) & 0x7fffffff;
    return zustand.toString(36);
  };
  const block = (n: number) =>
    abschnitt(
      [
        baustein('text', {
          id: `b-${n}`,
          markdown: Array.from({ length: 1000 }, zufall).join(' ').slice(0, 7500),
        }),
      ],
      {
        id: `a-${n}`,
      },
    );
  return seite({ id, titel: 'Groß', pfad: id, abschnitte: [1, 2, 3, 4].map(block) });
}

describe('Speichern und Lesen', () => {
  it('eine Seite, das Menü und die Einstellungen kommen so zurück, wie sie gespeichert wurden', async () => {
    const s = fakeSpeicher();
    const a = seiteMit([baustein('text')], { id: 'a', pfad: 'a' });
    const m = menue([{ titel: 'A', ziel: { art: 'seite', seiteId: 'a' } }]);
    const e = einstellungen({ name: 'Meine Gemeinde' });
    await seiteSpeichern(s.ort, a, JETZT);
    await menueSpeichern(s.ort, m, JETZT);
    await einstellungenSpeichern(s.ort, e, JETZT);
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.probleme).toEqual([]);
    expect(stand.verwaist).toBe(0);
    expect(stand.seiten).toEqual([a]);
    expect(stand.menue).toEqual(m);
    expect(stand.einstellungen).toMatchObject({ name: 'Meine Gemeinde' });
  });

  it('der gespeicherte Inhalt trägt die Kennung `website:v1:` des Modells (seiteAlsText)', async () => {
    const s = fakeSpeicher();
    const a = seite({ id: 'a', pfad: 'a' });
    await seiteSpeichern(s.ort, a, JETZT);
    // Die Teile packen den Text – entpackt ist es genau der Text des Modells.
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten[0]).toEqual(a);
    expect(s.werte.every((w) => w.value.length <= MAX_ZEICHEN)).toBe(true);
    expect(seiteAlsText(a).startsWith('website:v1:')).toBe(true);
  });

  it('eine lange Seite braucht mehrere Teile, jeder Wert bleibt unter der Grenze – und kommt vollständig zurück', async () => {
    const s = fakeSpeicher();
    const gross = grosseSeite();
    await seiteSpeichern(s.ort, gross, JETZT);
    const teile = s.werte.filter((w) => istTeil(JSON.parse(w.value)));
    expect(teile.length).toBeGreaterThan(1);
    expect(s.werte.every((w) => w.value.length <= MAX_ZEICHEN)).toBe(true);
    expect((await websiteLesen(s.port, 7, 1)).seiten).toEqual([gross]);
    // Die Grenze der Teile liegt unter der des Werts (Platz für die Hülle).
    expect(TEIL_ZEICHEN).toBeLessThan(MAX_ZEICHEN);
  });

  it('ein Teil, der die Grenze sprengen würde, wirft – bevor irgendetwas geschrieben ist', async () => {
    const s = fakeSpeicher();
    // Die Hülle eines Teils trägt die Kennung; eine absurd lange sprengt die Grenze, auch wenn der Inhalt winzig ist.
    await expect(
      einheitSpeichern(s.ort, 'seite', 'k'.repeat(10_000), 'text', JETZT),
    ).rejects.toThrow(/Website-Teil/);
    expect(s.schreibzugriffe()).toEqual([]);
  });

  it('die Reihenfolge der Seiten ist die des Anlegens', async () => {
    const s = fakeSpeicher();
    for (const id of ['b', 'a', 'c']) await seiteSpeichern(s.ort, seite({ id, pfad: id }), JETZT);
    expect((await websiteLesen(s.port, 7, 1)).seiten.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('Reihenfolge beim Schreiben: neue Teile → Kopf → alte Teile weg', () => {
  it('Ändern: erst POST der neuen Teile, dann PUT des Kopfes, dann DELETE der alten Teile', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, grosseSeite('a'), JETZT);
    const alt = s.werte.map((w) => w.id);
    s.neuesLog();
    const neu = seiteMit([baustein('text', { markdown: 'ganz anders' })], { id: 'a', pfad: 'a' });
    await seiteSpeichern(s.ort, neu, JETZT);
    const z = s.schreibzugriffe();
    const kopfId = s.werte.find((w) => istKopf(JSON.parse(w.value)))!.id;
    const posts = z.filter((x) => x === 'POST');
    const iPut = z.indexOf(`PUT ${kopfId}`);
    const iDelete = z.findIndex((x) => x.startsWith('DELETE'));
    expect(posts.length).toBeGreaterThan(0);
    expect(z.lastIndexOf('POST')).toBeLessThan(iPut);
    expect(iPut).toBeLessThan(iDelete);
    // Die alten Teile (ohne den Kopf) sind weg, der Kopf blieb.
    expect(z.filter((x) => x.startsWith('DELETE')).length).toBe(alt.length - 1);
    expect((await websiteLesen(s.port, 7, 1)).seiten).toEqual([neu]);
  });

  it('Fehler beim Umstellen des Kopfes: der bisherige Stand bleibt lesbar, nichts wurde gelöscht', async () => {
    const s = fakeSpeicher();
    const alt = seiteMit([baustein('text', { markdown: 'alt' })], { id: 'a', pfad: 'a' });
    await seiteSpeichern(s.ort, alt, JETZT);
    const vorher = s.werte.map((w) => w.value);
    s.neuesLog();
    s.steuerung.ausfall = (z) => (z.art === 'PUT' ? fehlerMit(503) : undefined);
    const neu = seiteMit([baustein('text', { markdown: 'neu' })], { id: 'a', pfad: 'a' });
    await expect(seiteSpeichern(s.ort, neu, JETZT)).rejects.toMatchObject({ status: 503 });
    s.steuerung.ausfall = () => undefined;
    // Kein DELETE ist passiert; alle alten Werte liegen unverändert da (die neuen Teile kamen dazu).
    expect(s.schreibzugriffe().some((x) => x.startsWith('DELETE'))).toBe(false);
    for (const v of vorher) expect(s.werte.some((w) => w.value === v)).toBe(true);
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten).toEqual([alt]);
    expect(stand.probleme).toEqual([]);
    // Der nächste Versuch gelingt, nutzt die schon liegenden Teile und räumt alles auf.
    await seiteSpeichern(s.ort, neu, JETZT);
    expect((await websiteLesen(s.port, 7, 1)).seiten).toEqual([neu]);
    expect(s.werte.filter((w) => istTeil(JSON.parse(w.value))).length).toBe(1);
  });

  it('Fehler mitten im Anlegen der Teile: der bisherige Stand bleibt lesbar', async () => {
    const s = fakeSpeicher();
    const alt = seiteMit([baustein('text', { markdown: 'alt' })], { id: 'a', pfad: 'a' });
    await seiteSpeichern(s.ort, alt, JETZT);
    s.neuesLog();
    let posts = 0;
    s.steuerung.ausfall = (z) => (z.art === 'POST' && ++posts === 2 ? fehlerMit(504) : undefined);
    await expect(seiteSpeichern(s.ort, grosseSeite('a'), JETZT)).rejects.toMatchObject({
      status: 504,
    });
    s.steuerung.ausfall = () => undefined;
    expect(s.schreibzugriffe().some((x) => x.startsWith('PUT') || x.startsWith('DELETE'))).toBe(
      false,
    );
    expect((await websiteLesen(s.port, 7, 1)).seiten).toEqual([alt]);
  });

  it('erstes Speichern, Fehler beim Anlegen des Kopfes: keine halbe Seite, nur verwaiste Teile – und kein Löschen', async () => {
    const s = fakeSpeicher();
    s.steuerung.ausfall = (z, nr) => (z.art === 'POST' && nr >= 3 ? fehlerMit(500) : undefined);
    await expect(seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a' }), JETZT)).rejects.toMatchObject(
      { status: 500 },
    );
    s.steuerung.ausfall = () => undefined;
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten).toEqual([]);
    expect(stand.verwaist).toBeGreaterThan(0);
    expect(s.schreibzugriffe().some((x) => x.startsWith('DELETE'))).toBe(false);
    // Ein zweiter Versuch mit demselben Inhalt legt die Teile nicht noch einmal an.
    const teileVorher = s.werte.length;
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a' }), JETZT);
    expect(s.werte.length).toBe(teileVorher + 1); // nur der Kopf kam dazu
    expect((await websiteLesen(s.port, 7, 1)).verwaist).toBe(0);
  });

  it('Fehler nur beim Aufräumen: Speichern gelingt, der neue Stand gilt, die alten Teile liegen vorerst da', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, grosseSeite('a'), JETZT);
    const neu = seiteMit([baustein('text', { markdown: 'neu' })], { id: 'a', pfad: 'a' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    s.steuerung.ausfall = (z) => (z.art === 'DELETE' ? fehlerMit(502) : undefined);
    await expect(seiteSpeichern(s.ort, neu, JETZT)).resolves.toBeUndefined();
    s.steuerung.ausfall = () => undefined;
    expect(warn).toHaveBeenCalled();
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten).toEqual([neu]);
    expect(stand.probleme).toEqual([]);
    // Das nächste Speichern räumt auf.
    await seiteSpeichern(s.ort, neu, JETZT);
    expect(s.werte.filter((w) => istTeil(JSON.parse(w.value))).length).toBe(1);
  });

  it('wirft, wenn ChurchTools einen Teil „annimmt“, aber nicht ablegt (ein Erfolgssignal ist kein Beleg)', async () => {
    const s = fakeSpeicher();
    const schreibe = s.port.schreibe.bind(s.port);
    // POST meldet Erfolg und tut nichts.
    s.port.schreibe = (pfad, a) => (a.method === 'POST' ? Promise.resolve() : schreibe(pfad, a));
    await expect(seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a' }), JETZT)).rejects.toThrow(
      /nicht vollständig übernommen/,
    );
    expect(s.werte).toEqual([]);
  });

  it('wirft, wenn der Kopf nicht auf den neuen Stand zeigt', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a', titel: 'Alt' }), JETZT);
    const schreibe = s.port.schreibe.bind(s.port);
    // PUT meldet Erfolg und ändert nichts.
    s.port.schreibe = (pfad, a) => (a.method === 'PUT' ? Promise.resolve() : schreibe(pfad, a));
    await expect(
      seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a', titel: 'Neu' }), JETZT),
    ).rejects.toThrow(/nicht übernommen/);
    expect((await websiteLesen(s.port, 7, 1)).seiten[0].titel).toBe('Alt');
  });
});

describe('Vorübergehende Fehler zerstören nichts', () => {
  it('Lesen: ein 503 wird geworfen – nicht zu „keine Seiten“ gemacht', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a' }), JETZT);
    s.steuerung.ausfall = () => fehlerMit(503);
    await expect(websiteLesen(s.port, 7, 1)).rejects.toMatchObject({ status: 503 });
  });

  it('Speichern bei einem Lesefehler: es wird NICHTS geschrieben', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a' }), JETZT);
    const vorher = s.werte.map((w) => ({ ...w }));
    s.neuesLog();
    s.steuerung.ausfall = (z) => (z.art === 'LESEN' ? fehlerMit(504) : undefined);
    await expect(
      seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a', titel: 'Neu' }), JETZT),
    ).rejects.toMatchObject({ status: 504 });
    expect(s.schreibzugriffe()).toEqual([]);
    expect(s.werte).toEqual(vorher);
  });

  it('Speichern, Lesefehler erst NACH den neuen Teilen: wirft, der Kopf bleibt unberührt, der alte Stand bleibt lesbar', async () => {
    const s = fakeSpeicher();
    const alt = seiteMit([baustein('text', { markdown: 'alt' })], { id: 'a', pfad: 'a' });
    await seiteSpeichern(s.ort, alt, JETZT);
    s.neuesLog();
    let gelesen = 0;
    s.steuerung.ausfall = (z) =>
      z.art === 'LESEN' && ++gelesen === 2 ? fehlerMit(503) : undefined;
    const neu = seiteMit([baustein('text', { markdown: 'neu' })], { id: 'a', pfad: 'a' });
    await expect(seiteSpeichern(s.ort, neu, JETZT)).rejects.toMatchObject({ status: 503 });
    s.steuerung.ausfall = () => undefined;
    expect(s.schreibzugriffe().some((x) => x.startsWith('PUT') || x.startsWith('DELETE'))).toBe(
      false,
    );
    expect((await websiteLesen(s.port, 7, 1)).seiten).toEqual([alt]);
  });

  it('Löschen bei einem Lesefehler: es wird nichts gelöscht', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a' }), JETZT);
    const vorher = s.werte.length;
    s.neuesLog();
    s.steuerung.ausfall = (z) => (z.art === 'LESEN' ? fehlerMit(502) : undefined);
    await expect(seiteLoeschen(s.ort, 'a')).rejects.toMatchObject({ status: 502 });
    expect(s.schreibzugriffe()).toEqual([]);
    expect(s.werte.length).toBe(vorher);
  });

  it('Löschen: erst der Kopf – scheitert er, ist die Seite noch ganz da', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, grosseSeite('a'), JETZT);
    const vorher = s.werte.length;
    s.steuerung.ausfall = (z) => (z.art === 'DELETE' ? fehlerMit(503) : undefined);
    await expect(seiteLoeschen(s.ort, 'a')).rejects.toMatchObject({ status: 503 });
    s.steuerung.ausfall = () => undefined;
    expect(s.werte.length).toBe(vorher);
    expect((await websiteLesen(s.port, 7, 1)).seiten.map((x) => x.id)).toEqual(['a']);
  });

  it('Löschen: scheitert nur das Löschen der Teile, ist die Seite weg und die Teile liegen verwaist', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, grosseSeite('a'), JETZT);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let loeschen = 0;
    s.steuerung.ausfall = (z) =>
      z.art === 'DELETE' && ++loeschen > 1 ? fehlerMit(503) : undefined;
    await expect(seiteLoeschen(s.ort, 'a')).resolves.toBeUndefined();
    s.steuerung.ausfall = () => undefined;
    expect(warn).toHaveBeenCalled();
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten).toEqual([]);
    expect(stand.verwaist).toBeGreaterThan(0);
  });

  it('Löschen: „schon weg“ (404) ist kein Fehler; andere Seiten bleiben', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a' }), JETZT);
    await seiteSpeichern(s.ort, seite({ id: 'b', pfad: 'b', startseite: false }), JETZT);
    await seiteLoeschen(s.ort, 'a');
    await expect(seiteLoeschen(s.ort, 'a')).resolves.toBeUndefined();
    expect((await websiteLesen(s.port, 7, 1)).seiten.map((x) => x.id)).toEqual(['b']);
  });
});

describe('Fremdes, Beschädigtes und Unvollständiges wird gemeldet – nie verworfen oder gelöscht', () => {
  it('ein fremder Wert und ein beschädigter Wert stehen unter `probleme`, die Seiten bleiben lesbar', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a' }), JETZT);
    const fremd = s.lege('{"hallo":"welt"}');
    const kaputt = s.lege('kein JSON');
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten.map((x) => x.id)).toEqual(['a']);
    expect(stand.probleme.map((p) => p.wert).sort()).toEqual([fremd, kaputt].sort());
    // Ein Speichern fasst sie nicht an.
    await seiteSpeichern(s.ort, seite({ id: 'b', pfad: 'b' }), JETZT);
    expect(s.werte.some((w) => w.id === fremd)).toBe(true);
    expect(s.werte.some((w) => w.id === kaputt)).toBe(true);
  });

  it('eine Seite mit ungültigem Inhalt (Schema) wird gemeldet, nicht stillschweigend übersprungen', () => {
    const s = fakeSpeicher();
    const gueltig = seite({ id: 'a', pfad: 'a' });
    // Ungültig: der Pfad passt nicht zum Muster.
    const ungueltig = { ...seite({ id: 'b' }), pfad: 'Falsch Geschrieben!' };
    return (async () => {
      await einheitSpeichern(s.ort, 'seite', 'a', seiteAlsText(gueltig), JETZT);
      await einheitSpeichern(s.ort, 'seite', 'b', seiteAlsText(ungueltig), JETZT);
      const stand = await websiteLesen(s.port, 7, 1);
      expect(stand.seiten.map((x) => x.id)).toEqual(['a']);
      expect(stand.probleme).toHaveLength(1);
      expect(stand.probleme[0]).toMatchObject({ einheit: 'seite', id: 'b' });
      expect(stand.probleme[0].text).toMatch(/nicht gültig/);
    })();
  });

  it('eine neuere Formatversion wird gemeldet (die Erweiterung ist zu alt) – die Seite fehlt in der Liste, ist aber nicht weg', async () => {
    const s = fakeSpeicher();
    await einheitSpeichern(s.ort, 'seite', 'n', 'website:v2:{"id":"n"}', JETZT);
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten).toEqual([]);
    expect(stand.probleme[0].text).toMatch(/neueren Version/);
    expect(s.werte.length).toBeGreaterThan(0);
  });

  it('ein Kopf ohne seine Teile ist „nicht vollständig lesbar“ – gemeldet, nichts gelöscht', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a' }), JETZT);
    const teil = s.werte.find((w) => istTeil(JSON.parse(w.value)))!;
    s.werte.splice(s.werte.indexOf(teil), 1);
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten).toEqual([]);
    expect(stand.probleme[0].text).toMatch(/nicht vollständig lesbar/);
    expect(s.werte.length).toBe(1);
  });

  it('Teile eines anderen Stands gehören nicht zum Kopf', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a', titel: 'Eins' }), JETZT);
    const kopfWert = s.werte.find((w) => istKopf(JSON.parse(w.value)))!;
    const kopf = JSON.parse(kopfWert.value) as WebsiteKopf;
    kopfWert.value = JSON.stringify({ ...kopf, stand: 'anderer-stand' });
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten).toEqual([]);
    expect(stand.probleme).toHaveLength(1);
  });

  it('zwei Köpfe für dieselbe Seite: es gilt der erste (kleinste ID), der zweite wird gemeldet', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'a', pfad: 'a', titel: 'Erste' }), JETZT);
    const kopf = s.werte.find((w) => istKopf(JSON.parse(w.value)))!;
    s.lege(kopf.value);
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten.map((x) => x.titel)).toEqual(['Erste']);
    expect(stand.probleme.some((p) => /zweiter Kopf/.test(p.text))).toBe(true);
  });

  it('Menü und Einstellungen haben feste Kennungen – ein Kopf „menue“ mit anderer Kennung wird nicht benutzt', () => {
    const roh = (id: string) =>
      JSON.stringify({
        art: 'website-kopf',
        fassung: 1,
        einheit: 'menue',
        id,
        stand: 'x',
        zeit: 'z',
      });
    const stand = websiteAusWerten([{ id: 1, dataCategoryId: 1, value: roh('irgendwas') }]);
    expect(stand.menue).toBeNull();
    expect(stand.probleme).toHaveLength(1);
  });

  it('einheitLoeschen kennt nur die eigene Einheit: dieselbe Kennung bei Menü und Seite ist nicht dasselbe', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'menue', pfad: 'menue-seite' }), JETZT);
    await menueSpeichern(s.ort, menue(), JETZT);
    await einheitLoeschen(s.ort, 'seite', 'menue');
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.seiten).toEqual([]);
    expect(stand.menue).toEqual(menue());
  });
});

describe('Kopf und Teil erkennen', () => {
  it('istKopf / istTeil: nur die eigenen Formen', () => {
    expect(
      istKopf({
        art: 'website-kopf',
        fassung: 1,
        einheit: 'seite',
        id: 'a',
        stand: 's',
        zeit: 'z',
      }),
    ).toBe(true);
    expect(
      istKopf({
        art: 'website-kopf',
        fassung: 2,
        einheit: 'seite',
        id: 'a',
        stand: 's',
        zeit: 'z',
      }),
    ).toBe(false);
    expect(istKopf({ art: 'protokoll', fassung: 1 })).toBe(false);
    expect(
      istKopf({ art: 'website-kopf', fassung: 1, einheit: 'bild', id: 'a', stand: 's', zeit: 'z' }),
    ).toBe(false);
    expect(
      istTeil({
        art: 'website-teil',
        fassung: 1,
        einheit: 'seite',
        id: 'a',
        stand: 's',
        nr: 0,
        von: 1,
        daten: '',
      }),
    ).toBe(true);
    expect(
      istTeil({
        art: 'website-teil',
        fassung: 1,
        einheit: 'seite',
        id: 'a',
        stand: 's',
        nr: 0.5,
        von: 1,
        daten: '',
      }),
    ).toBe(false);
    expect(istTeil(null)).toBe(false);
  });

  it('abschnitt-Testdaten bleiben gültig (Schutz gegen ein stilles Leerlaufen der Tests oben)', () => {
    expect(abschnitt().spalten).toHaveLength(1);
  });
});

describe('Eine ungültige Seite wird nicht gespeichert (Schema vor dem Schreiben)', () => {
  it('seiteSpeichern wirft VOR dem ersten Zugriff – es wird nichts gelesen und nichts geschrieben', async () => {
    const s = fakeSpeicher();
    const kaputt = seite({ id: 'k', pfad: 'Großer Pfad!' });
    await expect(seiteSpeichern(s.ort, kaputt, JETZT)).rejects.toThrow(/nicht gültig/);
    expect(s.log).toEqual([]);
  });

  it('eine gültige Seite geht weiter wie bisher', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(s.ort, seite({ id: 'g', pfad: 'g', startseite: false }), JETZT);
    expect((await websiteLesen(s.port, 7, 1)).seiten).toHaveLength(1);
  });
});

describe('Einstellungen speichern prüft vorher mit dem Schema (W3a-3)', () => {
  it('Ungültiges wird nicht geschrieben – 422, kein einziger Schreibzugriff', async () => {
    const s = fakeSpeicher();
    const kaputt = einstellungen({ eigenesCss: 'x'.repeat(20_001) });
    await expect(einstellungenSpeichern(s.ort, kaputt, JETZT)).rejects.toMatchObject({
      status: 422,
    });
    expect(s.schreibzugriffe()).toEqual([]);
  });

  it('Gültiges mit 20.000 Zeichen eigenem CSS passt (mehrere Teile) und kommt unverändert zurück', async () => {
    const s = fakeSpeicher();
    const css = Array.from({ length: 2000 }, (_, i) => `.a${i}{b:${i}}`)
      .join('')
      .slice(0, 20_000);
    await einstellungenSpeichern(s.ort, einstellungen({ eigenesCss: css }), JETZT);
    expect((await websiteLesen(s.port, 7, 1)).einstellungen?.eigenesCss).toBe(css);
  });
});
