import { describe, expect, it } from 'vitest';
import { modulRechteAus, schubladenStand, type EntwurfPort } from './entwuerfe';
import { Fehler } from './einteilen.testutil';
import { MAX_ZEICHEN, type Wert } from '../ct/modulDaten';
import {
  alleAntwortenLesen,
  antwortBereinigt,
  antwortenZusammen,
  antwortenSchublade,
  eigeneAntwortenLesen,
  eigeneAntwortenSchreiben,
  fertigBei,
  fertigBereinigt,
  fertigMarkieren,
  fertigZusammen,
  gleicheAntworten,
  gleichesFertig,
  MAX_FERTIG,
  gleicheVertretungen,
  MAX_NOTIZ,
  neuesterStand,
  personenWertAus,
  vertretungenZusammen,
  vertretungMarkieren,
  vertretungsSchluessel,
  type Antworten,
  type Vertretung,
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

/** Nur die Antworten (ohne `stand`) aus dem Ergebnis von `alleAntwortenLesen`. */
const nurAntworten = (r: Awaited<ReturnType<typeof alleAntwortenLesen>>) =>
  r.ok ? new Map([...r.wert].map(([p, v]) => [p, v.antworten])) : r;

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
        vertretungen: {},
        fertig: {},
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
      wert: { antworten: {}, vertretungen: {}, fertig: {}, stand: null },
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
    expect(nurAntworten(await alleAntwortenLesen(port, MODUL, K1))).toEqual(
      new Map([[ANNA, antw({ '1': ['ja', '2026-12-06'] })]]),
    );
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
    expect(nurAntworten(g)).toEqual(
      new Map([
        [ANNA, A1],
        [BERT, antw({ '9': ['ja', '2026-12-20'] })],
      ]),
    );
    // Der `stand` kommt mit (E5c-3: Grundlage für „neuester gewinnt“ über mehrere Kategorien).
    expect(g.ok && g.wert.get(ANNA)?.stand).toMatch(/^2026-11-18T/);
    s.lesenWirft.set(K1, new Fehler(403));
    expect(await alleAntwortenLesen(port, MODUL, K1)).toEqual({ ok: false, grund: 'kein-recht' });
    s.lesenWirft.set(K1, new Fehler(401));
    expect(await alleAntwortenLesen(port, MODUL, K1)).toEqual({ ok: false, grund: 'abgemeldet' });
  });
});

