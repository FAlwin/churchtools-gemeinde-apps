import { describe, expect, it } from 'vitest';
import { modulRechteAus, schubladenStand, type EntwurfPort } from './entwuerfe';
import { Fehler } from './einteilen.testutil';
import { MAX_ZEICHEN, type Wert } from '../ct/modulDaten';
import {
  alleAntwortenLesen,
  antwortenSchublade,
  eigeneAntwortenLesen,
  eigeneAntwortenSchreiben,
  personenWertAus,
  type Antworten,
} from './verfuegbarkeit';

const MODUL = 16;
const K1 = 40;
const K2 = 41;
const HEUTE = '2026-11-18';

type Auftrag = { method: 'POST' | 'PUT' | 'DELETE'; kat: number; json?: unknown };

/** Nachgebauter Speicher mit mehreren Kategorien. Verhält sich wie gemessen (POST legt an, PUT/DELETE auf fehlende ID → 404). */
function speicher() {
  let naechste = 100;
  let uhr = 0;
  const s = {
    werte: [] as Wert[],
    auftraege: [] as Auftrag[],
    /** Je Kategorie: Lesen wirft. */
    lesenWirft: new Map<number, Fehler>(),
    /** Je Kategorie: Schreiben wirft (mit `trotzdemSchreiben` landet es vorher doch). */
    schreibenWirft: new Map<number, Fehler>(),
    trotzdemSchreiben: false,
    /** ChurchTools sagt OK, schreibt aber nichts (Befund vom 11.08.2026). */
    verschlucken: new Set<number>(),
    /** Nach dem Schreiben, vor dem Nachlesen: ein anderer Schreiber dazwischen. */
    nachSchreiben: null as (() => void) | null,
  };
  const katAus = (pfad: string) => Number(/customdatacategories\/(\d+)/.exec(pfad)![1]);
  const ausfuehren = (pfad: string, kat: number, a: Omit<Auftrag, 'kat'>) => {
    const id = Number(pfad.split('/').pop());
    if (a.method === 'POST') {
      s.werte.push({
        id: naechste++,
        dataCategoryId: kat,
        value: (a.json as { value: string }).value,
      });
      return;
    }
    const i = s.werte.findIndex((w) => w.id === id && w.dataCategoryId === kat);
    if (i < 0) throw new Fehler(404);
    if (a.method === 'PUT')
      s.werte[i] = { ...s.werte[i], value: (a.json as { value: string }).value };
    else s.werte.splice(i, 1);
  };
  const port: EntwurfPort = {
    kuerzel: () => 'dienstplaner',
    daten: <T>(pfad: string) => {
      const kat = katAus(pfad);
      const f = s.lesenWirft.get(kat);
      if (f) return Promise.reject(f);
      return Promise.resolve(structuredClone(s.werte.filter((w) => w.dataCategoryId === kat)) as T);
    },
    schreibe: (pfad, a) => {
      const kat = katAus(pfad);
      s.auftraege.push({ method: a.method, kat, json: a.json });
      try {
        const f = s.schreibenWirft.get(kat);
        if (f) {
          if (s.trotzdemSchreiben) ausfuehren(pfad, kat, a);
          throw f;
        }
        if (!s.verschlucken.has(kat)) ausfuehren(pfad, kat, a);
        s.nachSchreiben?.();
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
    },
    fehler: (status, meldung) => Object.assign(new Fehler(status), { message: meldung }),
    istKeinRecht: (e) => e instanceof Fehler && e.status === 403,
    istNichtGefunden: (e) => e instanceof Fehler && e.status === 404,
    istAbgemeldet: (e) => e instanceof Fehler && e.status === 401,
    jetzt: () => `2026-11-18T20:00:${String(uhr++).padStart(2, '0')}.000Z`,
  };
  const inKat = (kat: number) => s.werte.filter((w) => w.dataCategoryId === kat);
  const eigene = (kat: number, person: number) =>
    inKat(kat).filter((w) => personenWertAus(w)?.person === person);
  return { s, port, inKat, eigene };
}

const ANNA = 46;
const BERT = 47;

const antw = (x: Record<string, ['ja' | 'vielleicht', string]> = {}): Antworten =>
  Object.fromEntries(Object.entries(x).map(([t, [a, tag]]) => [t, { a, tag }]));

const A1 = antw({ '1': ['ja', '2026-12-06'], '2': ['vielleicht', '2026-12-13'] });

/** Ein Wert, wie ihn der Schreiber erzeugt – nur mit eigenem `stand` und eigener ID (für Doppel / zwei Kategorien). */
const wertMit = (
  id: number,
  kat: number,
  person: number,
  antworten: Antworten,
  stand: string,
): Wert => ({
  id,
  dataCategoryId: kat,
  value: JSON.stringify({
    art: 'dienstplaner-verfuegbarkeit',
    fassung: 1,
    person,
    antworten,
    stand,
  }),
});

describe('Schublade je Dienstgruppe', () => {
  it('Kürzel an der ID, Name höchstens 50 Zeichen, Beschreibung nennt die Gruppe', () => {
    const k = antwortenSchublade({ id: 3, name: 'Technik' });
    expect(k).toMatchObject({ kuerzel: 'dienstplaner-antworten-3', name: 'Antworten Technik' });
    expect(k.beschreibung).toContain('„Technik“');
    expect(antwortenSchublade({ id: 9, name: 'x'.repeat(80) }).name).toHaveLength(50);
  });

  it('Stand über die vorhandene Regel (schubladenStand), nichts nachgebaut', () => {
    const r = modulRechteAus({
      'view custom data': [K1],
      'create custom data': [K1],
      'edit custom data': [K1],
      'delete custom data': [K1],
    });
    expect(schubladenStand(r, K1)).toBe('bereit');
  });
});

describe('Schreiben', () => {
  it('legt an und liest es wieder (Erzeuger gegen Leser)', async () => {
    const { port } = speicher();
    const r = await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    expect(r).toEqual([{ kategorie: K1, ok: true }]);
    const g = await eigeneAntwortenLesen(port, MODUL, [K1], ANNA);
    expect(g).toMatchObject({ ok: true, wert: { antworten: A1 } });
  });

  it('ändert den vorhandenen Wert (PUT statt zweitem POST)', async () => {
    const { port, s, eigene } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    const neu = antw({ '1': ['vielleicht', '2026-12-06'] });
    const r = await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, neu, HEUTE);
    expect(r).toEqual([{ kategorie: K1, ok: true }]);
    expect(s.auftraege.map((a) => a.method)).toEqual(['POST', 'PUT']);
    expect(eigene(K1, ANNA)).toHaveLength(1);
    expect(personenWertAus(eigene(K1, ANNA)[0])?.antworten).toEqual(neu);
  });

  it('andere Personen bleiben unberührt', async () => {
    const { port, eigene } = speicher();
    await eigeneAntwortenSchreiben(
      port,
      MODUL,
      [K1],
      BERT,
      antw({ '9': ['ja', '2026-12-20'] }),
      HEUTE,
    );
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    expect(eigene(K1, BERT)).toHaveLength(1);
    expect(personenWertAus(eigene(K1, BERT)[0])?.antworten).toEqual(
      antw({ '9': ['ja', '2026-12-20'] }),
    );
  });

  it('zwei Kategorien: in beide geschrieben und nachgelesen, nacheinander', async () => {
    const { port, s, inKat } = speicher();
    const r = await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, A1, HEUTE);
    expect(r).toEqual([
      { kategorie: K1, ok: true },
      { kategorie: K2, ok: true },
    ]);
    expect(inKat(K1)).toHaveLength(1);
    expect(inKat(K2)).toHaveLength(1);
    expect(s.auftraege.map((a) => a.kat)).toEqual([K1, K2]);
  });

  it('Vergangenes fällt raus (tag < heute); heute bleibt', async () => {
    const { port, eigene } = speicher();
    const x = antw({
      '1': ['ja', '2026-11-17'],
      '2': ['ja', HEUTE],
      '3': ['vielleicht', '2026-11-19'],
    });
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, x, HEUTE);
    expect(Object.keys(personenWertAus(eigene(K1, ANNA)[0])!.antworten)).toEqual(['2', '3']);
  });

  it('nur Vergangenes oder leer → eigener Wert wird gelöscht, kein leerer geschrieben', async () => {
    const { port, s, eigene } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    const r = await eigeneAntwortenSchreiben(
      port,
      MODUL,
      [K1],
      ANNA,
      antw({ '1': ['ja', '2026-01-01'] }),
      HEUTE,
    );
    expect(r).toEqual([{ kategorie: K1, ok: true }]);
    expect(eigene(K1, ANNA)).toHaveLength(0);
    expect(s.auftraege.at(-1)?.method).toBe('DELETE');
    // Leer und nichts da: nichts zu tun, trotzdem Erfolg, kein Schreibvorgang
    const n = s.auftraege.length;
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, {}, HEUTE)).toEqual([
      { kategorie: K1, ok: true },
    ]);
    expect(s.auftraege).toHaveLength(n);
  });

  it('Doppel derselben Person werden beim Schreiben entfernt, der neueste wird geändert', async () => {
    const { port, s, eigene } = speicher();
    s.werte.push(
      wertMit(10, K1, ANNA, antw({ '1': ['ja', '2026-12-06'] }), '2026-11-01T10:00:00.000Z'),
    );
    s.werte.push(
      wertMit(11, K1, ANNA, antw({ '2': ['ja', '2026-12-13'] }), '2026-11-02T10:00:00.000Z'),
    );
    s.werte.push(
      wertMit(12, K1, BERT, antw({ '3': ['ja', '2026-12-13'] }), '2026-11-02T10:00:00.000Z'),
    );
    const r = await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    expect(r).toEqual([{ kategorie: K1, ok: true }]);
    expect(eigene(K1, ANNA).map((w) => w.id)).toEqual([11]);
    expect(eigene(K1, BERT)).toHaveLength(1);
    expect(s.auftraege.map((a) => a.method).sort()).toEqual(['DELETE', 'PUT']);
  });

  it('Nachlesen: ChurchTools meldet OK, schreibt aber nichts → nicht-angekommen', async () => {
    const { port, s } = speicher();
    s.verschlucken.add(K1);
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE)).toEqual([
      { kategorie: K1, ok: false, grund: 'nicht-angekommen' },
    ]);
  });

  it('Nachlesen: ein anderer Schreiber war dazwischen (neuerer Stand) → nicht-angekommen', async () => {
    const { port, s } = speicher();
    s.nachSchreiben = () => {
      s.nachSchreiben = null;
      s.werte.push(
        wertMit(500, K1, ANNA, antw({ '7': ['ja', '2026-12-27'] }), '2099-01-01T00:00:00.000Z'),
      );
    };
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE)).toEqual([
      { kategorie: K1, ok: false, grund: 'nicht-angekommen' },
    ]);
  });

  it('Nachlesen: Löschen ohne Wirkung → nicht-angekommen', async () => {
    const { port, s } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    s.verschlucken.add(K1);
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, {}, HEUTE)).toEqual([
      { kategorie: K1, ok: false, grund: 'nicht-angekommen' },
    ]);
  });

  it('vorübergehender Fehler → voruebergehend (nicht kein-recht); die andere Kategorie läuft weiter; nichts wird wiederholt', async () => {
    const { port, s, inKat } = speicher();
    for (const status of [429, 502, 504, null]) {
      s.werte.length = 0;
      s.auftraege.length = 0;
      s.schreibenWirft.set(K1, new Fehler(status));
      const r = await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, A1, HEUTE);
      expect(r).toEqual([
        { kategorie: K1, ok: false, grund: 'voruebergehend' },
        { kategorie: K2, ok: true },
      ]);
      expect(s.auftraege.filter((a) => a.kat === K1)).toHaveLength(1);
      expect(inKat(K2)).toHaveLength(1);
    }
  });

  it('vorübergehender Fehler, aber es ist doch angekommen → Erfolg (nachgelesen)', async () => {
    const { port, s } = speicher();
    s.schreibenWirft.set(K1, new Fehler(504));
    s.trotzdemSchreiben = true;
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE)).toEqual([
      { kategorie: K1, ok: true },
    ]);
  });

  it('Lesen vor dem Schreiben schlägt vorübergehend fehl → voruebergehend, nichts geschrieben', async () => {
    const { port, s } = speicher();
    s.lesenWirft.set(K1, new Fehler(503));
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE)).toEqual([
      { kategorie: K1, ok: false, grund: 'voruebergehend' },
    ]);
    expect(s.auftraege).toHaveLength(0);
  });

  it('kein Recht (403) → kein-recht, die andere Kategorie läuft weiter', async () => {
    const { port, s } = speicher();
    s.schreibenWirft.set(K1, new Fehler(403));
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, A1, HEUTE)).toEqual([
      { kategorie: K1, ok: false, grund: 'kein-recht' },
      { kategorie: K2, ok: true },
    ]);
  });

  it('abgemeldet (401) → abgemeldet', async () => {
    const { port, s } = speicher();
    s.schreibenWirft.set(K1, new Fehler(401));
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE)).toEqual([
      { kategorie: K1, ok: false, grund: 'abgemeldet' },
    ]);
  });

  it('zu groß für einen Wert → zu-gross, nichts geschrieben; die andere Kategorie ebenso', async () => {
    const { port, s } = speicher();
    const viele: Antworten = {};
    for (let i = 0; i < 400; i++) viele[`${1_000_000 + i}`] = { a: 'ja', tag: '2026-12-06' };
    expect(JSON.stringify(viele).length).toBeGreaterThan(MAX_ZEICHEN);
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, viele, HEUTE)).toEqual([
      { kategorie: K1, ok: false, grund: 'zu-gross' },
      { kategorie: K2, ok: false, grund: 'zu-gross' },
    ]);
    expect(s.auftraege).toHaveLength(0);
  });
});

