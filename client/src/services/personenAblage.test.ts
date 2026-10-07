import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  _zuruecksetzen,
  holeAnmerkungen,
  holeEinstellungen,
  holeGesehen,
  merkeGesehen,
  schreibeAnmerkung,
  schreibeEinstellungen,
} from './personenAblage';
import { _vergissCsrf, KeinSpeicherRecht } from './ctRuntime';
import { FakeCt } from './ctFake.testutil';
import { GESEHEN_MAX_ALTER_MS } from '@shared/types/index';

/**
 * Die Ablage der Extension in den Personen-Dateien (#334). Geprüft gegen ein nachgebautes ChurchTools
 * (`ctFake.testutil.ts`) mit dem am 07.10.2026 gemessenen Verhalten. Jede Härtung hat einen eigenen
 * Test – die Gegenproben nehmen sie einzeln zurück.
 */
const DATEN = 'musikapp_daten.json';
// Kanonisches Base64 (aus echten Bytes) – sonst ändert das Hin und Zurück die Füllbits.
const PNG_A = `data:image/png;base64,${btoa('\x89PNG Bild A')}`;
const PNG_B = `data:image/png;base64,${btoa('\x89PNG Bild B, etwas länger')}`;
const SEITE = 'song12_voriginal_0';

let ct: FakeCt;

beforeEach(() => {
  _zuruecksetzen();
  _vergissCsrf();
  ct = new FakeCt();
  ct.installieren();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Einstellungen', () => {
  it('schreiben und wieder holen – nur die angefragten Lieder, nur gültige Schlüssel', async () => {
    await schreibeEinstellungen({
      worship_key_12: 'G',
      worship_capo_13: '2',
      nicht_erlaubt: 'x',
    });
    expect(await holeEinstellungen([12])).toEqual({ worship_key_12: 'G' });
    expect(await holeEinstellungen([12, 13])).toEqual({
      worship_key_12: 'G',
      worship_capo_13: '2',
    });
    expect(ct.text(ct.dateien[0].id)).not.toContain('nicht_erlaubt');
  });

  it('null und "" entfernen', async () => {
    await schreibeEinstellungen({ worship_key_12: 'G', worship_capo_12: '2' });
    await schreibeEinstellungen({ worship_key_12: null, worship_capo_12: '' });
    expect(await holeEinstellungen([12])).toEqual({});
  });

  it('Ersetzen lässt genau EINE Daten-Datei zurück', async () => {
    await schreibeEinstellungen({ worship_key_12: 'G' });
    await schreibeEinstellungen({ worship_key_12: 'A' });
    await schreibeEinstellungen({ worship_key_12: 'B' });
    expect(ct.namen()).toEqual([DATEN]);
    expect(await holeEinstellungen([12])).toEqual({ worship_key_12: 'B' });
  });
});

describe('Ersetzen: erst nachlesen, dann löschen (Lehre 11.08.2026)', () => {
  it('meldet ChurchTools Erfolg, ohne dass die Datei da ist, bleibt die alte stehen', async () => {
    await schreibeEinstellungen({ worship_key_12: 'G' });
    const alt = ct.dateien[0].id;
    ct.uploadVerschwindet = true;
    await expect(schreibeEinstellungen({ worship_key_12: 'A' })).rejects.toThrow(/nicht da/);
    expect(ct.dateien.map((d) => d.id)).toEqual([alt]);
    expect(await holeEinstellungen([12])).toEqual({ worship_key_12: 'G' });
  });

  it('scheitert das Löschen der alten Fassung, gewinnt beim Lesen trotzdem die neue', async () => {
    await schreibeEinstellungen({ worship_key_12: 'G' });
    ct.loeschenScheitert = true;
    await schreibeEinstellungen({ worship_key_12: 'A' });
    expect(ct.namen()).toEqual([DATEN, DATEN]);
    expect(await holeEinstellungen([12])).toEqual({ worship_key_12: 'A' });
  });
});

