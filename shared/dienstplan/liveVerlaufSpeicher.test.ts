import { describe, expect, it } from 'vitest';
import { liveListe } from '../ct/liveAgenda';
import { wechselAus, zusammenfuehren, type Wechsel } from '../ct/liveVerlauf';
import type { Wert } from '../ct/modulDaten';
import type { VersionPort } from '../ct/versionierterWert';
import type { CtAgendaItem } from '../ct/typen';
import { Fehler } from './einteilen.testutil';
import { KAT, MODUL, speicher } from './entwuerfe.testutil';
import {
  VERLAUF_KATEGORIE,
  VERLAUF_VERSUCHE,
  verlaufLesen,
  verlaufSchreiben,
  verlaufText,
  wechselAusWert,
} from './liveVerlaufSpeicher';

const modul = () => Promise.resolve(MODUL);
const T0 = Date.parse('2027-03-07T09:00:00Z');
const TERMIN = 216;

const liste = liveListe(
  ['A', 'B', 'C'].map(
    (titel, i): CtAgendaItem => ({
      id: 100 + i,
      title: titel,
      type: 'text',
      duration: 300,
      startTimes: { '216': new Date(T0 + i * 300_000).toISOString() },
    }),
  ),
  TERMIN,
);
/** Ein Wechsel in der Form des Werts – über den Text des Erzeugers. */
const zuA = (x: Wechsel) =>
  (JSON.parse(verlaufText(TERMIN, [x]) as string) as { wechsel: unknown[] }).wechsel[0];
const w = (stelle: number, sek: number, extra: Partial<Wechsel> = {}): Wechsel => ({
  ...wechselAus(liste, stelle, T0 + sek * 1000),
  ...extra,
});

/** Der Wert, so wie die App ihn ablegt – über den Erzeuger, nicht von Hand. */
const wertMit = (id: number, wechsel: Wechsel[], termin = TERMIN): Wert => ({
  id,
  dataCategoryId: KAT,
  value: verlaufText(termin, wechsel) as string,
});

/** Speicher samt Kategorien-Liste (`POST …/customdatacategories` legt die Kategorie an, ID `KAT`). */
function aufbau(mitKategorie = true, werte: Wert[] = []) {
  const { s, port } = speicher(werte);
  const k = {
    kategorien: mitKategorie
      ? [{ id: KAT, shorty: VERLAUF_KATEGORIE.kuerzel, name: VERLAUF_KATEGORIE.name }]
      : [],
    lesenWirft: null as Fehler | null,
    anlegenVerschlucken: false,
    angelegt: 0,
  };
  const p: VersionPort = {
    ...port,
    daten: <T>(pfad: string) => {
      if (pfad === `/custommodules/${MODUL}/customdatacategories`) {
        return k.lesenWirft
          ? Promise.reject(k.lesenWirft)
          : Promise.resolve(structuredClone(k.kategorien) as T);
      }
      return port.daten<T>(pfad);
    },
    schreibe: (pfad, a) => {
      if (pfad === `/custommodules/${MODUL}/customdatacategories`) {
        k.angelegt++;
        if (!k.anlegenVerschlucken) {
          k.kategorien.push({
            id: KAT,
            shorty: (a.json as { shorty: string }).shorty,
            name: (a.json as { name: string }).name,
          });
        }
        return Promise.resolve();
      }
      return port.schreibe(pfad, a);
    },
  };
  return { s, k, p };
}

/** Was in den Werten des Termins steht (alle Werte zusammengeführt). */
const gespeichert = (werte: readonly Wert[], termin = TERMIN) =>
  werte.reduce<Wechsel[]>((acc, x) => zusammenfuehren(acc, wechselAusWert(x, termin) ?? []), []);

