import { describe, expect, it } from 'vitest';
import { STANDARD_BETRIEBSART, type Betriebsart } from '../ct/liveAgenda';
import type { VersionPort } from '../ct/versionierterWert';
import { Fehler } from './einteilen.testutil';
import { KAT, MODUL, speicher } from './entwuerfe.testutil';
import {
  EINSTELLUNGEN_ART,
  EINSTELLUNGEN_KATEGORIE,
  einstellungenAus,
  einstellungenLesen,
  einstellungenSpeichern,
} from './liveEinstellungen';

const ALEX = { personId: 1, name: 'Alex' };
const BEA = { personId: 2, name: 'Bea' };
const modul = () => Promise.resolve(MODUL);

/**
 * Der Speicher der Erweiterung (nachgebaut wie bei den Entwürfen) samt Kategorien-Liste: `POST …/customdatacategories`
 * legt die Kategorie an (ID `KAT`), alles andere geht an den Speicher für die Werte.
 */
function aufbau(mitKategorie = true) {
  const { s, port } = speicher();
  const kategorien = mitKategorie
    ? [{ id: KAT, shorty: EINSTELLUNGEN_KATEGORIE.kuerzel, name: EINSTELLUNGEN_KATEGORIE.name }]
    : [];
  const k = {
    kategorien,
    /** Lesen der Kategorien-Liste scheitert. */
    lesenWirft: null as Fehler | null,
    /** Anlegen scheitert / wird verschluckt (201 ohne Folge). */
    anlegenWirft: null as Fehler | null,
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
        if (k.anlegenWirft) return Promise.reject(k.anlegenWirft);
        k.angelegt++;
        if (!k.anlegenVerschlucken)
          k.kategorien.push({
            id: KAT,
            shorty: (a.json as { shorty: string }).shorty,
            name: (a.json as { name: string }).name,
          });
        return Promise.resolve();
      }
      return port.schreibe(pfad, a);
    },
  };
  const wert = (betriebsart: unknown, version: number, von = ALEX) =>
    JSON.stringify({ ...EINSTELLUNGEN_ART, version, zeit: 'z', von, inhalt: { betriebsart } });
  return { s, k, p, wert };
}

describe('einstellungenAus (Validierung)', () => {
  it.each(['bis-beginn', 'immer-uhr', 'klicken'] as const)('%s ist gültig', (a) => {
    expect(einstellungenAus({ betriebsart: a })).toEqual({ betriebsart: a });
  });

  it.each([
    null,
    undefined,
    'klicken',
    [],
    {},
    { betriebsart: 'foo' },
    { betriebsart: 3 },
    { betriebsart: null },
  ])('%j ist ungültig', (roh) => {
    expect(einstellungenAus(roh)).toBeNull();
  });
});

