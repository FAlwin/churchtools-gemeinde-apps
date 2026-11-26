import { describe, expect, it } from 'vitest';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import type { Dienst } from '@shared/ct/dienste';
import type { Wert } from '@shared/ct/modulDaten';
import { Fehler } from '@shared/dienstplan/einteilen.testutil';
import { modulRechteAus, type EntwurfPort } from '@shared/dienstplan/entwuerfe';
import {
  antwortenSchublade,
  eigeneAntwortenSchreiben,
  vertretungMarkieren,
  type Antworten,
} from '@shared/dienstplan/verfuegbarkeit';
import {
  KEINE_VERFUEGBARKEIT,
  einrichtbareGruppen,
  verfuegbarkeitHinweis,
  verfuegbarkeitLesen,
  verfuegbarkeitSpeichern,
} from './ladeVerfuegbarkeit';
import { eigeneDienste, eigeneDienstgruppen } from './start';

const MODUL = 16;
const ICH = 19;
const HEUTE = '2026-11-18';

const TECHNIK: Dienstgruppe = { id: 3, name: 'Technik', fuerAlle: false };
const MUSIK: Dienstgruppe = { id: 4, name: 'Musik', fuerAlle: false };
const PROGRAMM: Dienstgruppe = { id: 1, name: 'Programm', fuerAlle: false };

/** Kategorie-IDs – die Kürzel kommen vom Erzeuger (`antwortenSchublade`), nicht von Hand. */
const KAT: Record<number, number> = { [TECHNIK.id]: 30, [MUSIK.id]: 31 };
const kategorienListe = (gruppen: Dienstgruppe[]) =>
  gruppen.map((g) => ({
    id: KAT[g.id],
    shorty: antwortenSchublade(g).kuerzel,
  }));

const antw = (x: Record<string, ['ja' | 'vielleicht', string]>): Antworten =>
  Object.fromEntries(Object.entries(x).map(([t, [a, tag]]) => [t, { a, tag }]));

/** Ein kleiner Speicher mit mehreren Kategorien. */
function speicher() {
  let naechste = 100;
  let uhr = 0;
  const s = {
    werte: [] as Wert[],
    /** Je Kategorie: Lesen wirft. */
    lesenWirft: new Map<number, Fehler>(),
    /** Je Kategorie: Schreiben wirft, ohne etwas zu schreiben. */
    schreibenWirft: new Map<number, Fehler>(),
  };
  const katAus = (pfad: string) => Number(/customdatacategories\/(\d+)/.exec(pfad)![1]);
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
      const f = s.schreibenWirft.get(kat);
      if (f) return Promise.reject(f);
      const id = Number(pfad.split('/').pop());
      if (a.method === 'POST') {
        s.werte.push({
          id: naechste++,
          dataCategoryId: kat,
          value: (a.json as { value: string }).value,
        });
      } else {
        const i = s.werte.findIndex((w) => w.id === id && w.dataCategoryId === kat);
        if (i < 0) return Promise.reject(new Fehler(404));
        if (a.method === 'PUT')
          s.werte[i] = { ...s.werte[i], value: (a.json as { value: string }).value };
        else s.werte.splice(i, 1);
      }
      return Promise.resolve();
    },
    fehler: (status, meldung) => Object.assign(new Fehler(status), { message: meldung }),
    istKeinRecht: (e) => e instanceof Fehler && e.status === 403,
    istNichtGefunden: (e) => e instanceof Fehler && e.status === 404,
    istAbgemeldet: (e) => e instanceof Fehler && e.status === 401,
    jetzt: () => `2026-11-18T20:00:${String(uhr++).padStart(2, '0')}.000Z`,
  };
  return { s, port };
}

const RECHTE_ALLE = modulRechteAus({
  'view custom data': [30, 31],
  'create custom data': [30, 31],
  'edit custom data': [30, 31],
  'delete custom data': [30, 31],
});

