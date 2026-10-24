import { describe, expect, it } from 'vitest';
import { KAT, MODUL, speicher } from '../dienstplan/entwuerfe.testutil';
import { Fehler } from '../dienstplan/einteilen.testutil';
import { dokumentEntfernen, dokumentLesen, dokumentSpeichern } from './versionierterWert';

// Gegen den nachgebauten Speicher der Erweiterung (wie gemessen) – derselbe wie bei den Dienstplaner-Entwürfen.
const ART = { art: 'test-dokument', fassung: 1 };
const ALEX = { personId: 1, name: 'Alex' };
const BEA = { personId: 2, name: 'Bea' };
const V = 'kein Recht';

describe('dokumentSpeichern / dokumentLesen', () => {
  it('erstes Speichern (erwartet null) → Version 1, nachgelesen', async () => {
    const { port } = speicher();
    const r = await dokumentSpeichern(port, MODUL, KAT, ART, { a: 1 }, ALEX, null, V);
    expect(r).toMatchObject({ ok: true, daten: { version: 1, inhalt: { a: 1 }, von: ALEX } });
    const l = await dokumentLesen(port, MODUL, KAT, ART);
    expect(l).toMatchObject({ ok: true, daten: { version: 1 } });
  });

  it('ändern mit der gesehenen Version → +1, derselbe Wert (PUT)', async () => {
    const { s, port } = speicher();
    await dokumentSpeichern(port, MODUL, KAT, ART, { a: 1 }, ALEX, null, V);
    const r = await dokumentSpeichern(port, MODUL, KAT, ART, { a: 2 }, ALEX, 1, V);
    expect(r).toMatchObject({ ok: true, daten: { version: 2, inhalt: { a: 2 } } });
    expect(s.werte).toHaveLength(1);
    expect(s.schreibvorgaenge.map((a) => a.method)).toEqual(['POST', 'PUT']);
  });

  it('ein anderer war schneller → Konflikt, NICHTS überschrieben, `jetzt` sagt, was dasteht', async () => {
    const { s, port } = speicher();
    await dokumentSpeichern(port, MODUL, KAT, ART, { a: 1 }, ALEX, null, V);
    await dokumentSpeichern(port, MODUL, KAT, ART, { a: 'Bea' }, BEA, 1, V);
    const r = await dokumentSpeichern(port, MODUL, KAT, ART, { a: 'Alex' }, ALEX, 1, V);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { version: 2, von: BEA } });
    expect(s.schreibvorgaenge).toHaveLength(2);
  });

  it('zwei gleichzeitig zwischen Lesen und Schreiben → beim Nachlesen erkannt (Konflikt)', async () => {
    const { s, port } = speicher();
    await dokumentSpeichern(port, MODUL, KAT, ART, { a: 1 }, ALEX, null, V);
    // Bea schreibt genau zwischen Alex' Lesen und Schreiben – Alex' PUT überschreibt, Bea schreibt danach nochmal
    s.vorher = () => {
      s.vorher = null;
      const w = s.werte[0];
      s.werte[0] = {
        ...w,
        value: JSON.stringify({ ...ART, version: 3, zeit: 'x', von: BEA, inhalt: { a: 'Bea' } }),
      };
    };
    s.verschlucken = true;
    const r = await dokumentSpeichern(port, MODUL, KAT, ART, { a: 'Alex' }, ALEX, 1, V);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { version: 3, von: BEA } });
  });

  it('ChurchTools sagt OK, schreibt aber nichts → nicht angekommen', async () => {
    const { s, port } = speicher();
    s.verschlucken = true;
    const r = await dokumentSpeichern(port, MODUL, KAT, ART, { a: 1 }, ALEX, null, V);
    expect(r).toMatchObject({ ok: false, grund: 'nicht-angekommen' });
  });

  it('vorübergehender Fehler beim Schreiben, aber es ist angekommen → beim Nachlesen Erfolg', async () => {
    const { s, port } = speicher();
    s.schreibenWirft = new Fehler(503);
    s.trotzdemSchreiben = true;
    const r = await dokumentSpeichern(port, MODUL, KAT, ART, { a: 1 }, ALEX, null, V);
    expect(r).toMatchObject({ ok: true, daten: { version: 1 } });
  });

  it('kein Recht → kein-recht; Lesen scheitert → vorübergehend (nichts geschrieben)', async () => {
    const a = speicher();
    a.s.schreibenWirft = new Fehler(403);
    expect(await dokumentSpeichern(a.port, MODUL, KAT, ART, {}, ALEX, null, V)).toMatchObject({
      ok: false,
      grund: 'kein-recht',
    });
    const b = speicher();
    b.s.lesenWirft = new Fehler(503);
    expect(await dokumentSpeichern(b.port, MODUL, KAT, ART, {}, ALEX, null, V)).toMatchObject({
      ok: false,
      grund: 'voruebergehend',
    });
    expect(b.s.schreibvorgaenge).toEqual([]);
  });

  it('zu groß für einen Wert → zu-gross, nichts geschrieben', async () => {
    const { s, port } = speicher();
    const r = await dokumentSpeichern(
      port,
      MODUL,
      KAT,
      ART,
      { x: 'y'.repeat(10_001) },
      ALEX,
      null,
      V,
    );
    expect(r).toMatchObject({ ok: false, grund: 'zu-gross' });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('fremde Werte in der Kategorie stören nicht; Doppelte: die höchste Version gilt', async () => {
    const wert = (id: number, version: number) => ({
      id,
      dataCategoryId: KAT,
      value: JSON.stringify({ ...ART, version, zeit: 'z', von: ALEX, inhalt: { v: version } }),
    });
    const { port } = speicher([
      { id: 1, dataCategoryId: KAT, value: 'kein JSON' },
      { id: 2, dataCategoryId: KAT, value: JSON.stringify({ art: 'anders', fassung: 1 }) },
      // die höchste Version steht absichtlich im älteren Wert (kleinere ID)
      wert(3, 5),
      wert(4, 2),
    ]);
    expect(await dokumentLesen(port, MODUL, KAT, ART)).toMatchObject({
      ok: true,
      daten: { version: 5, inhalt: { v: 5 } },
    });
  });
});

describe('dokumentEntfernen', () => {
  it('mit der gesehenen Version: alle Werte dieser Art weg (auch Doppelte), fremde bleiben', async () => {
    const wert = (id: number, version: number) => ({
      id,
      dataCategoryId: KAT,
      value: JSON.stringify({ ...ART, version, zeit: 'z', von: ALEX, inhalt: {} }),
    });
    const { s, port } = speicher([
      wert(3, 1),
      wert(4, 2),
      { id: 9, dataCategoryId: KAT, value: 'fremd' },
    ]);
    expect(await dokumentEntfernen(port, MODUL, KAT, ART, 2, V)).toEqual({ ok: true, daten: null });
    expect(s.werte.map((w) => w.id)).toEqual([9]);
  });

  it('andere Version → Konflikt, nichts gelöscht; nichts da → Erfolg', async () => {
    const { s, port } = speicher();
    await dokumentSpeichern(port, MODUL, KAT, ART, {}, ALEX, null, V);
    await dokumentSpeichern(port, MODUL, KAT, ART, {}, BEA, 1, V);
    expect(await dokumentEntfernen(port, MODUL, KAT, ART, 1, V)).toMatchObject({
      ok: false,
      grund: 'konflikt',
    });
    expect(s.werte).toHaveLength(1);
    expect(await dokumentEntfernen(speicher().port, MODUL, KAT, ART, 1, V)).toEqual({
      ok: true,
      daten: null,
    });
  });
});