describe('einstellungenLesen', () => {
  it('keine Kategorie (noch nie gespeichert) → Standard, kein Fehler', async () => {
    const { p } = aufbau(false);
    expect(await einstellungenLesen(p, modul)).toEqual({
      betriebsart: STANDARD_BETRIEBSART,
      gespeichert: null,
      unlesbar: false,
      fehler: null,
    });
  });

  it('Kategorie ohne Wert → Standard', async () => {
    const { p } = aufbau();
    expect(await einstellungenLesen(p, modul)).toMatchObject({
      betriebsart: STANDARD_BETRIEBSART,
      gespeichert: null,
      fehler: null,
    });
  });

  it.each(['bis-beginn', 'immer-uhr', 'klicken'] as const)(
    'gespeicherter Wert %s wird gelesen',
    async (a) => {
      const { s, p, wert } = aufbau();
      s.werte.push({ id: 100, dataCategoryId: KAT, value: wert(a, 3) });
      const r = await einstellungenLesen(p, modul);
      expect(r.betriebsart).toBe(a);
      expect(r.gespeichert).toMatchObject({ version: 3, inhalt: { betriebsart: a } });
      expect(r).toMatchObject({ unlesbar: false, fehler: null });
    },
  );

  it('Wert in unbekannter Form → Standard, als „unlesbar“ gemeldet, Version bleibt für das Ersetzen', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 100, dataCategoryId: KAT, value: wert('foo', 4) });
    expect(await einstellungenLesen(p, modul)).toMatchObject({
      betriebsart: STANDARD_BETRIEBSART,
      unlesbar: true,
      fehler: null,
      gespeichert: { version: 4 },
    });
  });

  it('zwei Werte (gleichzeitige Erst-Anleger): die höchste Version gilt', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 100, dataCategoryId: KAT, value: wert('immer-uhr', 1) });
    s.werte.push({ id: 101, dataCategoryId: KAT, value: wert('klicken', 2) });
    expect((await einstellungenLesen(p, modul)).betriebsart).toBe('klicken');
  });

  describe('Fehlerzweige – jeder einzeln', () => {
    it.each([
      [503, 'voruebergehend'],
      [null, 'voruebergehend'],
      [401, 'abgemeldet'],
      [403, 'kein-recht'],
    ] as const)(
      'Werte lesen scheitert mit %s → fehler „%s“, Standard, nichts geschrieben',
      async (status, grund) => {
        const { s, p } = aufbau();
        s.lesenWirft = new Fehler(status);
        const r = await einstellungenLesen(p, modul);
        expect(r).toMatchObject({
          betriebsart: STANDARD_BETRIEBSART,
          fehler: grund,
          gespeichert: null,
        });
        expect(s.schreibvorgaenge).toEqual([]);
      },
    );

    it('Kategorien lesen scheitert → Fehler (nicht „keine Kategorie“)', async () => {
      const { k, p } = aufbau();
      k.lesenWirft = new Fehler(503);
      expect(await einstellungenLesen(p, modul)).toMatchObject({ fehler: 'voruebergehend' });
    });

    it('die Suche nach dem Modul scheitert → Fehler', async () => {
      const { p } = aufbau();
      const r = await einstellungenLesen(p, () => Promise.reject(new Fehler(504)));
      expect(r).toMatchObject({ fehler: 'voruebergehend', betriebsart: STANDARD_BETRIEBSART });
    });

    it('ein vorübergehender Fehler zerstört den gespeicherten Wert nicht: danach liest man ihn wieder', async () => {
      const { s, p, wert } = aufbau();
      s.werte.push({ id: 100, dataCategoryId: KAT, value: wert('klicken', 1) });
      s.lesenWirft = new Fehler(502);
      expect((await einstellungenLesen(p, modul)).fehler).toBe('voruebergehend');
      s.lesenWirft = null;
      expect(await einstellungenLesen(p, modul)).toMatchObject({
        betriebsart: 'klicken',
        fehler: null,
      });
      expect(s.werte).toHaveLength(1);
      expect(s.schreibvorgaenge).toEqual([]);
    });
  });
});