describe('eigeneDienstgruppen – wer in welcher Dienstgruppe ist', () => {
  const dienst = (id: number, dienstgruppeId: number, gruppenIds: number[]): Dienst => ({
    id,
    name: `Dienst ${id}`,
    dienstgruppeId,
    gruppenIds,
    sortKey: id,
    liveSteuern: false,
    absagen: true,
  });
  const start = (meineGruppen: number[]) => ({
    gruppen: meineGruppen.map((id) => ({ id, name: `G${id}`, leitung: false })),
    dienstgruppen: [PROGRAMM, TECHNIK, MUSIK],
    dienste: new Map([
      [1, dienst(1, 1, [6])],
      [6, dienst(6, 3, [7])],
      [7, dienst(7, 3, [7])],
      [9, dienst(9, 4, [9])],
      [10, dienst(10, 4, [9, 12])],
    ]),
  });

  it('Mitglied einer CT-Gruppe, die an einem Dienst der Dienstgruppe hängt', () => {
    expect(eigeneDienstgruppen(start([7]))).toEqual([TECHNIK]);
    expect(eigeneDienstgruppen(start([12]))).toEqual([MUSIK]);
  });

  it('mehrere – in der Reihenfolge der Gemeinde; keine Gruppe, die an keinem Dienst hängt → nichts', () => {
    expect(eigeneDienstgruppen(start([9, 7]))).toEqual([TECHNIK, MUSIK]);
    expect(eigeneDienstgruppen(start([99]))).toEqual([]);
    expect(eigeneDienstgruppen(start([]))).toEqual([]);
  });

  it('eigeneDienste (E5c-2): die Dienste, an denen eine eigene CT-Gruppe hängt – in der Reihenfolge der Gemeinde', () => {
    expect(eigeneDienste(start([7])).map((d) => d.id)).toEqual([6, 7]);
    expect(eigeneDienste(start([12])).map((d) => d.id)).toEqual([10]);
    expect(eigeneDienste(start([9, 7])).map((d) => d.id)).toEqual([6, 7, 9, 10]);
    expect(eigeneDienste(start([99]))).toEqual([]);
  });

  it('die Dienstgruppen sind genau die der eigenen Dienste (eine Regel, nicht zwei)', () => {
    for (const meine of [[7], [12], [9, 7], [6], [99], []]) {
      const s = start(meine);
      const ausDiensten = new Set(eigeneDienste(s).map((d) => d.dienstgruppeId));
      expect(eigeneDienstgruppen(s).map((g) => g.id)).toEqual(
        s.dienstgruppen.map((g) => g.id).filter((id) => ausDiensten.has(id)),
      );
    }
  });
});

describe('verfuegbarkeitLesen – bereit, gesperrt, einrichtbar', () => {
  it('liest die eigenen Antworten aus allen bereiten Kategorien (Werte vom Schreiber erzeugt)', async () => {
    const { port } = speicher();
    const A = antw({ '1': ['ja', '2026-12-06'], '2': ['vielleicht', '2026-12-13'] });
    await eigeneAntwortenSchreiben(port, MODUL, [30, 31], ICH, A, HEUTE);
    const v = await verfuegbarkeitLesen(
      port,
      MODUL,
      RECHTE_ALLE,
      kategorienListe([TECHNIK, MUSIK]),
      [TECHNIK, MUSIK],
      ICH,
    );
    expect(v.bereit).toEqual([30, 31]);
    expect(v.antworten).toEqual(A);
    expect(v.lesefehler).toBeNull();
    expect(verfuegbarkeitHinweis(v)).toBeNull();
  });

  it('nur die bereiten Kategorien zählen: „nur lesen“ und „fehlt“ sind nicht dabei', async () => {
    const { port } = speicher();
    const rechte = modulRechteAus({
      'view custom data': [30, 31],
      'create custom data': [30],
      'edit custom data': [30],
      'delete custom data': [30],
    });
    const v = await verfuegbarkeitLesen(
      port,
      MODUL,
      rechte,
      kategorienListe([TECHNIK, MUSIK]),
      [TECHNIK, MUSIK],
      ICH,
    );
    expect(v.bereit).toEqual([30]);
    expect(v.gruppen.map((z) => z.stand)).toEqual(['bereit', 'nur-lesen']);
  });

  it('keine bereite Kategorie → gesperrt mit Hinweis; ohne Recht zum Anlegen kein „Einrichten“', async () => {
    const { port } = speicher();
    const v = await verfuegbarkeitLesen(
      port,
      MODUL,
      modulRechteAus({}),
      kategorienListe([TECHNIK]),
      [TECHNIK],
      ICH,
    );
    expect(v.bereit).toEqual([]);
    expect(verfuegbarkeitHinweis(v)).toContain('noch nicht eingerichtet');
    expect(verfuegbarkeitHinweis(v)).toContain('Nein geht schon');
    expect(einrichtbareGruppen(v)).toEqual([]);
  });

  it('darf man Kategorien anlegen und fehlt die Schublade → „Einrichten“ für diese Gruppen', async () => {
    const { port } = speicher();
    const v = await verfuegbarkeitLesen(
      port,
      MODUL,
      modulRechteAus({ 'create custom category': true }),
      [],
      [TECHNIK, MUSIK],
      ICH,
    );
    expect(v.gruppen.map((z) => z.stand)).toEqual(['einrichtbar', 'einrichtbar']);
    expect(einrichtbareGruppen(v)).toEqual([TECHNIK, MUSIK]);
  });

  it('ist schon eine Schublade bereit, wird nichts zum Einrichten angeboten', async () => {
    const { port } = speicher();
    const v = await verfuegbarkeitLesen(
      port,
      MODUL,
      modulRechteAus({
        'create custom category': true,
        'view custom data': [30],
        'create custom data': [30],
        'edit custom data': [30],
        'delete custom data': [30],
      }),
      kategorienListe([TECHNIK]),
      [TECHNIK, MUSIK],
      ICH,
    );
    expect(v.bereit).toEqual([30]);
    expect(einrichtbareGruppen(v)).toEqual([]);
  });

  it('Lesefehler (vorübergehend) → Ja/Vielleicht gesperrt, Hinweis nennt den Grund, es wird nicht geschrieben', async () => {
    const { port, s } = speicher();
    s.lesenWirft.set(30, new Fehler(504));
    const v = await verfuegbarkeitLesen(
      port,
      MODUL,
      RECHTE_ALLE,
      kategorienListe([TECHNIK]),
      [TECHNIK],
      ICH,
    );
    expect(v.lesefehler).toBe('voruebergehend');
    expect(verfuegbarkeitHinweis(v)).toContain('antwortet gerade nicht');
    // Auch wenn ChurchTools inzwischen wieder antwortet: Auf einem unbekannten Stand wird nicht geschrieben (die Antworten
    // stehen als Ganzes in einem Wert – blind schreiben überschriebe, was dort schon steht).
    s.lesenWirft.clear();
    const r = await verfuegbarkeitSpeichern(
      port,
      v,
      ICH,
      antw({ '1': ['ja', '2026-12-06'] }),
      HEUTE,
    );
    expect(r.ok).toBe(false);
    expect(s.werte).toEqual([]);
  });

  it('ohne eigene Dienstgruppe: gesperrt mit eigenem Hinweis', () => {
    expect(KEINE_VERFUEGBARKEIT.bereit).toEqual([]);
    expect(verfuegbarkeitHinweis(KEINE_VERFUEGBARKEIT)).toContain('in keiner Dienstgruppe');
  });
});