describe('wechselAusWert', () => {
  it('liest, was die App ablegt (über den Erzeuger)', () => {
    const wechsel = [w(1, 0), w(2, 300, { zusatzDavor: 30, ausgleich: -4, neu: true })];
    expect(wechselAusWert(wertMit(1, wechsel), TERMIN)).toEqual(wechsel);
  });

  it('ein Wert eines anderen Termins oder eines anderen Formats gehört nicht dazu', () => {
    expect(wechselAusWert(wertMit(1, [w(1, 0)], 999), TERMIN)).toBeNull();
    expect(wechselAusWert({ id: 1, dataCategoryId: KAT, value: '{"art":"x"}' }, TERMIN)).toBeNull();
    expect(wechselAusWert({ id: 1, dataCategoryId: KAT, value: 'kein json' }, TERMIN)).toBeNull();
    expect(
      wechselAusWert(
        {
          id: 1,
          dataCategoryId: KAT,
          value: JSON.stringify({
            art: 'dienstplaner-live-verlauf',
            fassung: 2,
            terminId: TERMIN,
            wechsel: [],
          }),
        },
        TERMIN,
      ),
    ).toBeNull();
  });

  it('einzelne beschädigte Wechsel entfallen, die anderen bleiben', () => {
    const wert = {
      id: 1,
      dataCategoryId: KAT,
      value: JSON.stringify({
        art: 'dienstplaner-live-verlauf',
        fassung: 1,
        terminId: TERMIN,
        wechsel: [zuA(w(1, 0)), { s: 'x' }, null, zuA(w(2, 5))],
      }),
    };
    expect(wechselAusWert(wert, TERMIN)).toEqual([w(1, 0), w(2, 5)]);
  });
});

describe('verlaufText', () => {
  it('ohne Titel, wenn es sonst nicht in einen Wert passt – mit Punkt-ID', () => {
    const viele = Array.from({ length: 150 }, (_, i) =>
      w((i % 3) + 1, i * 40, { titel: 'Ein ziemlich langer Titel eines Punkts' }),
    );
    const text = verlaufText(TERMIN, viele) as string;
    expect(text.length).toBeLessThanOrEqual(10_000);
    expect(JSON.parse(text).wechsel[0]).toMatchObject({ t: '', p: liste[0].id });
  });

  it('passt auch das nicht, gibt es keinen Text', () => {
    const riesig = Array.from({ length: 2000 }, (_, i) => w(1, i));
    expect(verlaufText(TERMIN, riesig)).toBeNull();
  });
});

describe('verlaufLesen', () => {
  it('keine Kategorie (oder keine zu sehen) = kein Verlauf, kein Fehler', async () => {
    const { p } = aufbau(false);
    expect(await verlaufLesen(p, modul, TERMIN)).toEqual({
      ok: true,
      wechsel: [],
      vorhanden: false,
    });
  });

  it('Kategorie ohne Wert für den Termin = kein Verlauf', async () => {
    const { p } = aufbau(true, [wertMit(100, [w(1, 0)], 999)]);
    expect(await verlaufLesen(p, modul, TERMIN)).toEqual({
      ok: true,
      wechsel: [],
      vorhanden: false,
    });
  });

  it('liest die Wechsel des Termins', async () => {
    const { p } = aufbau(true, [wertMit(100, [w(1, 0), w(2, 300)]), wertMit(101, [w(1, 7)], 999)]);
    expect(await verlaufLesen(p, modul, TERMIN)).toEqual({
      ok: true,
      wechsel: [w(1, 0), w(2, 300)],
      vorhanden: true,
    });
  });

  it('zwei Werte desselben Termins (zwei Erst-Anleger) werden vereint', async () => {
    const { p } = aufbau(true, [
      wertMit(100, [w(1, 0), w(2, 300)]),
      wertMit(101, [w(1, 0), w(3, 600)]),
    ]);
    const r = await verlaufLesen(p, modul, TERMIN);
    expect(r.ok && r.wechsel.map((x) => x.stelle)).toEqual([1, 2, 3]);
  });

  it.each([
    [new Fehler(401), 'abgemeldet'],
    [new Fehler(403), 'kein-recht'],
    [new Fehler(504), 'voruebergehend'],
    [new Fehler(null), 'voruebergehend'],
  ] as const)('Lesefehler %j ist ein Fehler und kein „leer“', async (fehler, grund) => {
    const { s, p } = aufbau(true, [wertMit(100, [w(1, 0)])]);
    s.lesenWirft = fehler;
    expect(await verlaufLesen(p, modul, TERMIN)).toEqual({ ok: false, grund });
  });

  it('scheitert schon das Lesen der Kategorien, ist das ein Fehler (nicht „kein Verlauf“)', async () => {
    const { k, p } = aufbau();
    k.lesenWirft = new Fehler(503);
    expect(await verlaufLesen(p, modul, TERMIN)).toEqual({ ok: false, grund: 'voruebergehend' });
  });
});