describe('Zwei Geräte', () => {
  it('liegen zwei Fassungen da, werden sie Feld für Feld zusammengeführt', async () => {
    ct.ablegen(
      DATEN,
      JSON.stringify({ v: 1, felder: { 'einst:worship_key_12': { w: 'G', t: 10 } } }),
    );
    ct.ablegen(
      DATEN,
      JSON.stringify({ v: 1, felder: { 'einst:worship_capo_12': { w: '3', t: 20 } } }),
    );
    expect(await holeEinstellungen([12])).toEqual({ worship_key_12: 'G', worship_capo_12: '3' });
  });

  it('bei gleichem Feld gewinnt die jüngere Änderung – nicht die neuere Datei', async () => {
    ct.ablegen(
      DATEN,
      JSON.stringify({ v: 1, felder: { 'einst:worship_key_12': { w: 'neu', t: 50 } } }),
    );
    ct.ablegen(
      DATEN,
      JSON.stringify({ v: 1, felder: { 'einst:worship_key_12': { w: 'alt', t: 5 } } }),
    );
    expect(await holeEinstellungen([12])).toEqual({ worship_key_12: 'neu' });
  });

  it('die Fassung eines anderen Geräts, die wir noch nicht kannten, wird NICHT gelöscht', async () => {
    await schreibeEinstellungen({ worship_key_12: 'G' }); // unsere Liste kennt nur unsere Fassung
    const fremd = ct.ablegen(
      DATEN,
      JSON.stringify({ v: 1, felder: { 'einst:worship_capo_12': { w: '3', t: Date.now() } } }),
    );
    await schreibeEinstellungen({ worship_key_12: 'A' });
    expect(ct.dateien.some((d) => d.id === fremd)).toBe(true);
    expect(await holeEinstellungen([12])).toEqual({ worship_key_12: 'A', worship_capo_12: '3' });
  });

  it('der nächste Schreibvorgang räumt zusammengeführte Fassungen auf', async () => {
    ct.ablegen(
      DATEN,
      JSON.stringify({ v: 1, felder: { 'einst:worship_key_12': { w: 'G', t: 10 } } }),
    );
    ct.ablegen(
      DATEN,
      JSON.stringify({ v: 1, felder: { 'einst:worship_capo_12': { w: '3', t: 20 } } }),
    );
    await holeEinstellungen([12]); // Liste kennt jetzt beide
    await schreibeEinstellungen({ worship_fs_12: '1.2' });
    expect(ct.namen()).toEqual([DATEN]);
    expect(await holeEinstellungen([12])).toEqual({
      worship_key_12: 'G',
      worship_capo_12: '3',
      worship_fs_12: '1.2',
    });
  });
});

describe('Lesefehler verwerfen nichts (#273)', () => {
  it('lässt sich eine Fassung nicht laden, wirft das Schreiben – und löscht nichts', async () => {
    await schreibeEinstellungen({ worship_key_12: 'G' });
    _zuruecksetzen(); // neuer Start: nichts im Speicher
    const vorher = ct.dateien.map((d) => d.id);
    ct.herunterladenScheitert = true;
    await expect(schreibeEinstellungen({ worship_capo_12: '2' })).rejects.toThrow();
    expect(ct.dateien.map((d) => d.id)).toEqual(vorher);
  });
});

