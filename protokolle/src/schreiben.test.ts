import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import type { Block } from '@shared/protokolle/dokument';
import {
  istTeil,
  sperreVon,
  teileBauen,
  type ProtokollKopf,
  type Schreiber,
} from '@shared/protokolle/speicher';
import {
  protokollLesen,
  schreibenUebernehmen,
  speichern,
  sperreFreigeben,
  sperreNehmen,
  type ProtokollOrt,
} from './schreiben';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';

/** Schreiben am Protokoll (S4-1) gegen die nachgestellte ChurchTools-Instanz (`nachbau.testhilfe.ts`). */
let ct: Nachbau;
const KAT = 62;
const ORT: ProtokollOrt = { modul: MODUL, kategorie: KAT, sitzung: 's1' };
const JETZT = new Date('2026-10-24T18:00:00Z');
const ICH: Schreiber = { person: 1, name: 'Alwin', fenster: 'f1' };
const ZWEITES_FENSTER: Schreiber = { ...ICH, fenster: 'f2' };
const JOHANN: Schreiber = { person: 7, name: 'Johann', fenster: 'j1' };

const NEU: Block[] = [
  { id: 'h1', type: 'heading', props: { level: 1 }, content: 'Andacht', children: [] },
  { id: 'p1', type: 'paragraph', content: 'Römer 12', children: [] },
];

/** Legt das Protokoll so ab, wie S3/S4 es tun: Kopf + Teile aus `teileBauen`. */
function ablegen(kopf: Partial<ProtokollKopf> = {}, dok: readonly Block[] = BLOCKNOTE_DOKUMENT) {
  const { stand, werte } = teileBauen(dok, 's1');
  const k: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    sitzung: 's1',
    titel: 'Leitungssitzung',
    status: 'entwurf',
    beginn: '2026-10-24T17:00:00Z',
    termin: { kalender: 4, id: 114 },
    treffen: 15,
    freigabe: null,
    sperre: null,
    stand,
    ...kopf,
  };
  const liste = werteVon(ct, KAT);
  liste.push({ id: ct.naechste++, value: JSON.stringify(k) });
  for (const w of werte) liste.push({ id: ct.naechste++, value: w });
  return stand;
}

const kopfImSpeicher = (): ProtokollKopf =>
  JSON.parse(werteVon(ct, KAT).find((w) => w.value.includes('"art":"protokoll"'))!.value);
const teileImSpeicher = () =>
  werteVon(ct, KAT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istTeil);
const schreibAufrufe = () => ct.aufrufe.filter((a) => !a.startsWith('GET'));