describe('Notiz und „nur bestimmte Dienste“ (E5c-2)', () => {
  const MIT = (): Antworten => ({
    '1': { a: 'ja', tag: '2026-12-06', notiz: 'nur bis 12 Uhr', dienste: [12, 7] },
    '2': { a: 'vielleicht', tag: '2026-12-13' },
  });
  /** Der Wert, den der Schreiber erzeugt, mit beliebigem Antwort-Inhalt (für kaputte Felder). */
  const roh = (s: ReturnType<typeof speicher>['s'], antworten: unknown) =>
    s.werte.push({
      id: 900,
      dataCategoryId: K1,
      value: JSON.stringify({
        art: 'dienstplaner-verfuegbarkeit',
        fassung: 1,
        person: ANNA,
        antworten,
        stand: '2026-11-18T20:00:00.000Z',
      }),
    });

  it('schreibt Notiz und Dienste und liest sie nach – Dienste aufsteigend, ohne Notiz bleibt das Feld weg', async () => {
    const { port, eigene } = speicher();
    const r = await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, MIT(), HEUTE);
    expect(r).toEqual([{ kategorie: K1, ok: true }]);
    const g = await eigeneAntwortenLesen(port, MODUL, [K1], ANNA);
    expect(g).toMatchObject({
      ok: true,
      wert: {
        antworten: {
          '1': { a: 'ja', tag: '2026-12-06', notiz: 'nur bis 12 Uhr', dienste: [7, 12] },
          '2': { a: 'vielleicht', tag: '2026-12-13' },
        },
      },
    });
    const gespeichert = JSON.parse(eigene(K1, ANNA)[0].value) as { antworten: Antworten };
    expect(gespeichert.antworten['2']).toEqual({ a: 'vielleicht', tag: '2026-12-13' });
  });

  it('alte Werte ohne die Felder bleiben gültig (fassung 1)', () => {
    const { s } = speicher();
    roh(s, { '1': { a: 'ja', tag: '2026-12-06' } });
    expect(personenWertAus(s.werte[0])?.antworten).toEqual({
      '1': { a: 'ja', tag: '2026-12-06' },
    });
  });

  it('kaputte Felder lassen nur das Feld weg, nicht den ganzen Eintrag', () => {
    const { s } = speicher();
    const lang = 'x'.repeat(MAX_NOTIZ + 30);
    roh(s, {
      '1': { a: 'ja', tag: '2026-12-06', notiz: 5, dienste: 'alle' },
      '2': { a: 'ja', tag: '2026-12-06', notiz: '   ', dienste: [] },
      '3': { a: 'ja', tag: '2026-12-06', notiz: lang, dienste: [3, 'x', 3, 1.5, null, 2] },
      '4': { a: 'ja', tag: '2026-12-06', notiz: 'ok', dienste: { 0: 1 } },
    });
    expect(personenWertAus(s.werte[0])?.antworten).toEqual({
      '1': { a: 'ja', tag: '2026-12-06' },
      '2': { a: 'ja', tag: '2026-12-06' },
      '3': { a: 'ja', tag: '2026-12-06', notiz: 'x'.repeat(MAX_NOTIZ), dienste: [2, 3] },
      '4': { a: 'ja', tag: '2026-12-06', notiz: 'ok' },
    });
  });

  it('eine zu lange Notiz wird beim Schreiben gekürzt – und das Nachlesen gilt trotzdem als angekommen', async () => {
    const { port, eigene } = speicher();
    const lang = antw();
    lang['1'] = { a: 'ja', tag: '2026-12-06', notiz: 'y'.repeat(MAX_NOTIZ + 50) };
    const r = await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, lang, HEUTE);
    expect(r).toEqual([{ kategorie: K1, ok: true }]);
    const g = await eigeneAntwortenLesen(port, MODUL, [K1], ANNA);
    expect(g).toMatchObject({
      wert: { antworten: { '1': { notiz: 'y'.repeat(MAX_NOTIZ) } } },
    });
    // Und gespeichert wird schon die gekürzte Fassung, nicht die lange (der Wert hat nur `MAX_ZEICHEN`).
    const stehtDa = JSON.parse(eigene(K1, ANNA)[0].value) as { antworten: Antworten };
    expect(stehtDa.antworten['1'].notiz).toBe('y'.repeat(MAX_NOTIZ));
  });

  it('gleicheAntworten erkennt jeden Unterschied: Notiz, Dienste (Reihenfolge egal), Antwort, Tag', () => {
    const basis = (): Antworten => ({
      '1': { a: 'ja', tag: '2026-12-06', notiz: 'n', dienste: [1, 2] },
    });
    expect(gleicheAntworten(basis(), basis())).toBe(true);
    expect(
      gleicheAntworten(basis(), {
        '1': { a: 'ja', tag: '2026-12-06', notiz: 'n', dienste: [2, 1] },
      }),
    ).toBe(true);
    // Leere Notiz = keine Notiz, leere Dienste = alle.
    expect(
      gleicheAntworten(
        { '1': { a: 'ja', tag: '2026-12-06' } },
        { '1': { a: 'ja', tag: '2026-12-06', notiz: ' ', dienste: [] } },
      ),
    ).toBe(true);
    const abweichung: Antworten[] = [
      { '1': { a: 'ja', tag: '2026-12-06', notiz: 'anders', dienste: [1, 2] } },
      { '1': { a: 'ja', tag: '2026-12-06', dienste: [1, 2] } },
      { '1': { a: 'ja', tag: '2026-12-06', notiz: 'n', dienste: [1] } },
      { '1': { a: 'ja', tag: '2026-12-06', notiz: 'n' } },
      { '1': { a: 'vielleicht', tag: '2026-12-06', notiz: 'n', dienste: [1, 2] } },
      { '1': { a: 'ja', tag: '2026-12-07', notiz: 'n', dienste: [1, 2] } },
    ];
    for (const a of abweichung) expect(gleicheAntworten(basis(), a)).toBe(false);
  });

  it('Nachlesen: ChurchTools behält die Antwort, verliert aber die Notiz → nicht-angekommen (nicht Erfolg)', async () => {
    const { port, s } = speicher();
    // Ein Speicher, der beim Schreiben die Notiz fallen lässt.
    const schreibe = port.schreibe;
    port.schreibe = (pfad, a) => {
      const j = a.json as { value?: string } | undefined;
      if (j?.value) {
        const w = JSON.parse(j.value) as { antworten: Antworten };
        for (const e of Object.values(w.antworten)) delete e.notiz;
        j.value = JSON.stringify(w);
      }
      return schreibe(pfad, a);
    };
    const r = await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, MIT(), HEUTE);
    expect(r).toEqual([{ kategorie: K1, ok: false, grund: 'nicht-angekommen' }]);
    expect(s.werte).toHaveLength(1);
  });

  it('Nachlesen: ChurchTools verliert die Dienste → nicht-angekommen', async () => {
    const { port } = speicher();
    const schreibe = port.schreibe;
    port.schreibe = (pfad, a) => {
      const j = a.json as { value?: string } | undefined;
      if (j?.value) {
        const w = JSON.parse(j.value) as { antworten: Antworten };
        for (const e of Object.values(w.antworten)) delete e.dienste;
        j.value = JSON.stringify(w);
      }
      return schreibe(pfad, a);
    };
    const r = await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, MIT(), HEUTE);
    expect(r).toEqual([{ kategorie: K1, ok: false, grund: 'nicht-angekommen' }]);
  });

  it('antwortBereinigt: eine Stelle für Lesen und Schreiben', () => {
    expect(
      antwortBereinigt({ a: 'ja', tag: '2026-12-06', notiz: '  hi  ', dienste: [5, 5, 3] }),
    ).toEqual({ a: 'ja', tag: '2026-12-06', notiz: 'hi', dienste: [3, 5] });
  });

  it('Größe: eine Antwort mit höchster Notiz und zehn Diensten bleibt unter 300 Zeichen – 30 davon unter dem Wert-Limit', () => {
    const e = antwortBereinigt({
      a: 'vielleicht',
      tag: '2026-12-06',
      notiz: 'ä'.repeat(MAX_NOTIZ),
      dienste: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
    });
    const eintrag = JSON.stringify({ '12345': e }).length;
    expect(eintrag).toBeLessThan(300);
    expect(eintrag * 30).toBeLessThan(MAX_ZEICHEN);
  });
});