describe('Anmerkungen', () => {
  it('Zeichnung, Texte und Zoom einer Seite – hin und zurück', async () => {
    const texts = [{ id: 't1', x: 1, y: 2, text: 'leise' }];
    const zoom = { x: 1, y: 2, scale: 1.5 };
    await schreibeAnmerkung(SEITE, { strokes: PNG_A, texts, zoom } as never);
    expect(ct.namen()).toContain(`musikapp_${SEITE}.png`);
    expect(await holeAnmerkungen([12])).toEqual({ [SEITE]: { strokes: PNG_A, texts, zoom } });
  });

  it('nur die angefragten Lieder', async () => {
    await schreibeAnmerkung(SEITE, { strokes: PNG_A });
    await schreibeAnmerkung('song13_voriginal_0', { strokes: PNG_B });
    expect(Object.keys(await holeAnmerkungen([13]))).toEqual(['song13_voriginal_0']);
  });

  it('eine neue Zeichnung ersetzt die alte, leere löscht sie', async () => {
    await schreibeAnmerkung(SEITE, { strokes: PNG_A });
    await schreibeAnmerkung(SEITE, { strokes: PNG_B });
    expect(ct.namen()).toEqual([`musikapp_${SEITE}.png`]);
    expect((await holeAnmerkungen([12]))[SEITE].strokes).toBe(PNG_B);
    await schreibeAnmerkung(SEITE, { strokes: null });
    expect(ct.namen()).toEqual([]);
    expect(await holeAnmerkungen([12])).toEqual({});
  });

  it('nur übergebene Felder ändern sich (Feld-Merge wie beim Server)', async () => {
    await schreibeAnmerkung(SEITE, { strokes: PNG_A, zoom: { x: 0, y: 0, scale: 2 } });
    await schreibeAnmerkung(SEITE, { zoom: { x: 5, y: 5, scale: 3 } });
    const seite = (await holeAnmerkungen([12]))[SEITE];
    expect(seite.strokes).toBe(PNG_A);
    expect(seite.zoom).toEqual({ x: 5, y: 5, scale: 3 });
  });

  it('scheitert das Löschen einer Zeichnung, wirft es – sonst käme sie beim nächsten Holen zurück', async () => {
    await schreibeAnmerkung(SEITE, { strokes: PNG_A });
    ct.loeschenScheitert = true;
    await expect(schreibeAnmerkung(SEITE, { strokes: null })).rejects.toThrow();
  });

  it('ein unverändertes Bild wird beim nächsten Holen nicht erneut heruntergeladen', async () => {
    await schreibeAnmerkung(SEITE, { strokes: PNG_A });
    await holeAnmerkungen([12]);
    const vorher = ct.zaehle('GET /?q=public/filedownload');
    await holeAnmerkungen([12]);
    expect(ct.zaehle('GET /?q=public/filedownload')).toBe(vorher);
  });
});

describe('Recht und Sitzung', () => {
  it('fehlt das Recht zum Hochladen, kommt KeinSpeicherRecht – nicht „abgemeldet"', async () => {
    ct.hochladenVerboten = true;
    await expect(schreibeEinstellungen({ worship_key_12: 'G' })).rejects.toBeInstanceOf(
      KeinSpeicherRecht,
    );
  });

  it('schreibende Aufrufe tragen das CSRF-Token', async () => {
    await schreibeEinstellungen({ worship_key_12: 'G' });
    const post = vi.mocked(globalThis.fetch).mock.calls.find((c) => c[1]?.method === 'POST');
    expect((post?.[1]?.headers as Record<string, string>)['CSRF-Token']).toBe('csrf-123');
  });
});

describe('„Gesehen" (#143)', () => {
  it('merken und wieder holen', async () => {
    await merkeGesehen(500, { hash: 'abc', items: [{ id: 1, sig: 's' }] }, 1_000);
    expect(await holeGesehen(2_000)).toEqual({
      500: { hash: 'abc', items: [{ id: 1, sig: 's' }], seenAt: 1_000 },
    });
  });

  it('zu alte Stände fallen beim Holen weg und werden beim nächsten Merken gelöscht', async () => {
    const t0 = 1_000;
    await merkeGesehen(500, { hash: 'alt' }, t0);
    const spaeter = t0 + GESEHEN_MAX_ALTER_MS + 1;
    expect(await holeGesehen(spaeter)).toEqual({});
    await merkeGesehen(501, { hash: 'neu' }, spaeter);
    const inhalt = JSON.parse(ct.text(ct.dateien[ct.dateien.length - 1].id)) as {
      felder: Record<string, { w: unknown }>;
    };
    expect(inhalt.felder['gesehen:500'].w).toBeNull();
  });
});