describe('verlaufSchreiben', () => {
  it('legt Kategorie und Wert an, wenn es beides noch nicht gibt – und liest nach', async () => {
    const { s, k, p } = aufbau(false);
    const r = await verlaufSchreiben(p, modul, TERMIN, [w(1, 0)]);
    expect(r).toEqual({ ok: true, wechsel: [w(1, 0)] });
    expect(k.angelegt).toBe(1);
    expect(gespeichert(s.werte)).toEqual([w(1, 0)]);
  });

  it('führt mit dem zusammen, was ein anderes Gerät schon geschrieben hat – nichts geht verloren', async () => {
    const { s, p } = aufbau(true, [wertMit(100, [w(1, 0), w(2, 300)])]);
    const r = await verlaufSchreiben(p, modul, TERMIN, [w(3, 600)]);
    expect(r.ok && r.wechsel.map((x) => x.stelle)).toEqual([1, 2, 3]);
    expect(gespeichert(s.werte).map((x) => x.stelle)).toEqual([1, 2, 3]);
    expect(s.werte).toHaveLength(1);
  });

  it('derselbe Wechsel zweimal (gleicher switchdate) = kein Doppel und KEIN zweites Schreiben', async () => {
    const { s, p } = aufbau();
    await verlaufSchreiben(p, modul, TERMIN, [w(1, 0)]);
    const vorher = s.schreibvorgaenge.length;
    const r = await verlaufSchreiben(p, modul, TERMIN, [w(1, 0)]);
    expect(r.ok).toBe(true);
    expect(s.schreibvorgaenge).toHaveLength(vorher);
    expect(gespeichert(s.werte)).toHaveLength(1);
  });

  it('ergänzt einen Wechsel um ein neues Feld (Ausgleich) – der Wechsel bleibt einer', async () => {
    const { s, p } = aufbau();
    await verlaufSchreiben(p, modul, TERMIN, [w(2, 300)]);
    const r = await verlaufSchreiben(p, modul, TERMIN, [w(2, 300, { ausgleich: -40 })]);
    expect(r.ok).toBe(true);
    expect(gespeichert(s.werte)).toEqual([w(2, 300, { ausgleich: -40 })]);
  });

  it('zwei Geräte legen gleichzeitig den ersten Wert an: beide Wechsel sind danach lesbar, nichts wird gelöscht', async () => {
    const { s, p } = aufbau();
    // Das andere Gerät ist zwischen unserem Lesen und unserem Anlegen schneller.
    s.vorher = (a) => {
      if (a.method === 'POST' && s.werte.length === 0) {
        s.werte.push(wertMit(100, [w(1, 0)]));
      }
    };
    const r = await verlaufSchreiben(p, modul, TERMIN, [w(2, 300)]);
    expect(r.ok && r.wechsel.map((x) => x.stelle)).toEqual([1, 2]);
    expect(s.werte).toHaveLength(2);
    expect(s.schreibvorgaenge.every((x) => x.method !== 'DELETE')).toBe(true);
  });

  it('gibt es zwei Werte, wird in den mit der kleinsten ID geschrieben', async () => {
    const { s, p } = aufbau(true, [wertMit(105, [w(1, 0)]), wertMit(101, [w(1, 0)])]);
    await verlaufSchreiben(p, modul, TERMIN, [w(2, 300)]);
    expect(gespeichert([s.werte.find((x) => x.id === 101) as Wert]).map((x) => x.stelle)).toEqual([
      1, 2,
    ]);
    expect(gespeichert([s.werte.find((x) => x.id === 105) as Wert]).map((x) => x.stelle)).toEqual([
      1,
    ]);
  });

  it('ein anderer Termin im selben Speicher bleibt unberührt', async () => {
    const { s, p } = aufbau(true, [wertMit(100, [w(1, 0)], 999)]);
    await verlaufSchreiben(p, modul, TERMIN, [w(1, 0)]);
    expect(gespeichert(s.werte, 999)).toEqual([w(1, 0)]);
    expect(gespeichert(s.werte, TERMIN)).toEqual([w(1, 0)]);
    expect(s.werte).toHaveLength(2);
  });

  it('vorübergehender Fehler beim Schreiben: nichts verloren, nichts überschrieben, später wiederholbar', async () => {
    const { s, p } = aufbau(true, [wertMit(100, [w(1, 0), w(2, 300)])]);
    s.schreibenWirft = new Fehler(504);
    const r = await verlaufSchreiben(p, modul, TERMIN, [w(3, 600)]);
    expect(r).toEqual({ ok: false, grund: 'voruebergehend' });
    expect(gespeichert(s.werte).map((x) => x.stelle)).toEqual([1, 2]);
    s.schreibenWirft = null;
    expect((await verlaufSchreiben(p, modul, TERMIN, [w(3, 600)])).ok).toBe(true);
    expect(gespeichert(s.werte).map((x) => x.stelle)).toEqual([1, 2, 3]);
  });

  it('der Aufruf kam an, die Antwort ging verloren: Wiederholen verdoppelt nichts', async () => {
    const { s, p } = aufbau();
    s.schreibenWirft = new Fehler(null);
    s.trotzdemSchreiben = true;
    expect((await verlaufSchreiben(p, modul, TERMIN, [w(1, 0)])).ok).toBe(false);
    s.schreibenWirft = null;
    expect((await verlaufSchreiben(p, modul, TERMIN, [w(1, 0)])).ok).toBe(true);
    expect(gespeichert(s.werte)).toEqual([w(1, 0)]);
    expect(s.werte).toHaveLength(1);
  });

  it.each([
    [new Fehler(401), 'abgemeldet'],
    [new Fehler(403), 'kein-recht'],
  ] as const)('Schreibfehler %j → %s', async (fehler, grund) => {
    const { s, p } = aufbau();
    s.schreibenWirft = fehler;
    expect(await verlaufSchreiben(p, modul, TERMIN, [w(1, 0)])).toEqual({ ok: false, grund });
  });

  it('Lesen vor dem Schreiben scheitert → es wird nichts geschrieben', async () => {
    const { s, p } = aufbau(true, [wertMit(100, [w(1, 0)])]);
    s.lesenWirft = new Fehler(504);
    expect(await verlaufSchreiben(p, modul, TERMIN, [w(2, 5)])).toEqual({
      ok: false,
      grund: 'voruebergehend',
    });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('ChurchTools verschluckt das Schreiben (201 ohne Folge): nicht angekommen – nach dem Nachlesen, nicht vorher', async () => {
    const { s, p } = aufbau();
    s.verschlucken = true;
    const r = await verlaufSchreiben(p, modul, TERMIN, [w(1, 0)]);
    expect(r).toEqual({ ok: false, grund: 'nicht-angekommen' });
    expect(s.schreibvorgaenge).toHaveLength(VERLAUF_VERSUCHE);
  });

  it('zwischen Schreiben und Nachlesen überschreibt jemand: noch einmal zusammenführen, dann ist es da', async () => {
    const { s, p } = aufbau(true, [wertMit(100, [w(1, 0)])]);
    let einmal = true;
    s.vorher = (a) => {
      // Ein anderes Gerät ersetzt den Wert unmittelbar NACH unserem Schreiben (wir sehen es erst beim Nachlesen).
      if (a.method === 'PUT' && einmal) {
        einmal = false;
        queueMicrotask(() => {
          s.werte[0] = wertMit(100, [w(1, 0), w(9, 100)]);
        });
      }
    };
    const r = await verlaufSchreiben(p, modul, TERMIN, [w(2, 300)]);
    expect(r.ok && r.wechsel.map((x) => x.stelle).sort()).toEqual([1, 2, 9]);
  });

  it('wird es zu groß, entfallen die Titel; passt es nie, wird NICHT geschrieben', async () => {
    const { s, p } = aufbau();
    const viele = Array.from({ length: 150 }, (_, i) => w((i % 3) + 1, i * 40));
    const lang = viele.map((x) => ({ ...x, titel: 'x'.repeat(50) }));
    expect((await verlaufSchreiben(p, modul, TERMIN, lang)).ok).toBe(true);
    expect(s.werte[0].value.length).toBeLessThanOrEqual(10_000);
    const { s: s2, p: p2 } = aufbau();
    const riesig = Array.from({ length: 2000 }, (_, i) => w(1, i));
    expect(await verlaufSchreiben(p2, modul, TERMIN, riesig)).toEqual({
      ok: false,
      grund: 'zu-gross',
    });
    expect(s2.schreibvorgaenge).toEqual([]);
  });

  it('Kategorie lässt sich nicht anlegen (nicht angekommen) → Fehler, kein Wert', async () => {
    const { s, k, p } = aufbau(false);
    k.anlegenVerschlucken = true;
    const r = await verlaufSchreiben(p, modul, TERMIN, [w(1, 0)]);
    expect(r.ok).toBe(false);
    expect(s.werte).toEqual([]);
  });
});
