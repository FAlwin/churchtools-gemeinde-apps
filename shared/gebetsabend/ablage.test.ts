import { describe, expect, it } from 'vitest';
import { KAT, MODUL, speicher } from '../dienstplan/entwuerfe.testutil';
import { Fehler } from '../dienstplan/einteilen.testutil';
import { einstellungenLesen, einstellungenSpeichern, zugangLesen, zugangSpeichern } from './ablage';
import { STANDARD_EINSTELLUNGEN } from './einstellungen';
import { beendet } from './technik';
import { neuerZugang, ZUGANG_DOKUMENT } from './zugang';

// Gegen den nachgebauten Speicher der Erweiterung (wie gemessen) und durch die echten Schreiber – nicht gegen
// abgeschriebene Werte.
const TECHNIK = { personId: 7, name: 'Jakob Penner' };
const V = 'kein Recht';
const z = () => neuerZugang(true, '2026-11-12T18:30:00.000Z');

describe('Zugang', () => {
  it('noch nichts gespeichert → kein Zugang, Version null', async () => {
    const { port } = speicher();
    expect(await zugangLesen(port, MODUL, KAT)).toEqual({
      ok: true,
      stand: { version: null, inhalt: null },
    });
  });

  it('starten und beenden: hin und zurück unverändert, Version zählt hoch', async () => {
    const { port } = speicher();
    const a = z();
    const r1 = await zugangSpeichern(port, MODUL, KAT, a, TECHNIK, null, V);
    expect(r1).toEqual({ ok: true, stand: { version: 1, inhalt: a } });
    const r2 = await zugangSpeichern(port, MODUL, KAT, beendet(a), TECHNIK, 1, V);
    expect(r2).toEqual({ ok: true, stand: { version: 2, inhalt: beendet(a) } });
    expect(await zugangLesen(port, MODUL, KAT)).toEqual({
      ok: true,
      stand: { version: 2, inhalt: beendet(a) },
    });
  });

  it('zwei Technik-Geräte starten zugleich → der zweite bekommt einen Konflikt, NICHTS überschrieben', async () => {
    const { port } = speicher();
    const erster = z();
    await zugangSpeichern(port, MODUL, KAT, erster, TECHNIK, null, V);
    const r = await zugangSpeichern(port, MODUL, KAT, z(), { personId: 8, name: 'Bea' }, null, V);
    expect(r).toEqual({
      ok: false,
      grund: 'konflikt',
      jetzt: { version: 1, inhalt: erster },
    });
  });

  it('ChurchTools sagt OK, schreibt aber nichts → nicht angekommen (kein „gestartet“)', async () => {
    const { s, port } = speicher();
    s.verschlucken = true;
    const r = await zugangSpeichern(port, MODUL, KAT, z(), TECHNIK, null, V);
    expect(r).toMatchObject({ ok: false, grund: 'nicht-angekommen' });
  });

  it('Lesefehler bleibt ein Fehler – nicht „keine Übertragung“', async () => {
    const { s, port } = speicher();
    s.lesenWirft = new Fehler(503);
    expect(await zugangLesen(port, MODUL, KAT)).toEqual({ ok: false, grund: 'voruebergehend' });
  });

  it('ein Dokument mit unbrauchbarem Inhalt gilt als „kein Zugang“, seine Version bleibt – sonst säße die Technik fest', async () => {
    const { s, port } = speicher();
    s.werte.push({
      id: 1,
      dataCategoryId: KAT,
      value: JSON.stringify({
        ...ZUGANG_DOKUMENT,
        version: 4,
        zeit: 'x',
        von: TECHNIK,
        inhalt: { streamId: 'mit-strich', passwort: 'p' },
      }),
    });
    expect(await zugangLesen(port, MODUL, KAT)).toEqual({
      ok: true,
      stand: { version: 4, inhalt: null },
    });
    const r = await zugangSpeichern(port, MODUL, KAT, z(), TECHNIK, 4, V);
    expect(r).toMatchObject({ ok: true, stand: { version: 5 } });
  });

  it('der alte Wert ohne Version (bis G2) zählt nicht als Zugang', async () => {
    const { s, port } = speicher();
    s.werte.push({
      id: 1,
      dataCategoryId: KAT,
      value: JSON.stringify({ art: ZUGANG_DOKUMENT.art, fassung: 1, ...z() }),
    });
    expect(await zugangLesen(port, MODUL, KAT)).toEqual({
      ok: true,
      stand: { version: null, inhalt: null },
    });
  });
});

describe('Einstellungen', () => {
  it('nichts gespeichert → Vorgabe; speichern und lesen unverändert', async () => {
    const { port } = speicher();
    expect(await einstellungenLesen(port, MODUL, KAT)).toEqual({
      ok: true,
      stand: { version: null, inhalt: STANDARD_EINSTELLUNGEN },
    });
    const e = { kalender: 3, suchwort: 'Gebetsabend' };
    expect(await einstellungenSpeichern(port, MODUL, KAT, e, TECHNIK, null, V)).toEqual({
      ok: true,
      stand: { version: 1, inhalt: e },
    });
    expect(await einstellungenLesen(port, MODUL, KAT)).toEqual({
      ok: true,
      stand: { version: 1, inhalt: e },
    });
  });

  it('ein anderer hat inzwischen gespeichert → Konflikt mit dessen Stand', async () => {
    const { port } = speicher();
    await einstellungenSpeichern(
      port,
      MODUL,
      KAT,
      { kalender: 1, suchwort: 'A' },
      TECHNIK,
      null,
      V,
    );
    const r = await einstellungenSpeichern(
      port,
      MODUL,
      KAT,
      { kalender: 2, suchwort: 'B' },
      TECHNIK,
      null,
      V,
    );
    expect(r).toEqual({
      ok: false,
      grund: 'konflikt',
      jetzt: { version: 1, inhalt: { kalender: 1, suchwort: 'A' } },
    });
  });
});