describe('Mehrere Kategorien – eine Regel für „eigene“ und „alle“ (E5c-3)', () => {
  /** Alle gelesenen Kategorien als Eingang für `antwortenZusammen` – gelesen mit dem Erzeuger `alleAntwortenLesen`. */
  async function zusammen(port: EntwurfPort, kats: number[]) {
    const je = new Map<number, Map<number, { antworten: Antworten; stand: string }>>();
    for (const k of kats) {
      const r = await alleAntwortenLesen(port, MODUL, k);
      if (r.ok) je.set(k, r.wert);
    }
    return antwortenZusammen(je);
  }

  it('neuesterStand: neuerer gewinnt, bei Gleichstand die kleinere Kategorie – unabhängig von der Reihenfolge', () => {
    const alt = { stand: '2026-11-01T10:00:00.000Z', n: 'alt' };
    const neu = { stand: '2026-11-05T10:00:00.000Z', n: 'neu' };
    expect(neuesterStand([])).toBeNull();
    for (const liste of [
      [
        { kategorie: 1, wert: alt },
        { kategorie: 2, wert: neu },
      ],
      [
        { kategorie: 2, wert: neu },
        { kategorie: 1, wert: alt },
      ],
    ])
      expect(neuesterStand(liste)).toBe(neu);
    const gleich = { ...alt, n: 'gleich' };
    for (const liste of [
      [
        { kategorie: 5, wert: alt },
        { kategorie: 3, wert: gleich },
      ],
      [
        { kategorie: 3, wert: gleich },
        { kategorie: 5, wert: alt },
      ],
    ])
      expect(neuesterStand(liste)).toBe(gleich);
  });

  it('je Person gilt der neueste stand – genau das, was „eigeneAntwortenLesen“ für die Person liefert', async () => {
    const { port, s } = speicher();
    const stand = '2026-11-05T10:00:00.000Z';
    // Anna: K2 neuer. Bert: Gleichstand (K1 gewinnt). Cora: nur in K2.
    s.werte.push(
      wertMit(1, K1, ANNA, antw({ '1': ['ja', '2026-12-06'] }), '2026-11-01T10:00:00.000Z'),
      wertMit(2, K2, ANNA, antw({ '2': ['vielleicht', '2026-12-13'] }), stand),
      wertMit(3, K1, BERT, antw({ '3': ['ja', '2026-12-20'] }), stand),
      wertMit(4, K2, BERT, antw({ '4': ['vielleicht', '2026-12-27'] }), stand),
      wertMit(5, K2, 48, antw({ '5': ['ja', '2026-12-06'] }), stand),
    );
    const alle = await zusammen(port, [K1, K2]);
    expect([...alle.keys()].sort()).toEqual([ANNA, BERT, 48]);
    for (const person of alle.keys()) {
      const eigene = await eigeneAntwortenLesen(port, MODUL, [K1, K2], person);
      expect(eigene.ok && eigene.wert.antworten).toEqual(alle.get(person));
    }
    expect(alle.get(BERT)).toEqual(antw({ '3': ['ja', '2026-12-20'] }));
  });
});

// ── „Vertretung gesucht“ im eigenen Wert (E5c-6) ───────────────────────────────────────────────────────────────────────

const TERMIN = 246;
const TAG = '2026-12-13';
const SCHLUESSEL = vertretungsSchluessel(TERMIN, 9);
const markierung = (extra: Partial<Vertretung> = {}): Vertretung => ({
  dienst: 9,
  gefragt: [BERT, 48],
  seit: '2026-11-18T19:00:00.000Z',
  tag: TAG,
  name: 'Anna Test',
  gefragtNamen: ['Bert Test', 'Finn Test'],
  ...extra,
});

/** Die Markierungen, die für die Person in der Kategorie stehen – gelesen wie das Team sie liest. */
async function markierungen(port: EntwurfPort, kategorien: number[], person = ANNA) {
  const r = await eigeneAntwortenLesen(port, MODUL, kategorien, person);
  return r.ok ? r.wert.vertretungen : null;
}