beforeEach(() => {
  ct = nachbauStarten();
  ct.kategorien.push({ id: KAT, shorty: 'protokolle-g194', name: 'Protokolle · Technik' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('speichern', () => {
  it('schreibt neue Teile, stellt den Kopf um, räumt die alten weg – und liest unverändert zurück', async () => {
    const alt = ablegen();
    const r = await speichern(ORT, ICH, alt, NEU, JETZT);
    expect(r.art).toBe('ok');
    const kopf = kopfImSpeicher();
    expect(kopf.stand).not.toBe(alt);
    expect(kopf.sperre).toEqual(sperreVon(ICH, JETZT));
    // Felder, die das Speichern nicht betrifft, bleiben (Termin, Treffen).
    expect(kopf.termin).toEqual({ kalender: 4, id: 114 });
    expect(kopf.treffen).toBe(15);
    expect(teileImSpeicher().every((t) => t.stand === kopf.stand)).toBe(true);
    expect((await protokollLesen(ORT)).dokument).toEqual(NEU);
  });

  it('Reihenfolge: erst Teile anlegen, dann Kopf, dann alte Teile löschen', async () => {
    const alt = ablegen();
    await speichern(ORT, ICH, alt, NEU, JETZT);
    const art = schreibAufrufe().map((a) => a.split(' ')[0]);
    expect(art).toEqual(['POST', 'PUT', 'DELETE']);
  });

  it('unverändertes Dokument: nur das Lebenszeichen der Sperre, keine Teile', async () => {
    const alt = ablegen();
    const r = await speichern(ORT, ICH, alt, BLOCKNOTE_DOKUMENT, JETZT);
    expect(r.art).toBe('ok');
    expect(schreibAufrufe().map((a) => a.split(' ')[0])).toEqual(['PUT']);
    expect(kopfImSpeicher().sperre?.seit).toBe(JETZT.toISOString());
  });

  it('jemand anderes schreibt gerade: nichts geschrieben, Sperre gemeldet', async () => {
    const fremd = sperreVon(JOHANN, new Date('2026-10-24T17:58:00Z'));
    const alt = ablegen({ sperre: fremd });
    expect(await speichern(ORT, ICH, alt, NEU, JETZT)).toEqual({ art: 'gesperrt', sperre: fremd });
    expect(schreibAufrufe()).toEqual([]);
  });

  it('ich selbst in einem anderen Fenster: ebenfalls gesperrt', async () => {
    const alt = ablegen({ sperre: sperreVon(ZWEITES_FENSTER, JETZT) });
    expect((await speichern(ORT, ICH, alt, NEU, JETZT)).art).toBe('gesperrt');
    expect(schreibAufrufe()).toEqual([]);
  });

  it('inzwischen hat jemand gespeichert (anderer Stand): nicht überschreiben', async () => {
    ablegen();
    expect(await speichern(ORT, ICH, 'alter-stand', NEU, JETZT)).toEqual({ art: 'veraendert' });
    expect(schreibAufrufe()).toEqual([]);
  });

  it('freigegeben oder ohne Kopf: nichts geschrieben', async () => {
    const alt = ablegen({ status: 'frei' });
    expect(await speichern(ORT, ICH, alt, NEU, JETZT)).toEqual({ art: 'fest' });
    expect(await speichern({ ...ORT, sitzung: 'fehlt' }, ICH, alt, NEU, JETZT)).toEqual({
      art: 'weg',
    });
    expect(schreibAufrufe()).toEqual([]);
  });

  it('ChurchTools sagt 201, legt den Teil aber nicht an: Fehler, Kopf und altes Dokument bleiben', async () => {
    const alt = ablegen();
    ct.schluckeWert = () => true;
    await expect(speichern(ORT, ICH, alt, NEU, JETZT)).rejects.toThrow(/nicht vollständig/);
    expect(kopfImSpeicher().stand).toBe(alt);
    expect((await protokollLesen(ORT)).dokument).toEqual(BLOCKNOTE_DOKUMENT);
  });

  it('ChurchTools sagt 200 zum Kopf, ändert ihn aber nicht: Fehler, altes Dokument bleibt lesbar', async () => {
    const alt = ablegen();
    ct.schlucken.add('PUT WERT');
    await expect(speichern(ORT, ICH, alt, NEU, JETZT)).rejects.toThrow(/Schreibsperre/);
    expect((await protokollLesen(ORT)).dokument).toEqual(BLOCKNOTE_DOKUMENT);
  });

  it('vorübergehender Fehler beim Anlegen: geworfen, nichts verloren', async () => {
    const alt = ablegen();
    ct.fehlerBei = { methode: 'POST', status: 503 };
    await expect(speichern(ORT, ICH, alt, NEU, JETZT)).rejects.toThrow();
    ct.fehlerBei = null;
    expect((await protokollLesen(ORT)).dokument).toEqual(BLOCKNOTE_DOKUMENT);
    expect((await speichern(ORT, ICH, alt, NEU, JETZT)).art).toBe('ok');
  });

  it('Aufräumen scheitert: trotzdem gespeichert; das nächste Speichern räumt mit auf', async () => {
    const alt = ablegen();
    ct.schlucken.add('DELETE WERT');
    const r = await speichern(ORT, ICH, alt, NEU, JETZT);
    expect(r.art).toBe('ok');
    expect(new Set(teileImSpeicher().map((t) => t.stand)).size).toBe(2);
    expect((await protokollLesen(ORT)).dokument).toEqual(NEU);
    ct.schlucken.delete('DELETE WERT');
    const NOCHMAL: Block[] = [...NEU, { id: 'p2', type: 'paragraph', content: 'mehr' }];
    await speichern(ORT, ICH, kopfImSpeicher().stand, NOCHMAL, JETZT);
    expect(new Set(teileImSpeicher().map((t) => t.stand)).size).toBe(1);
  });

  it('derselbe Text wie liegengebliebene Teile: keine doppelten Teile, lesbar', async () => {
    const alt = ablegen();
    ct.schlucken.add('DELETE WERT');
    await speichern(ORT, ICH, alt, NEU, JETZT);
    // Zurück zum alten Text – die alten Teile liegen noch da und werden wiederverwendet.
    const r = await speichern(ORT, ICH, kopfImSpeicher().stand, BLOCKNOTE_DOKUMENT, JETZT);
    expect(r.art).toBe('ok');
    expect(kopfImSpeicher().stand).toBe(alt);
    expect((await protokollLesen(ORT)).dokument).toEqual(BLOCKNOTE_DOKUMENT);
    const anzahl = teileBauen(BLOCKNOTE_DOKUMENT, 's1').werte.length;
    expect(teileImSpeicher().filter((t) => t.stand === alt)).toHaveLength(anzahl);
  });

  it('Aufräumen mit echtem Fehler (503): trotzdem gespeichert, nicht geworfen', async () => {
    const alt = ablegen();
    ct.fehlerBei = { methode: 'DELETE', status: 503 };
    expect((await speichern(ORT, ICH, alt, NEU, JETZT)).art).toBe('ok');
    ct.fehlerBei = null;
    expect((await protokollLesen(ORT)).dokument).toEqual(NEU);
  });

  it('übernimmt jemand die Sperre, während ich Teile schreibe: Kopf nicht überschrieben', async () => {
    const alt = ablegen();
    ct.schluckeWert = () => {
      // Genau jetzt nimmt Johann die Sperre (zweites Fenster).
      const w = werteVon(ct, KAT).find((x) => x.value.includes('"art":"protokoll"'))!;
      w.value = JSON.stringify({ ...kopfImSpeicher(), sperre: sperreVon(JOHANN, JETZT) });
      ct.schluckeWert = null;
      return false;
    };
    const r = await speichern(ORT, ICH, alt, NEU, JETZT);
    expect(r.art).toBe('gesperrt');
    expect(kopfImSpeicher().stand).toBe(alt);
    expect(kopfImSpeicher().sperre?.von).toBe(JOHANN.person);
  });
});

describe('Sperre nehmen, übernehmen, freigeben', () => {
  it('nimmt die freie Sperre und liest sie nach', async () => {
    const alt = ablegen();
    const r = await sperreNehmen(ORT, ICH, alt, JETZT);
    expect(r.art).toBe('ok');
    expect(kopfImSpeicher().sperre).toEqual(sperreVon(ICH, JETZT));
  });

  it('eine verlassene Sperre (älter als 10 Minuten) darf man nehmen', async () => {
    const alt = ablegen({ sperre: sperreVon(JOHANN, new Date('2026-10-24T17:49:00Z')) });
    expect((await sperreNehmen(ORT, ICH, alt, JETZT)).art).toBe('ok');
  });

  it('nimmt keine fremde Sperre – das geht nur bewusst mit Übernehmen', async () => {
    const alt = ablegen({ sperre: sperreVon(JOHANN, JETZT) });
    expect((await sperreNehmen(ORT, ICH, alt, JETZT)).art).toBe('gesperrt');
    expect(schreibAufrufe()).toEqual([]);
  });

  it('Übernehmen nimmt die fremde Sperre und liefert den zuletzt gespeicherten Stand', async () => {
    ablegen({ sperre: sperreVon(JOHANN, JETZT) });
    const r = await schreibenUebernehmen(ORT, ICH, JETZT);
    expect(r.art).toBe('ok');
    if (r.art === 'ok') expect(r.dokument).toEqual(BLOCKNOTE_DOKUMENT);
    expect(kopfImSpeicher().sperre?.fenster).toBe('f1');
    // Johanns Fenster merkt es beim nächsten Speichern.
    expect((await speichern(ORT, JOHANN, kopfImSpeicher().stand, NEU, JETZT)).art).toBe('gesperrt');
  });

  it('Übernehmen eines freigegebenen Protokolls: fest', async () => {
    ablegen({ status: 'frei', sperre: sperreVon(JOHANN, JETZT) });
    expect((await schreibenUebernehmen(ORT, ICH, JETZT)).art).toBe('fest');
    expect(schreibAufrufe()).toEqual([]);
  });

  it('Freigeben löscht nur die eigene Sperre', async () => {
    ablegen({ sperre: sperreVon(JOHANN, JETZT) });
    expect(await sperreFreigeben(ORT, ICH, JETZT)).toBe(false);
    expect(kopfImSpeicher().sperre?.von).toBe(JOHANN.person);
    expect(await sperreFreigeben(ORT, JOHANN, JETZT)).toBe(true);
    expect(kopfImSpeicher().sperre).toBeNull();
  });
});

describe('speichern mit Abgleich vorher (S4-2)', () => {
  it('läuft nach der Prüfung und vor dem ersten Schreiben am Protokoll', async () => {
    const alt = ablegen();
    const reihenfolge: string[] = [];
    const r = await speichern(ORT, ICH, alt, NEU, JETZT, () => {
      reihenfolge.push(`vorher nach ${schreibAufrufe().length} Schreibaufrufen`);
      return Promise.resolve();
    });
    expect(r.art).toBe('ok');
    expect(reihenfolge).toEqual(['vorher nach 0 Schreibaufrufen']);
  });

  it('ohne Schreibrecht (fremde Sperre, anderer Stand) läuft er gar nicht', async () => {
    const vorher = vi.fn(() => Promise.resolve());
    const alt = ablegen({ sperre: sperreVon(JOHANN, JETZT) });
    expect((await speichern(ORT, ICH, alt, NEU, JETZT, vorher)).art).toBe('gesperrt');
    expect(await speichern(ORT, ICH, 'anders', NEU, JETZT, vorher)).toMatchObject({
      art: 'gesperrt',
    });
    expect(vorher).not.toHaveBeenCalled();
  });

  it('scheitert er, wird geworfen und am Protokoll nichts geschrieben', async () => {
    const alt = ablegen();
    await expect(
      speichern(ORT, ICH, alt, NEU, JETZT, () => Promise.reject(new Error('Mitarbeit weg'))),
    ).rejects.toThrow('Mitarbeit weg');
    expect(schreibAufrufe()).toEqual([]);
    expect(kopfImSpeicher().stand).toBe(alt);
  });
});
