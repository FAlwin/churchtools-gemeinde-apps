import { describe, expect, it } from 'vitest';
import type { VersionPort } from '../ct/versionierterWert';
import { STANDARD_PLAN, type Abfrage, type AbfragenInhalt } from './abfragen';
import { abfragenArt, abfragenLesen, abfragenSpeichern, standardInhalt } from './abfragenSpeicher';
import { Fehler } from './einteilen.testutil';
import { KAT, MODUL, speicher } from './entwuerfe.testutil';
import {
  EINSTELLUNGEN_ART,
  EINSTELLUNGEN_KATEGORIE,
  einstellungenLesen,
  einstellungenSpeichern,
} from './liveEinstellungen';

const ALEX = { personId: 1, name: 'Alex' };
const BEA = { personId: 2, name: 'Bea' };
const MUSIK = 4;
const TECHNIK = 3;
const modul = () => Promise.resolve(MODUL);
// Vorbelegte Werte bekommen eine ID, die der Nachbau beim Anlegen (ab 100) nie vergibt.

const ABFRAGE: Abfrage = {
  id: 'a1',
  von: '2027-02-01',
  bis: '2027-03-31',
  frist: '2027-01-05',
  oeffnen: '2026-12-20',
  termine: [1, 2],
  gestartet: { personId: 1, name: 'Alex', zeit: '2026-12-01T10:00:00.000Z' },
  beendet: null,
};
const INHALT: AbfragenInhalt = {
  plan: STANDARD_PLAN,
  abfragen: [ABFRAGE],
  einrichtung: null,
  verfuegbarkeit: 'zusagen' as const,
};

/** Wie bei `liveEinstellungen.test.ts`: nachgebauter Speicher samt Kategorien-Liste (`aufbau`). */
function aufbau(mitKategorie = true) {
  const { s, port } = speicher();
  const kategorien = mitKategorie
    ? [{ id: KAT, shorty: EINSTELLUNGEN_KATEGORIE.kuerzel, name: EINSTELLUNGEN_KATEGORIE.name }]
    : [];
  const k = { kategorien, lesenWirft: null as Fehler | null, anlegenWirft: null as Fehler | null };
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
  const wert = (dienstgruppe: number, inhalt: unknown, version: number, von = ALEX) =>
    JSON.stringify({ ...abfragenArt(dienstgruppe), version, zeit: 'z', von, inhalt });
  return { s, k, p, wert };
}

const lesen = (p: VersionPort, g = MUSIK) => abfragenLesen(p, modul, g);
const speichern = (
  p: VersionPort,
  erwartet: number | null,
  inhalt = INHALT,
  g = MUSIK,
  von = ALEX,
) => abfragenSpeichern(p, modul, g, inhalt, von, erwartet);

describe('abfragenLesen', () => {
  it('Art je Dienstgruppe, Fassung 1', () => {
    expect(abfragenArt(4)).toEqual({ art: 'dienstplaner-abfragen-4', fassung: 1 });
  });

  it('keine Kategorie → Standard, kein Fehler', async () => {
    const { p } = aufbau(false);
    expect(await lesen(p)).toEqual({
      inhalt: standardInhalt(),
      gespeichert: null,
      unlesbar: false,
      fehler: null,
    });
  });

  it('Kategorie ohne Wert → Standard', async () => {
    const { p } = aufbau();
    expect(await lesen(p)).toMatchObject({ gespeichert: null, fehler: null, unlesbar: false });
  });

  it('gespeicherter Wert wird gelesen, mit Version', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 900, dataCategoryId: KAT, value: wert(MUSIK, INHALT, 3) });
    const r = await lesen(p);
    expect(r.inhalt).toEqual(INHALT);
    expect(r.gespeichert).toMatchObject({ version: 3, inhalt: INHALT });
    expect(r).toMatchObject({ unlesbar: false, fehler: null });
  });

  it('Altbestand ohne `einrichtung` (R-1 bis R-4, Test-Instanz) gilt als „nicht eingerichtet“, nicht als unlesbar', async () => {
    const { s, p, wert } = aufbau();
    const { einrichtung: _weg, ...alt } = INHALT;
    s.werte.push({ id: 900, dataCategoryId: KAT, value: wert(MUSIK, alt, 3) });
    const r = await lesen(p);
    expect(r).toMatchObject({ unlesbar: false, fehler: null, gespeichert: { version: 3 } });
    expect(r.inhalt).toEqual(INHALT);
  });

  it('die Einrichtung wird mitgespeichert und nachgelesen', async () => {
    const { p } = aufbau();
    const mit: AbfragenInhalt = { ...INHALT, einrichtung: { gruppeId: 12, routineId: 34 } };
    expect(await speichern(p, null, mit)).toMatchObject({ ok: true });
    expect((await lesen(p)).inhalt.einrichtung).toEqual({ gruppeId: 12, routineId: 34 });
  });

  it('Wert in unbekannter Form → Standard, „unlesbar“, Version bleibt fürs Ersetzen', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 900, dataCategoryId: KAT, value: wert(MUSIK, { plan: 5 }, 4) });
    expect(await lesen(p)).toMatchObject({
      inhalt: standardInhalt(),
      unlesbar: true,
      fehler: null,
      gespeichert: { version: 4 },
    });
  });

  describe('Fehlerzweige – jeder einzeln, ein Lesefehler ist nie „kein Wert“', () => {
    it.each([
      [503, 'voruebergehend'],
      [null, 'voruebergehend'],
      [401, 'abgemeldet'],
      [403, 'kein-recht'],
    ] as const)('Werte lesen scheitert mit %s → fehler „%s“', async (status, grund) => {
      const { s, p } = aufbau();
      s.lesenWirft = new Fehler(status);
      expect(await lesen(p)).toMatchObject({ fehler: grund, gespeichert: null });
      expect(s.schreibvorgaenge).toEqual([]);
    });

    it('Kategorien lesen scheitert → Fehler', async () => {
      const { k, p } = aufbau();
      k.lesenWirft = new Fehler(503);
      expect(await lesen(p)).toMatchObject({ fehler: 'voruebergehend' });
    });

    it('die Suche nach dem Modul scheitert → Fehler', async () => {
      const { p } = aufbau();
      expect(await abfragenLesen(p, () => Promise.reject(new Fehler(504)), MUSIK)).toMatchObject({
        fehler: 'voruebergehend',
      });
    });

    it('ein vorübergehender Fehler zerstört nichts: danach liest man den Wert wieder', async () => {
      const { s, p, wert } = aufbau();
      s.werte.push({ id: 900, dataCategoryId: KAT, value: wert(MUSIK, INHALT, 1) });
      s.lesenWirft = new Fehler(502);
      expect((await lesen(p)).fehler).toBe('voruebergehend');
      s.lesenWirft = null;
      expect((await lesen(p)).inhalt).toEqual(INHALT);
      expect(s.werte).toHaveLength(1);
      expect(s.schreibvorgaenge).toEqual([]);
    });
  });
});