describe('Vertretung gesucht – Markierung im eigenen Wert', () => {
  it('wird geschrieben und nachgelesen, die Antworten bleiben, wie sie waren (Erzeuger gegen Leser)', async () => {
    const { port } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, A1, HEUTE);
    const r = await vertretungMarkieren(
      port,
      MODUL,
      [K1, K2],
      ANNA,
      { terminId: TERMIN, vertretung: markierung() },
      HEUTE,
    );
    expect(r).toEqual({
      ok: true,
      ergebnisse: [
        { kategorie: K1, ok: true },
        { kategorie: K2, ok: true },
      ],
    });
    expect(await eigeneAntwortenLesen(port, MODUL, [K1, K2], ANNA)).toMatchObject({
      ok: true,
      wert: { antworten: A1, vertretungen: { [SCHLUESSEL]: markierung() } },
    });
    // Das Team liest dieselbe Markierung über „alle Antworten“ und den Zusammenführer.
    const alle = await alleAntwortenLesen(port, MODUL, K1);
    expect(alle.ok && vertretungenZusammen(new Map([[K1, alle.wert]])).get(ANNA)).toEqual({
      [SCHLUESSEL]: markierung(),
    });
  });

  it('Erhalt: Speichern in „Verfügbarkeit“ (nur die Antworten) löscht die Markierung NICHT – in keiner Kategorie', async () => {
    const { port } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, A1, HEUTE);
    await vertretungMarkieren(
      port,
      MODUL,
      [K1, K2],
      ANNA,
      { terminId: TERMIN, vertretung: markierung() },
      HEUTE,
    );
    // So speichert „Verfügbarkeit“: nur Antworten – ohne Wissen von der Markierung (die Seite wurde davor geladen).
    const neu = antw({ '1': ['vielleicht', '2026-12-06'] });
    const r = await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, neu, HEUTE);
    expect(r.every((x) => x.ok)).toBe(true);
    for (const kat of [K1, K2]) {
      expect(await markierungen(port, [kat])).toEqual({ [SCHLUESSEL]: markierung() });
    }
    expect(await eigeneAntwortenLesen(port, MODUL, [K1, K2], ANNA)).toMatchObject({
      wert: { antworten: neu },
    });
  });

  it('Erhalt auch, wenn „Verfügbarkeit“ alle Antworten entfernt: der Wert bleibt wegen der Markierung stehen', async () => {
    const { port, eigene } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    await vertretungMarkieren(
      port,
      MODUL,
      [K1],
      ANNA,
      { terminId: TERMIN, vertretung: markierung() },
      HEUTE,
    );
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, {}, HEUTE)).toEqual([
      { kategorie: K1, ok: true },
    ]);
    expect(eigene(K1, ANNA)).toHaveLength(1);
    expect(await markierungen(port, [K1])).toEqual({ [SCHLUESSEL]: markierung() });
  });

  it('ohne Antworten UND ohne Markierung wird der Wert gelöscht wie bisher', async () => {
    const { port, eigene } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, {}, HEUTE);
    expect(eigene(K1, ANNA)).toHaveLength(0);
  });

  it('Vergangenes fällt aus den Markierungen heraus – beim Speichern der Antworten und beim ausdrücklichen Schreiben', async () => {
    const { port, s } = speicher();
    s.werte.push(
      wertMitMarkierung(1, K1, ANNA, A1, {
        '1:9': markierung({ tag: '2026-11-17' }),
        '2:9': markierung({ tag: HEUTE }),
        [SCHLUESSEL]: markierung(),
      }),
    );
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    expect(Object.keys((await markierungen(port, [K1])) ?? {}).sort()).toEqual(
      ['2:9', SCHLUESSEL].sort(),
    );
    // Ausdrücklich: eine vergangene Markierung kommt gar nicht erst hinein.
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE, {
      '7:9': markierung({ tag: '2026-01-01' }),
    });
    expect(await markierungen(port, [K1])).toEqual({});
  });

  it('abwärtskompatibel: alter Wert ohne Feld gilt; ohne Markierung schreibt der Erzeuger kein Feld', async () => {
    const { port, s } = speicher();
    s.werte.push(wertMit(1, K1, ANNA, A1, '2026-11-02T10:00:00.000Z'));
    expect(await markierungen(port, [K1])).toEqual({});
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    expect(s.werte[0].value).not.toContain('vertretungen');
  });

  it('kaputte Markierungen fallen beim Lesen weg, die übrigen und die Antworten bleiben', async () => {
    const { port, s } = speicher();
    s.werte.push(
      wertMitMarkierung(1, K1, ANNA, A1, {
        gut: markierung(),
        keinDienst: { ...markierung(), dienst: 'neun' },
        schlechterTag: { ...markierung(), tag: 'morgen' },
        ohneZeit: { ...markierung(), seit: '' },
        leer: null,
      } as unknown as Record<string, Vertretung>),
    );
    expect(await markierungen(port, [K1])).toEqual({ gut: markierung() });
    expect(await eigeneAntwortenLesen(port, MODUL, [K1], ANNA)).toMatchObject({
      wert: { antworten: A1 },
    });
  });

  it('dieselbe Suche (Termin und Dienst) ersetzt die frühere; eine zu einem anderen Dienst bleibt', async () => {
    const { port } = speicher();
    await vertretungMarkieren(
      port,
      MODUL,
      [K1],
      ANNA,
      { terminId: TERMIN, vertretung: markierung() },
      HEUTE,
    );
    await vertretungMarkieren(
      port,
      MODUL,
      [K1],
      ANNA,
      { terminId: TERMIN, vertretung: markierung({ dienst: 6 }) },
      HEUTE,
    );
    await vertretungMarkieren(
      port,
      MODUL,
      [K1],
      ANNA,
      { terminId: TERMIN, vertretung: markierung({ gefragt: [], gefragtNamen: [] }) },
      HEUTE,
    );
    const m = await markierungen(port, [K1]);
    expect(Object.keys(m ?? {}).sort()).toEqual([`${TERMIN}:6`, SCHLUESSEL]);
    expect(m?.[SCHLUESSEL].gefragt).toEqual([]);
  });

  it('Lesen scheitert: NICHTS wird geschrieben (ein unbekannter Stand würde die Antworten überschreiben)', async () => {
    const { port, s } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, A1, HEUTE);
    s.auftraege.length = 0;
    s.lesenWirft.set(K1, new Fehler(503));
    s.lesenWirft.set(K2, new Fehler(503));
    expect(
      await vertretungMarkieren(
        port,
        MODUL,
        [K1, K2],
        ANNA,
        { terminId: TERMIN, vertretung: markierung() },
        HEUTE,
      ),
    ).toEqual({ ok: false, grund: 'voruebergehend' });
    expect(s.auftraege).toEqual([]);
  });

  it('eine Kategorie lässt sich nicht schreiben: ihr Ergebnis nennt den Grund, die andere gelingt', async () => {
    const { port, s } = speicher();
    s.schreibenWirft.set(K1, new Fehler(403));
    const r = await vertretungMarkieren(
      port,
      MODUL,
      [K1, K2],
      ANNA,
      { terminId: TERMIN, vertretung: markierung() },
      HEUTE,
    );
    expect(r).toEqual({
      ok: true,
      ergebnisse: [
        { kategorie: K1, ok: false, grund: 'kein-recht' },
        { kategorie: K2, ok: true },
      ],
    });
  });

  it('Markierung verschluckt (200, aber nichts gespeichert): nicht-angekommen – kein Erfolg', async () => {
    const { port, s } = speicher();
    s.verschlucken.add(K1);
    const r = await vertretungMarkieren(
      port,
      MODUL,
      [K1],
      ANNA,
      { terminId: TERMIN, vertretung: markierung() },
      HEUTE,
    );
    expect(r).toEqual({
      ok: true,
      ergebnisse: [{ kategorie: K1, ok: false, grund: 'nicht-angekommen' }],
    });
  });

  it('vertretungenZusammen: je Person gilt derselbe Wert wie bei den Antworten (neuester stand)', () => {
    const alt = {
      antworten: {},
      stand: '2026-11-01T10:00:00.000Z',
      vertretungen: { a: markierung() },
    };
    const neu = { antworten: {}, stand: '2026-11-02T10:00:00.000Z', vertretungen: {} };
    const z = vertretungenZusammen(
      new Map([
        [K1, new Map([[ANNA, alt]])],
        [K2, new Map([[ANNA, neu]])],
      ]),
    );
    expect(z.has(ANNA)).toBe(false); // der neuere Wert hat keine Markierung – sie gilt nicht mehr
    expect(vertretungenZusammen(new Map([[K1, new Map([[ANNA, alt]])]])).get(ANNA)).toEqual({
      a: markierung(),
    });
  });

  it('der index des abgesagten Platzes: hin und zurück (auch null), fehlt er, fehlt das Feld; Unbrauchbares fällt weg', async () => {
    const { port, s } = speicher();
    for (const index of [1, null]) {
      await vertretungMarkieren(
        port,
        MODUL,
        [K1],
        ANNA,
        { terminId: TERMIN, vertretung: markierung({ index }) },
        HEUTE,
      );
      expect((await markierungen(port, [K1]))?.[SCHLUESSEL].index).toBe(index);
    }
    await vertretungMarkieren(
      port,
      MODUL,
      [K1],
      ANNA,
      { terminId: TERMIN, vertretung: markierung({ index: undefined }) },
      HEUTE,
    );
    const alt = (await markierungen(port, [K1]))?.[SCHLUESSEL];
    expect(alt).not.toHaveProperty('index'); // alte Regel: kein gemerkter Platz
    expect(s.werte[0].value).not.toContain('"index"');
    s.werte[0].value = JSON.stringify({
      ...JSON.parse(s.werte[0].value),
      vertretungen: { [SCHLUESSEL]: { ...markierung(), index: 'eins' } },
    });
    expect(await markierungen(port, [K1])).toEqual({
      [SCHLUESSEL]: expect.not.objectContaining({ index: expect.anything() }),
    });
  });

  it('gleicheVertretungen vergleicht alle Felder, nicht die Reihenfolge der Schlüssel', () => {
    const x = { a: markierung(), b: markierung({ dienst: 6 }) };
    expect(gleicheVertretungen(x, { b: x.b, a: x.a })).toBe(true);
    expect(gleicheVertretungen(x, { ...x, a: markierung({ name: 'Anne' }) })).toBe(false);
    expect(gleicheVertretungen(x, { ...x, a: markierung({ gefragt: [BERT] }) })).toBe(false);
    expect(gleicheVertretungen(x, { ...x, a: markierung({ gefragtNamen: ['x'] }) })).toBe(false);
    expect(gleicheVertretungen(x, { ...x, a: markierung({ index: 2 }) })).toBe(false);
    expect(gleicheVertretungen(x, { ...x, a: markierung({ index: 1 }) })).toBe(false); // mit und ohne index sind verschieden
    expect(gleicheVertretungen(x, { a: x.a })).toBe(false);
  });
});

