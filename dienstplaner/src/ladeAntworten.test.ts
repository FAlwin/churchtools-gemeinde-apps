import { describe, expect, it } from 'vitest';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import type { Wert } from '@shared/ct/modulDaten';
import { Fehler } from '@shared/dienstplan/einteilen.testutil';
import { modulRechteAus, type EntwurfPort } from '@shared/dienstplan/entwuerfe';
import {
  antwortenSchublade,
  eigeneAntwortenLesen,
  eigeneAntwortenSchreiben,
  fertigMarkieren,
  type Antworten,
} from '@shared/dienstplan/verfuegbarkeit';
import { antwortenLesen, GLEICHZEITIG, ladeAntworten } from './ladeAntworten';

/**
 * Lader der Antworten für „Personen“ (E5c-3). Die Werte kommen vom Erzeuger (`eigeneAntwortenSchreiben`) in einen
 * nachgebauten Speicher mit mehreren Kategorien – keine handgeschriebenen Wert-Texte.
 */
const MODUL = 16;
const HEUTE = '2026-11-18';
const ANNA = 46;
const BERT = 47;
const GRUPPEN: Dienstgruppe[] = [1, 2, 3, 4, 5, 6, 7].map((id) => ({
  id,
  name: `Gruppe ${id}`,
  fuerAlle: false,
}));
/** Kategorie-ID je Dienstgruppe – die Kürzel kommen vom Erzeuger (`antwortenSchublade`). */
const KAT = (g: Dienstgruppe) => 30 + g.id;
const liste = (gruppen: Dienstgruppe[]) =>
  gruppen.map((g) => ({ id: KAT(g), shorty: antwortenSchublade(g).kuerzel }));
const sehen = (gruppen: Dienstgruppe[]) => modulRechteAus({ 'view custom data': gruppen.map(KAT) });

const antw = (x: Record<string, ['ja' | 'vielleicht', string]>): Antworten =>
  Object.fromEntries(Object.entries(x).map(([t, [a, tag]]) => [t, { a, tag }]));