describe('Lesen', () => {
  it('über mehrere Kategorien gilt der neueste stand', async () => {
    const { port, s } = speicher();
    s.werte.push(
      wertMit(1, K1, ANNA, antw({ '1': ['ja', '2026-12-06'] }), '2026-11-01T10:00:00.000Z'),
    );
    s.werte.push(
      wertMit(2, K2, ANNA, antw({ '2': ['vielleicht', '2026-12-13'] }), '2026-11-05T10:00:00.000Z'),
    );
    const g = await eigeneAntwortenLesen(port, MODUL, [K1, K2], ANNA);
    expect(g).toEqual({
      ok: true,
      wert: {
        antworten: antw({ '2': ['vielleicht', '2026-12-13'] }),
        stand: '2026-11-05T10:00:00.000Z',
      },
    });
    // andersherum (Reihenfolge der Übergabe ist egal)
    expect(await eigeneAntwortenLesen(port, MODUL, [K2, K1], ANNA)).toEqual(g);
  });

  it('Gleichstand über Kategorien: die kleinere Kategorie-ID, egal in welcher Reihenfolge übergeben', async () => {
    const { port, s } = speicher();
    const stand = '2026-11-05T10:00:00.000Z';
    s.werte.push(wertMit(1, K2, ANNA, antw({ '2': ['ja', '2026-12-13'] }), stand));
    s.werte.push(wertMit(2, K1, ANNA, antw({ '1': ['ja', '2026-12-06'] }), stand));
    for (const kats of [
      [K1, K2],
      [K2, K1],
    ]) {
      const g = await eigeneAntwortenLesen(port, MODUL, kats, ANNA);
      expect(g).toMatchObject({
        ok: true,
        wert: { antworten: antw({ '1': ['ja', '2026-12-06'] }) },
      });
    }
  });

  it('Doppel in einer Kategorie: der neueste gilt (bei gleichem stand die höhere ID)', async () => {
    const { port, s } = speicher();
    s.werte.push(
      wertMit(1, K1, ANNA, antw({ '1': ['ja', '2026-12-06'] }), '2026-11-02T10:00:00.000Z'),
    );
    s.werte.push(
      wertMit(2, K1, ANNA, antw({ '2': ['ja', '2026-12-13'] }), '2026-11-01T10:00:00.000Z'),
    );
    expect(await eigeneAntwortenLesen(port, MODUL, [K1], ANNA)).toMatchObject({
      wert: { antworten: antw({ '1': ['ja', '2026-12-06'] }) },
    });
    s.werte.push(
      wertMit(3, K1, ANNA, antw({ '3': ['vielleicht', '2026-12-20'] }), '2026-11-02T10:00:00.000Z'),
    );
    expect(await eigeneAntwortenLesen(port, MODUL, [K1], ANNA)).toMatchObject({
      wert: { antworten: antw({ '3': ['vielleicht', '2026-12-20'] }) },
    });
  });

  it('nichts gespeichert → leere Antworten, stand null', async () => {
    const { port } = speicher();
    expect(await eigeneAntwortenLesen(port, MODUL, [K1, K2], ANNA)).toEqual({
      ok: true,
      wert: { antworten: {}, stand: null },
    });
  });

  it('eine Kategorie nicht lesbar: die übrigen zählen; keine lesbar → Fehler, nicht „leer“', async () => {
    const { port, s } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K2], ANNA, A1, HEUTE);
    s.lesenWirft.set(K1, new Fehler(503));
    expect(await eigeneAntwortenLesen(port, MODUL, [K1, K2], ANNA)).toMatchObject({
      ok: true,
      wert: { antworten: A1 },
    });
    s.lesenWirft.set(K2, new Fehler(403));
    expect(await eigeneAntwortenLesen(port, MODUL, [K1, K2], ANNA)).toEqual({
      ok: false,
      grund: 'voruebergehend',
    });
  });

  it('fremde und kaputte Werte werden übersprungen, nie geworfen', async () => {
    const { port, s } = speicher();
    const roh = (id: number, value: string) => s.werte.push({ id, dataCategoryId: K1, value });
    roh(1, '{kaputt');
    roh(2, JSON.stringify({ art: 'dienstplaner-entwurf', fassung: 1, person: ANNA }));
    roh(
      3,
      JSON.stringify({
        art: 'dienstplaner-verfuegbarkeit',
        fassung: 2,
        person: ANNA,
        antworten: {},
        stand: 'x',
      }),
    );
    roh(
      4,
      JSON.stringify({
        art: 'dienstplaner-verfuegbarkeit',
        fassung: 1,
        person: 'Anna',
        antworten: {},
        stand: 'x',
      }),
    );
    roh(
      5,
      JSON.stringify({
        art: 'dienstplaner-verfuegbarkeit',
        fassung: 1,
        person: ANNA,
        antworten: [],
        stand: 'x',
      }),
    );
    roh(6, 'null');
    // Gültiger Wert mit einem kaputten Eintrag daneben: nur der Eintrag fällt weg.
    roh(
      7,
      JSON.stringify({
        art: 'dienstplaner-verfuegbarkeit',
        fassung: 1,
        person: ANNA,
        antworten: {
          '1': { a: 'ja', tag: '2026-12-06' },
          '2': { a: 'nein', tag: '2026-12-06' },
          '3': { a: 'ja', tag: 'morgen' },
        },
        stand: '2026-11-01T00:00:00.000Z',
      }),
    );
    expect(await eigeneAntwortenLesen(port, MODUL, [K1], ANNA)).toMatchObject({
      ok: true,
      wert: { antworten: antw({ '1': ['ja', '2026-12-06'] }) },
    });
    expect(await alleAntwortenLesen(port, MODUL, K1)).toEqual({
      ok: true,
      wert: new Map([[ANNA, antw({ '1': ['ja', '2026-12-06'] })]]),
    });
  });

  it('alleAntwortenLesen: je Person der neueste Wert; Fehler werden als Grund gemeldet', async () => {
    const { port, s } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    await eigeneAntwortenSchreiben(
      port,
      MODUL,
      [K1],
      BERT,
      antw({ '9': ['ja', '2026-12-20'] }),
      HEUTE,
    );
    s.werte.push(
      wertMit(900, K1, ANNA, antw({ '5': ['ja', '2026-12-27'] }), '2000-01-01T00:00:00.000Z'),
    ); // älteres Doppel
    const g = await alleAntwortenLesen(port, MODUL, K1);
    expect(g).toEqual({
      ok: true,
      wert: new Map([
        [ANNA, A1],
        [BERT, antw({ '9': ['ja', '2026-12-20'] })],
      ]),
    });
    s.lesenWirft.set(K1, new Fehler(403));
    expect(await alleAntwortenLesen(port, MODUL, K1)).toEqual({ ok: false, grund: 'kein-recht' });
    s.lesenWirft.set(K1, new Fehler(401));
    expect(await alleAntwortenLesen(port, MODUL, K1)).toEqual({ ok: false, grund: 'abgemeldet' });
  });
});