/** Ein Wert mit Markierungen, wie der Schreiber ihn erzeugt – für Fälle, die er nicht erzeugen würde (vergangen, kaputt). */
function wertMitMarkierung(
  id: number,
  kat: number,
  person: number,
  antworten: Antworten,
  vertretungen: Record<string, Vertretung>,
): Wert {
  return {
    id,
    dataCategoryId: kat,
    value: JSON.stringify({
      art: 'dienstplaner-verfuegbarkeit',
      fassung: 1,
      person,
      antworten,
      vertretungen,
      stand: '2026-11-02T10:00:00.000Z',
    }),
  };
}

describe('„Fertig“ bei „Nur abwesend“ – Bestätigung im eigenen Wert (V-4)', () => {
  const ABFRAGE = 'abfrage-1';
  /** Die Bestätigungen, die der Leser der Kategorie `kat` für ANNA sieht. */
  const bestaetigt = async (port: EntwurfPort, kat: number) => {
    const r = await alleAntwortenLesen(port, MODUL, kat);
    return r.ok ? (r.wert.get(ANNA)?.fertig ?? {}) : null;
  };

  it('wird in alle Kategorien geschrieben und nachgelesen – mit Zeitpunkt, ohne ein „Ja“ (Erzeuger gegen Leser)', async () => {
    const { port } = speicher();
    const r = await fertigMarkieren(port, MODUL, [K1, K2], ANNA, ABFRAGE, HEUTE);
    expect(r).toEqual({
      ok: true,
      ergebnisse: [
        { kategorie: K1, ok: true },
        { kategorie: K2, ok: true },
      ],
    });
    for (const kat of [K1, K2]) {
      const f = await bestaetigt(port, kat);
      expect(Object.keys(f ?? {})).toEqual([ABFRAGE]);
      expect(f?.[ABFRAGE]).toMatch(/^2026-11-18T20:00:\d\d\.\d{3}Z$/);
    }
    // Es steht kein Ja/Vielleicht dort: die Antworten sind leer.
    expect(await eigeneAntwortenLesen(port, MODUL, [K1, K2], ANNA)).toMatchObject({
      ok: true,
      wert: { antworten: {} },
    });
  });

  it('die Antworten bleiben, wie sie waren, und fertig kommt dazu', async () => {
    const { port } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, A1, HEUTE);
    await fertigMarkieren(port, MODUL, [K1, K2], ANNA, ABFRAGE, HEUTE);
    expect(await eigeneAntwortenLesen(port, MODUL, [K1, K2], ANNA)).toMatchObject({
      wert: { antworten: A1 },
    });
    expect(Object.keys((await bestaetigt(port, K1)) ?? {})).toEqual([ABFRAGE]);
  });

  it('Erhalt: Speichern in „Verfügbarkeit“ (nur Antworten) löscht die Bestätigung NICHT – in keiner Kategorie', async () => {
    const { port } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1, K2], ANNA, A1, HEUTE);
    await fertigMarkieren(port, MODUL, [K1, K2], ANNA, ABFRAGE, HEUTE);
    const vorher = await bestaetigt(port, K1);
    const r = await eigeneAntwortenSchreiben(
      port,
      MODUL,
      [K1, K2],
      ANNA,
      antw({ '1': ['vielleicht', '2026-12-06'] }),
      HEUTE,
    );
    expect(r.every((x) => x.ok)).toBe(true);
    for (const kat of [K1, K2]) expect(await bestaetigt(port, kat)).toEqual(vorher);
  });

  it('Erhalt auch bei der Vertretungssuche (schreibt mit `fertig: undefined`)', async () => {
    const { port } = speicher();
    await fertigMarkieren(port, MODUL, [K1], ANNA, ABFRAGE, HEUTE);
    const vorher = await bestaetigt(port, K1);
    await vertretungMarkieren(
      port,
      MODUL,
      [K1],
      ANNA,
      {
        terminId: 1,
        vertretung: {
          dienst: 6,
          gefragt: [],
          seit: '2026-11-18T10:00:00.000Z',
          tag: '2026-12-06',
          name: 'Anna',
          gefragtNamen: [],
        },
      },
      HEUTE,
    );
    expect(await bestaetigt(port, K1)).toEqual(vorher);
  });

  it('der Wert bleibt wegen der Bestätigung stehen, auch wenn alle Antworten entfernt werden; ohne alles wird er gelöscht', async () => {
    const { port, eigene } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    await fertigMarkieren(port, MODUL, [K1], ANNA, ABFRAGE, HEUTE);
    expect(await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, {}, HEUTE)).toEqual([
      { kategorie: K1, ok: true },
    ]);
    expect(eigene(K1, ANNA)).toHaveLength(1);
    expect(Object.keys((await bestaetigt(port, K1)) ?? {})).toEqual([ABFRAGE]);
    // Ohne Antworten, Vertretung UND Bestätigung: gelöscht (der Erzeuger mit leerem `fertig` – hier direkt über ein Doppel-Wert-Beispiel).
    const frisch = speicher();
    await eigeneAntwortenSchreiben(frisch.port, MODUL, [K1], ANNA, A1, HEUTE);
    await eigeneAntwortenSchreiben(frisch.port, MODUL, [K1], ANNA, {}, HEUTE);
    expect(frisch.eigene(K1, ANNA)).toHaveLength(0);
  });

  it('abwärtskompatibel: ein alter Wert ohne das Feld gilt (fertig leer); ohne Bestätigung schreibt der Erzeuger kein Feld', async () => {
    const { port, s } = speicher();
    s.werte.push(wertMit(1, K1, ANNA, A1, '2026-11-01T10:00:00.000Z'));
    expect(await bestaetigt(port, K1)).toEqual({});
    await eigeneAntwortenSchreiben(port, MODUL, [K1], ANNA, A1, HEUTE);
    expect(JSON.parse(s.werte[0].value)).not.toHaveProperty('fertig');
  });

  it('ein kaputtes Feld lässt nur das Feld weg – Antworten und Wert bleiben lesbar; ein Wert anderer Fassung bleibt unangetastet', async () => {
    const { port, s } = speicher();
    s.werte.push({
      id: 1,
      dataCategoryId: K1,
      value: JSON.stringify({
        art: 'dienstplaner-verfuegbarkeit',
        fassung: 1,
        person: ANNA,
        antworten: A1,
        fertig: 'kaputt',
        stand: '2026-11-01T10:00:00.000Z',
      }),
    });
    const fremd: Wert = {
      id: 2,
      dataCategoryId: K1,
      value: JSON.stringify({
        art: 'dienstplaner-verfuegbarkeit',
        fassung: 2,
        person: ANNA,
        antworten: {},
        fertig: { x: 'y' },
        stand: '2099-01-01T00:00:00.000Z',
      }),
    };
    s.werte.push(fremd);
    expect(personenWertAus(s.werte[0])?.fertig).toEqual({});
    const r = await fertigMarkieren(port, MODUL, [K1], ANNA, ABFRAGE, HEUTE);
    expect(r).toMatchObject({ ok: true });
    // Der Wert der neuen Fassung ist unlesbar für uns: nicht überschrieben, nicht gelöscht.
    expect(s.werte.find((w) => w.id === 2)).toEqual(fremd);
    expect(Object.keys((await bestaetigt(port, K1)) ?? {})).toEqual([ABFRAGE]);
  });

  it('fertigBereinigt: eine Stelle – falscher Typ → leer, leere/zu lange IDs und Zeiten fallen weg, nur die neuesten MAX_FERTIG bleiben', () => {
    expect(fertigBereinigt(null)).toEqual({});
    expect(fertigBereinigt('x')).toEqual({});
    expect(fertigBereinigt([1])).toEqual({});
    expect(
      fertigBereinigt({
        a: '2026-11-18T10:00:00.000Z',
        '': '2026-11-18T10:00:00.000Z',
        b: '',
        c: 5,
        ['x'.repeat(65)]: '2026-11-18T10:00:00.000Z',
        d: 'z'.repeat(41),
      }),
    ).toEqual({ a: '2026-11-18T10:00:00.000Z' });
    const viele = Object.fromEntries(
      Array.from({ length: MAX_FERTIG + 5 }, (_, i) => [
        `id${i}`,
        `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
      ]),
    );
    const k = fertigBereinigt(viele);
    expect(Object.keys(k)).toHaveLength(MAX_FERTIG);
    expect(k[`id${MAX_FERTIG + 4}`]).toBeDefined(); // die neueste bleibt
    expect(k.id0).toBeUndefined(); // die älteste fällt heraus
  });

  it('fertigBei zählt nur eigene Einträge (nie die Prototyp-Kette) und gleichesFertig ignoriert die Reihenfolge', () => {
    expect(fertigBei({}, 'constructor')).toBe(false);
    expect(fertigBei({ a: '2026-11-18T10:00:00.000Z' }, 'a')).toBe(true);
    expect(fertigBei(undefined, 'a')).toBe(false);
    expect(fertigBei({ a: 'x' }, null)).toBe(false);
    const z1 = '2026-11-18T10:00:00.000Z';
    const z2 = '2026-11-19T10:00:00.000Z';
    expect(gleichesFertig({ a: z1, b: z2 }, { b: z2, a: z1 })).toBe(true);
    expect(gleichesFertig({ a: z1 }, { a: z2 })).toBe(false);
    expect(gleichesFertig({ a: z1 }, {})).toBe(false);
  });

  it('Nachlesen: ChurchTools meldet OK, schreibt aber nichts → nicht-angekommen (kein Erfolg)', async () => {
    const { port, s } = speicher();
    s.verschlucken.add(K1);
    expect(await fertigMarkieren(port, MODUL, [K1], ANNA, ABFRAGE, HEUTE)).toEqual({
      ok: true,
      ergebnisse: [{ kategorie: K1, ok: false, grund: 'nicht-angekommen' }],
    });
  });

  it('Nachlesen: ChurchTools behält den neuen Stand, verliert aber das Feld „fertig“ → nicht-angekommen (nicht Erfolg)', async () => {
    const { port, s } = speicher();
    s.nachSchreiben = () => {
      s.nachSchreiben = null;
      s.werte = s.werte.map((w) => {
        const { fertig: _weg, ...rest } = JSON.parse(w.value) as Record<string, unknown>;
        return { ...w, value: JSON.stringify(rest) };
      });
    };
    const r = await fertigMarkieren(port, MODUL, [K1], ANNA, ABFRAGE, HEUTE);
    expect(r).toEqual({
      ok: true,
      ergebnisse: [{ kategorie: K1, ok: false, grund: 'nicht-angekommen' }],
    });
  });

  it('Nachlesen: ein anderer Schreiber war dazwischen (neuerer Stand) → nicht-angekommen', async () => {
    const { port, s } = speicher();
    s.nachSchreiben = () => {
      s.nachSchreiben = null;
      s.werte.push(wertMit(900, K1, ANNA, {}, '2030-01-01T00:00:00.000Z'));
    };
    const r = await fertigMarkieren(port, MODUL, [K1], ANNA, ABFRAGE, HEUTE);
    expect(r).toMatchObject({
      ok: true,
      ergebnisse: [{ kategorie: K1, ok: false, grund: 'nicht-angekommen' }],
    });
  });

  it('vorübergehender Fehler → voruebergehend (nicht kein-recht); doch angekommen → Erfolg; nichts wird wiederholt', async () => {
    const a = speicher();
    a.s.schreibenWirft.set(K1, new Fehler(503));
    expect(await fertigMarkieren(a.port, MODUL, [K1], ANNA, ABFRAGE, HEUTE)).toEqual({
      ok: true,
      ergebnisse: [{ kategorie: K1, ok: false, grund: 'voruebergehend' }],
    });
    expect(a.s.auftraege.filter((x) => x.kat === K1)).toHaveLength(1);
    const b = speicher();
    b.s.schreibenWirft.set(K1, new Fehler(503));
    b.s.trotzdemSchreiben = true;
    expect(await fertigMarkieren(b.port, MODUL, [K1], ANNA, ABFRAGE, HEUTE)).toEqual({
      ok: true,
      ergebnisse: [{ kategorie: K1, ok: true }],
    });
  });

  it('Lesen scheitert: NICHTS wird geschrieben; kein Recht (403) → kein-recht je Kategorie, die andere gelingt', async () => {
    const a = speicher();
    a.s.lesenWirft.set(K1, new Fehler(503));
    expect(await fertigMarkieren(a.port, MODUL, [K1], ANNA, ABFRAGE, HEUTE)).toEqual({
      ok: false,
      grund: 'voruebergehend',
    });
    expect(a.s.auftraege).toEqual([]);
    const b = speicher();
    b.s.schreibenWirft.set(K1, new Fehler(403));
    expect(await fertigMarkieren(b.port, MODUL, [K1, K2], ANNA, ABFRAGE, HEUTE)).toEqual({
      ok: true,
      ergebnisse: [
        { kategorie: K1, ok: false, grund: 'kein-recht' },
        { kategorie: K2, ok: true },
      ],
    });
  });

  it('ein zweiter Versuch heilt eine Kategorie, in die der erste nicht ankam – der erste Zeitpunkt bleibt', async () => {
    const { port, s } = speicher();
    s.verschlucken.add(K2);
    await fertigMarkieren(port, MODUL, [K1, K2], ANNA, ABFRAGE, HEUTE);
    const zeit = (await bestaetigt(port, K1))?.[ABFRAGE];
    expect(await bestaetigt(port, K2)).toEqual({});
    s.verschlucken.delete(K2);
    const r = await fertigMarkieren(port, MODUL, [K1, K2], ANNA, ABFRAGE, HEUTE);
    expect(r).toMatchObject({ ok: true, ergebnisse: [{ ok: true }, { ok: true }] });
    expect((await bestaetigt(port, K2))?.[ABFRAGE]).toBe(zeit);
  });

  it('fertigZusammen: je Person gilt derselbe Wert wie bei den Antworten (neuester stand); ohne Eintrag fehlt die Person', () => {
    const alt = { antworten: {}, stand: '2026-11-01T10:00:00.000Z', fertig: { a: 'z1' } };
    const neu = { antworten: {}, stand: '2026-11-02T10:00:00.000Z', fertig: {} };
    expect(
      fertigZusammen(
        new Map([
          [K1, new Map([[ANNA, alt]])],
          [K2, new Map([[ANNA, neu]])],
        ]),
      ).has(ANNA),
    ).toBe(false);
    expect(fertigZusammen(new Map([[K1, new Map([[ANNA, alt]])]])).get(ANNA)).toEqual({ a: 'z1' });
    // Gleichstand: die kleinere Kategorie – wie bei den Antworten.
    const gleich = (f: Record<string, string>) => ({
      antworten: {},
      stand: '2026-11-02T10:00:00.000Z',
      fertig: f,
    });
    expect(
      fertigZusammen(
        new Map([
          [K2, new Map([[ANNA, gleich({ k2: 'z' })]])],
          [K1, new Map([[ANNA, gleich({ k1: 'z' })]])],
        ]),
      ).get(ANNA),
    ).toEqual({ k1: 'z' });
  });
});