describe('einstellungenSpeichern', () => {
  const speichern = (p: VersionPort, a: Betriebsart, erwartet: number | null, von = ALEX) =>
    einstellungenSpeichern(p, modul, { betriebsart: a }, von, erwartet);

  it('erstes Speichern legt die Kategorie an, dann den Wert – und es steht nachgelesen da', async () => {
    const { s, k, p } = aufbau(false);
    const r = await speichern(p, 'klicken', null);
    expect(r).toMatchObject({
      ok: true,
      daten: { version: 1, inhalt: { betriebsart: 'klicken' }, von: ALEX },
    });
    expect(k.angelegt).toBe(1);
    expect(s.werte).toHaveLength(1);
    // Gegen den Erzeuger gelesen, nicht gegen ein Literal: genau das, was `einstellungenLesen` wieder versteht.
    expect(await einstellungenLesen(p, modul)).toMatchObject({
      betriebsart: 'klicken',
      fehler: null,
    });
  });

  it('die Kategorie ist schon da: nicht noch einmal anlegen', async () => {
    const { k, p } = aufbau();
    await speichern(p, 'immer-uhr', null);
    expect(k.angelegt).toBe(0);
  });

  it('ändern mit der gesehenen Version → Version + 1, derselbe Wert (PUT)', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 100, dataCategoryId: KAT, value: wert('bis-beginn', 1) });
    const r = await speichern(p, 'immer-uhr', 1);
    expect(r).toMatchObject({
      ok: true,
      daten: { version: 2, inhalt: { betriebsart: 'immer-uhr' } },
    });
    expect(s.werte).toHaveLength(1);
    expect(s.schreibvorgaenge.map((a) => a.method)).toEqual(['PUT']);
  });

  it('ein anderer war schneller → Konflikt, NICHTS überschrieben', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 100, dataCategoryId: KAT, value: wert('klicken', 2, BEA) });
    const r = await speichern(p, 'immer-uhr', 1);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { version: 2, von: BEA } });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('Konflikt auch beim ersten Speichern, wenn inzwischen einer da ist', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 100, dataCategoryId: KAT, value: wert('klicken', 1, BEA) });
    expect(await speichern(p, 'immer-uhr', null)).toMatchObject({ ok: false, grund: 'konflikt' });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  describe('Fehlerzweige – jeder einzeln', () => {
    it('kein Recht beim Schreiben des Werts (403) → kein-recht, der alte Wert bleibt', async () => {
      const { s, p, wert } = aufbau();
      s.werte.push({ id: 100, dataCategoryId: KAT, value: wert('bis-beginn', 1) });
      s.schreibenWirft = new Fehler(403);
      expect(await speichern(p, 'klicken', 1)).toMatchObject({ ok: false, grund: 'kein-recht' });
      expect((await einstellungenLesen(p, modul)).betriebsart).toBe('bis-beginn');
    });

    it('kein Recht beim Anlegen der Kategorie (403) → kein-recht, kein Wert geschrieben', async () => {
      const { s, k, p } = aufbau(false);
      k.anlegenWirft = new Fehler(403);
      expect(await speichern(p, 'klicken', null)).toMatchObject({ ok: false, grund: 'kein-recht' });
      expect(s.schreibvorgaenge).toEqual([]);
    });

    it('abgemeldet beim Schreiben (401) → abgemeldet', async () => {
      const { s, p } = aufbau();
      s.schreibenWirft = new Fehler(401);
      expect(await speichern(p, 'klicken', null)).toMatchObject({ ok: false, grund: 'abgemeldet' });
    });

    it('vorübergehender Fehler, nichts angekommen → voruebergehend, der alte Wert bleibt', async () => {
      const { s, p, wert } = aufbau();
      s.werte.push({ id: 100, dataCategoryId: KAT, value: wert('bis-beginn', 1) });
      s.schreibenWirft = new Fehler(503);
      expect(await speichern(p, 'klicken', 1)).toMatchObject({
        ok: false,
        grund: 'voruebergehend',
      });
      expect((await einstellungenLesen(p, modul)).betriebsart).toBe('bis-beginn');
      // Geschrieben wurde genau einmal – nie automatisch wiederholt.
      expect(s.schreibvorgaenge).toHaveLength(1);
    });

    it('vorübergehender Fehler, aber es ist angekommen → beim Nachlesen Erfolg', async () => {
      const { s, p } = aufbau();
      s.schreibenWirft = new Fehler(504);
      s.trotzdemSchreiben = true;
      expect(await speichern(p, 'klicken', null)).toMatchObject({
        ok: true,
        daten: { version: 1 },
      });
    });

    it('ChurchTools sagt OK, schreibt aber nichts → nicht-angekommen', async () => {
      const { s, p } = aufbau();
      s.verschlucken = true;
      expect(await speichern(p, 'klicken', null)).toMatchObject({
        ok: false,
        grund: 'nicht-angekommen',
      });
    });

    it('Kategorie angelegt gemeldet, aber nicht da → Fehler, nichts geschrieben', async () => {
      const { s, k, p } = aufbau(false);
      k.anlegenVerschlucken = true;
      expect(await speichern(p, 'klicken', null)).toMatchObject({
        ok: false,
        grund: 'voruebergehend',
      });
      expect(s.schreibvorgaenge).toEqual([]);
    });

    it('Lesen vor dem Schreiben scheitert → voruebergehend, nichts geschrieben', async () => {
      const { s, p } = aufbau();
      s.lesenWirft = new Fehler(503);
      expect(await speichern(p, 'klicken', null)).toMatchObject({
        ok: false,
        grund: 'voruebergehend',
      });
      expect(s.schreibvorgaenge).toEqual([]);
    });
  });
});