function speicher() {
  let naechste = 100;
  let uhr = 0;
  const s = {
    werte: [] as Wert[],
    lesenWirft: new Map<number, Fehler>(),
    gelesen: [] as number[],
    gleichzeitig: 0,
    hoechstens: 0,
  };
  const katAus = (pfad: string) => Number(/customdatacategories\/(\d+)/.exec(pfad)![1]);
  const port: EntwurfPort = {
    kuerzel: () => 'dienstplaner',
    daten: async <T>(pfad: string) => {
      const kat = katAus(pfad);
      s.gelesen.push(kat);
      s.gleichzeitig++;
      s.hoechstens = Math.max(s.hoechstens, s.gleichzeitig);
      await new Promise((r) => setTimeout(r, 1));
      s.gleichzeitig--;
      const f = s.lesenWirft.get(kat);
      if (f) throw f;
      return structuredClone(s.werte.filter((w) => w.dataCategoryId === kat)) as T;
    },
    schreibe: (pfad, a) => {
      const kat = katAus(pfad);
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
  const schreibe = async (kats: number[], person: number, a: Antworten, stand?: string) => {
    if (stand) {
      // Ein Wert mit eigenem `stand` (für „neuer / älter“) – über den Erzeuger, dann den Zeitpunkt festlegen.
      const alt = port.jetzt;
      port.jetzt = () => stand;
      await eigeneAntwortenSchreiben(port, MODUL, kats, person, a, HEUTE);
      port.jetzt = alt;
    } else await eigeneAntwortenSchreiben(port, MODUL, kats, person, a, HEUTE);
  };
  return { s, port, schreibe };
}

const A1 = antw({ '1': ['ja', '2026-12-06'] });
const A2 = antw({ '2': ['vielleicht', '2026-12-13'] });

describe('antwortenLesen – „Fertig“ für die Planer (V-4)', () => {
  it('die Bestätigungen kommen je Person mit (derselbe Wert wie die Antworten); wer nie bestätigt hat, fehlt in der Liste', async () => {
    const { port, schreibe } = speicher();
    const [g1] = GRUPPEN;
    await schreibe([KAT(g1)], ANNA, A1);
    await fertigMarkieren(port, MODUL, [KAT(g1)], BERT, 'a1', HEUTE);
    const r = await antwortenLesen(port, MODUL, sehen([g1]), liste([g1]), [g1]);
    expect([...(r.fertig ?? new Map()).keys()]).toEqual([BERT]);
    expect(Object.keys(r.fertig?.get(BERT) ?? {})).toEqual(['a1']);
    // Bert hat nur bestätigt – kein Ja: seine Antworten sind leer.
    expect(r.jePerson.get(BERT)).toEqual({});
    expect(r.jePerson.get(ANNA)).toEqual(A1);
  });
});

describe('antwortenLesen – Zweige einzeln', () => {
  it('liest alle Personen einer Dienstgruppe; sichtbar ist genau die gelesene Gruppe', async () => {
    const { port, schreibe } = speicher();
    const [g1] = GRUPPEN;
    await schreibe([KAT(g1)], ANNA, A1);
    await schreibe([KAT(g1)], BERT, A2);
    const r = await antwortenLesen(port, MODUL, sehen([g1]), liste([g1]), [g1]);
    expect(r.jePerson).toEqual(
      new Map([
        [ANNA, A1],
        [BERT, A2],
      ]),
    );
    expect([...r.sichtbar]).toEqual([g1.id]);
  });

  it('zum Lesen genügt „sehen“ – es muss nicht „bereit“ (sehen, ändern, löschen) sein', async () => {
    const { port, schreibe } = speicher();
    const [g1] = GRUPPEN;
    await schreibe([KAT(g1)], ANNA, A1);
    const nurSehen = modulRechteAus({ 'view custom data': [KAT(g1)] }); // kein Ändern, kein Löschen
    const r = await antwortenLesen(port, MODUL, nurSehen, liste([g1]), [g1]);
    expect(r.sichtbar.has(g1.id)).toBe(true);
    expect(r.jePerson.get(ANNA)).toEqual(A1);
  });

  it('Kategorie fehlt oder kein Recht „sehen“ → nicht sichtbar, kein Lesen, kein Fehler (dauerhaft)', async () => {
    const { port, s } = speicher();
    const [g1, g2, g3] = GRUPPEN;
    const r = await antwortenLesen(
      port,
      MODUL,
      sehen([g1]), // g2: Kategorie da, aber kein Recht; g3: Kategorie fehlt ganz
      liste([g1, g2]),
      [g1, g2, g3],
    );
    expect([...r.sichtbar]).toEqual([g1.id]);
    expect(s.gelesen).toEqual([KAT(g1)]); // nur die sichtbare wurde gelesen
  });

  it('ChurchTools verweigert das Lesen (403) → die Gruppe ist nicht sichtbar, dauerhaft', async () => {
    const { port, s, schreibe } = speicher();
    const [g1, g2] = GRUPPEN;
    await schreibe([KAT(g1)], ANNA, A1);
    s.lesenWirft.set(KAT(g2), new Fehler(403));
    const r = await antwortenLesen(port, MODUL, sehen([g1, g2]), liste([g1, g2]), [g1, g2]);
    expect([...r.sichtbar]).toEqual([g1.id]);
    expect(r.jePerson.get(ANNA)).toEqual(A1);
  });

  it.each([
    ['Netz (keine Antwort)', null],
    ['Server 503', 503],
    ['gebremst 429', 429],
    ['Server 500', 500],
  ])('vorübergehend (%s) → wirft, nie „keine Antworten“', async (_n, status) => {
    const { port, s, schreibe } = speicher();
    const [g1, g2] = GRUPPEN;
    await schreibe([KAT(g1)], ANNA, A1);
    s.lesenWirft.set(KAT(g2), new Fehler(status));
    // Kein Teilergebnis: die eine Gruppe ginge, die andere nicht – das Ganze wirft, der Aufrufer behält das Bisherige.
    await expect(
      antwortenLesen(port, MODUL, sehen([g1, g2]), liste([g1, g2]), [g1, g2]),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('401 (abgemeldet) wirft mit Status 401 – auch wenn eine andere Gruppe nur vorübergehend scheitert', async () => {
    const { port, s } = speicher();
    const [g1, g2] = GRUPPEN;
    s.lesenWirft.set(KAT(g1), new Fehler(503));
    s.lesenWirft.set(KAT(g2), new Fehler(401));
    await expect(
      antwortenLesen(port, MODUL, sehen([g1, g2]), liste([g1, g2]), [g1, g2]),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('eine Gruppe doppelt genannt wird einmal gelesen; höchstens GLEICHZEITIG Kategorien zugleich', async () => {
    const { port, s } = speicher();
    await antwortenLesen(port, MODUL, sehen(GRUPPEN), liste(GRUPPEN), [...GRUPPEN, GRUPPEN[0]]);
    expect(s.gelesen).toHaveLength(GRUPPEN.length);
    expect(s.hoechstens).toBeLessThanOrEqual(GLEICHZEITIG);
    expect(s.hoechstens).toBeGreaterThan(1);
  });
});

describe('antwortenLesen – mehrere Kategorien (eine Regel mit den eigenen Antworten)', () => {
  it('je Person gilt der neueste stand – und es ist genau das, was eigeneAntwortenLesen für die Person liefert', async () => {
    const { port, schreibe } = speicher();
    const [g1, g2] = GRUPPEN;
    // Anna schreibt in beide Dienstgruppen (verschiedene Zeiten, z. B. weil ein Schreiben nur halb gelang): g2 ist neuer.
    await schreibe([KAT(g1)], ANNA, A1, '2026-11-01T10:00:00.000Z');
    await schreibe([KAT(g2)], ANNA, A2, '2026-11-05T10:00:00.000Z');
    // Bert: Gleichstand – die kleinere Kategorie-ID gewinnt.
    await schreibe([KAT(g2)], BERT, A2, '2026-11-05T10:00:00.000Z');
    await schreibe([KAT(g1)], BERT, A1, '2026-11-05T10:00:00.000Z');
    const r = await antwortenLesen(port, MODUL, sehen([g1, g2]), liste([g1, g2]), [g1, g2]);
    expect(r.jePerson.get(ANNA)).toEqual(A2);
    expect(r.jePerson.get(BERT)).toEqual(A1);
    for (const person of [ANNA, BERT]) {
      const eigene = await eigeneAntwortenLesen(port, MODUL, [KAT(g1), KAT(g2)], person);
      expect(eigene.ok && eigene.wert.antworten).toEqual(r.jePerson.get(person));
    }
  });
});

describe('ladeAntworten', () => {
  it('ohne Dienstgruppen: nichts sichtbar, kein Netzaufruf', async () => {
    const r = await ladeAntworten([]);
    expect(r.sichtbar.size).toBe(0);
    expect(r.jePerson.size).toBe(0);
  });
});