describe('abfragenSpeichern', () => {
  it('erstes Speichern legt die Kategorie an, dann den Wert – nachgelesen steht es da', async () => {
    const { s, p } = aufbau(false);
    const r = await speichern(p, null);
    expect(r).toMatchObject({ ok: true, daten: { version: 1, inhalt: INHALT, von: ALEX } });
    expect(s.werte).toHaveLength(1);
    // Gegen den Erzeuger gelesen: genau das, was `abfragenLesen` wieder versteht.
    expect((await lesen(p)).inhalt).toEqual(INHALT);
  });

  it('ändern mit der gesehenen Version → Version + 1, derselbe Wert (PUT)', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 900, dataCategoryId: KAT, value: wert(MUSIK, standardInhalt(), 1) });
    expect(await speichern(p, 1)).toMatchObject({ ok: true, daten: { version: 2 } });
    expect(s.werte).toHaveLength(1);
    expect(s.schreibvorgaenge.map((a) => a.method)).toEqual(['PUT']);
  });

  it('ein anderer war schneller → Konflikt, nichts überschrieben', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 900, dataCategoryId: KAT, value: wert(MUSIK, INHALT, 2, BEA) });
    expect(await speichern(p, 1)).toMatchObject({
      ok: false,
      grund: 'konflikt',
      jetzt: { version: 2, von: BEA },
    });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('Konflikt auch beim ersten Speichern, wenn inzwischen einer da ist', async () => {
    const { s, p, wert } = aufbau();
    s.werte.push({ id: 900, dataCategoryId: KAT, value: wert(MUSIK, INHALT, 1, BEA) });
    expect(await speichern(p, null)).toMatchObject({ ok: false, grund: 'konflikt' });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('Inhalt, den `abfragenAus` nicht lesen würde, wird nie geschrieben', async () => {
    const { s, p } = aufbau();
    const kaputt = {
      plan: null,
      abfragen: [{ ...ABFRAGE, frist: '2027-02-01' }],
      einrichtung: null,
      verfuegbarkeit: 'zusagen' as const,
    };
    await expect(speichern(p, null, kaputt)).rejects.toThrow();
    expect(s.schreibvorgaenge).toEqual([]);
  });

  describe('Fehlerzweige – jeder einzeln', () => {
    it('kein Recht beim Schreiben (403) → kein-recht, der alte Wert bleibt', async () => {
      const { s, p, wert } = aufbau();
      s.werte.push({ id: 900, dataCategoryId: KAT, value: wert(MUSIK, standardInhalt(), 1) });
      s.schreibenWirft = new Fehler(403);
      expect(await speichern(p, 1)).toMatchObject({ ok: false, grund: 'kein-recht' });
      expect((await lesen(p)).inhalt).toEqual(standardInhalt());
    });

    it('kein Recht beim Anlegen der Kategorie (403) → kein-recht, nichts geschrieben', async () => {
      const { s, k, p } = aufbau(false);
      k.anlegenWirft = new Fehler(403);
      expect(await speichern(p, null)).toMatchObject({ ok: false, grund: 'kein-recht' });
      expect(s.schreibvorgaenge).toEqual([]);
    });

    it('abgemeldet (401) → abgemeldet', async () => {
      const { s, p } = aufbau();
      s.schreibenWirft = new Fehler(401);
      expect(await speichern(p, null)).toMatchObject({ ok: false, grund: 'abgemeldet' });
    });

    it('vorübergehend, nichts angekommen → voruebergehend, genau einmal geschrieben', async () => {
      const { s, p } = aufbau();
      s.schreibenWirft = new Fehler(503);
      expect(await speichern(p, null)).toMatchObject({ ok: false, grund: 'voruebergehend' });
      expect(s.schreibvorgaenge).toHaveLength(1);
    });

    it('vorübergehender Fehler, aber angekommen → beim Nachlesen Erfolg', async () => {
      const { s, p } = aufbau();
      s.schreibenWirft = new Fehler(504);
      s.trotzdemSchreiben = true;
      expect(await speichern(p, null)).toMatchObject({ ok: true, daten: { version: 1 } });
    });

    it('ChurchTools sagt OK, schreibt aber nichts → nicht-angekommen', async () => {
      const { s, p } = aufbau();
      s.verschlucken = true;
      expect(await speichern(p, null)).toMatchObject({ ok: false, grund: 'nicht-angekommen' });
    });

    it('Lesen vor dem Schreiben scheitert → voruebergehend, nichts geschrieben', async () => {
      const { s, p } = aufbau();
      s.lesenWirft = new Fehler(503);
      expect(await speichern(p, null)).toMatchObject({ ok: false, grund: 'voruebergehend' });
      expect(s.schreibvorgaenge).toEqual([]);
    });
  });
});