describe('verfuegbarkeitSpeichern – ehrlich je Dienstgruppe', () => {
  const lage = async (port: EntwurfPort) =>
    verfuegbarkeitLesen(
      port,
      MODUL,
      RECHTE_ALLE,
      kategorienListe([TECHNIK, MUSIK]),
      [TECHNIK, MUSIK],
      ICH,
    );
  const A = antw({ '1': ['ja', '2026-12-06'] });

  it('in alle bereiten dasselbe; Ergebnis ok, danach lesbar', async () => {
    const { port } = speicher();
    const v = await lage(port);
    expect(await verfuegbarkeitSpeichern(port, v, ICH, A, HEUTE)).toEqual({ ok: true });
    expect((await lage(port)).antworten).toEqual(A);
  });

  it('E5c-6: Speichern aus „Verfügbarkeit“ behält die Markierung „Vertretung gesucht“ – auch wenn sie erst NACH dem Laden der Seite entstand', async () => {
    const { port } = speicher();
    await eigeneAntwortenSchreiben(port, MODUL, [30, 31], ICH, A, HEUTE);
    // Die Seite lädt ihren Stand (ohne Markierung) …
    const v = await lage(port);
    expect(v.vertretungen).toEqual({});
    // … dann sucht die Person in einem anderen Fenster eine Vertretung …
    const gesucht = {
      dienst: 9,
      gefragt: [47],
      seit: '2026-11-18T19:00:00.000Z',
      tag: '2026-12-13',
      name: 'Spike',
      gefragtNamen: ['Ben'],
    };
    await vertretungMarkieren(
      port,
      MODUL,
      [30, 31],
      ICH,
      { terminId: 246, vertretung: gesucht },
      HEUTE,
    );
    // … und speichert dann in „Verfügbarkeit“ (die Seite weiß nichts von der Markierung).
    const neu = antw({ '2': ['vielleicht', '2026-12-13'] });
    expect(await verfuegbarkeitSpeichern(port, v, ICH, neu, HEUTE)).toEqual({ ok: true });
    const danach = await lage(port);
    expect(danach.antworten).toEqual(neu);
    expect(danach.vertretungen).toEqual({ '246:9': gesucht });
  });

  it('nur eine Gruppe scheitert → die andere steht, die Meldung nennt die gescheiterte und den Grund', async () => {
    const { port, s } = speicher();
    const v = await lage(port);
    s.schreibenWirft.set(31, new Fehler(403));
    const r = await verfuegbarkeitSpeichern(port, v, ICH, A, HEUTE);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.text).toContain('nur zum Teil');
    expect(r.text).toContain('„Musik“');
    expect(r.text).not.toContain('„Technik“');
    expect(r.text).toContain('erlaubt es dir nicht');
    expect(s.werte.filter((w) => w.dataCategoryId === 30)).toHaveLength(1);
  });

  it('vorübergehender Fehler ist NICHT „kein Recht“ – eigener Text', async () => {
    const { port, s } = speicher();
    const v = await lage(port);
    s.schreibenWirft.set(30, new Fehler(504));
    s.schreibenWirft.set(31, new Fehler(504));
    const r = await verfuegbarkeitSpeichern(port, v, ICH, A, HEUTE);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.text).toContain('antwortet gerade nicht');
    expect(r.text).not.toContain('erlaubt es dir nicht');
    expect(r.text).not.toContain('nur zum Teil'); // alle scheitern → kein „Teil“
    expect(r.text).toContain('„Technik“');
    expect(r.text).toContain('„Musik“');
  });
});