describe('fremde Werte in derselben Kategorie bleiben unberührt', () => {
  const BETRIEB = JSON.stringify({
    ...EINSTELLUNGEN_ART,
    version: 5,
    zeit: 'z',
    von: BEA,
    inhalt: { betriebsart: 'klicken' },
  });

  it('Betriebsart-Wert: bleibt beim Speichern von Abfragen wie er ist – und wird weiter gelesen', async () => {
    const { s, p } = aufbau();
    s.werte.push({ id: 900, dataCategoryId: KAT, value: BETRIEB });
    expect(await speichern(p, null)).toMatchObject({ ok: true, daten: { version: 1 } });
    expect(s.werte).toHaveLength(2);
    expect(s.werte[0]).toEqual({ id: 900, dataCategoryId: KAT, value: BETRIEB });
    expect(await einstellungenLesen(p, modul)).toMatchObject({
      betriebsart: 'klicken',
      gespeichert: { version: 5 },
    });
  });

  it('Abfragen werden vom Betriebsart-Speichern nicht berührt – beide lesen ihr eigenes', async () => {
    const { s, p } = aufbau();
    await speichern(p, null);
    const r = await einstellungenSpeichern(p, modul, { betriebsart: 'immer-uhr' }, ALEX, null);
    expect(r).toMatchObject({ ok: true, daten: { version: 1 } });
    expect(s.werte).toHaveLength(2);
    expect((await lesen(p)).inhalt).toEqual(INHALT);
    expect((await einstellungenLesen(p, modul)).betriebsart).toBe('immer-uhr');
  });

  it('Abfragen einer anderen Dienstgruppe: unberührt, eigene Version, eigener Konflikt', async () => {
    const { s, p, wert } = aufbau();
    const technik: AbfragenInhalt = {
      plan: null,
      abfragen: [],
      einrichtung: null,
      verfuegbarkeit: 'zusagen' as const,
    };
    s.werte.push({ id: 900, dataCategoryId: KAT, value: wert(TECHNIK, technik, 7, BEA) });
    expect(await speichern(p, null)).toMatchObject({ ok: true, daten: { version: 1 } });
    expect(s.werte[0].value).toBe(wert(TECHNIK, technik, 7, BEA));
    expect((await lesen(p, TECHNIK)).gespeichert).toMatchObject({ version: 7, von: BEA });
    expect((await lesen(p, MUSIK)).gespeichert).toMatchObject({ version: 1, von: ALEX });
    // Die Version der anderen Gruppe ist kein Konflikt für diese.
    expect(
      await speichern(p, 1, {
        plan: null,
        abfragen: [],
        einrichtung: null,
        verfuegbarkeit: 'zusagen' as const,
      }),
    ).toMatchObject({
      ok: true,
      daten: { version: 2 },
    });
    expect((await lesen(p, TECHNIK)).gespeichert?.version).toBe(7);
  });
});
