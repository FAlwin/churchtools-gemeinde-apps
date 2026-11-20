import { describe, expect, it } from 'vitest';
import type { Wert } from '../ct/modulDaten';
import { Fehler } from './einteilen.testutil';
import { KAT, MODUL, speicher } from './entwuerfe.testutil';
import { inhaltAusWerten, ortSchluessel, type Entwurf } from './entwuerfe';
import { BEGLEITUNG, LEITUNG, listeRoh, listeWert } from './personenliste.testutil';
import { pauseSetzen, reiheSetzen, tagListeSetzen, type ListeInhalt } from './personenliste';
import { personenlisteSpeichern } from './personenlisteSpeichern';

const pl = (id: number, x: Parameters<typeof listeWert>[0] = {}) => listeWert(x, id);
/** Was ein Leser nach dem Schreiben aus dem Speicher holt – die Wahrheit, gegen die jeder Test prüft. */
const gelesen = (werte: Wert[]) => inhaltAusWerten(werte).personenliste;
const entwurfWert: Wert = {
  id: 5,
  dataCategoryId: KAT,
  value: JSON.stringify({
    art: 'dienstplaner-entwurf',
    fassung: 1,
    ort: { eventId: 166, serviceId: 7, index: 1 },
    ziel: { art: 'person', personId: 46, name: 'Anna Test' },
    modus: 'anfrage',
    gesehen: { art: 'frei' },
    von: { personId: 1, name: 'Alwin' },
    zeit: '2026-10-14T19:00:00.000Z',
    version: 1,
  } satisfies Entwurf & { art: string; fassung: number }),
};

/** Eine Änderung wie sie das Fenster macht – absolut, nicht „auf dem alten Stand weiterrechnen“. */
const reihe =
  (r: number[]) =>
  (alt: ListeInhalt | null): ListeInhalt =>
    reiheSetzen(alt, r);

describe('Personenliste speichern', () => {
  it('neu: es gibt noch keine Liste → anlegen (POST), Version 1, nachgelesen – und der Leser liest genau das', async () => {
    const { s, port } = speicher();
    const r = await personenlisteSpeichern(port, MODUL, KAT, reihe([3, 1]), null);
    expect(r).toMatchObject({ ok: true, liste: { version: 1, reihe: [3, 1] } });
    expect(s.schreibvorgaenge.map((a) => a.method)).toEqual(['POST']);
    expect(gelesen(s.werte)).toEqual(r.ok ? r.liste : null);
  });

  it('ändern: derselbe Wert (PUT), Version zählt hoch, Zeit ist neu; die anderen Teile der Liste bleiben', async () => {
    const { s, port } = speicher([
      pl(900, { version: 1, reihe: [1], tags: [BEGLEITUNG], pause: { '2': {} } }),
    ]);
    const r = await personenlisteSpeichern(port, MODUL, KAT, reihe([2, 1]), 1);
    expect(r).toMatchObject({
      ok: true,
      liste: { version: 2, reihe: [2, 1], tags: [BEGLEITUNG], pause: { '2': {} } },
    });
    expect(s.schreibvorgaenge.map((a) => a.method)).toEqual(['PUT']);
    expect(s.werte.map((w) => w.id)).toEqual([900]);
    expect(gelesen(s.werte)?.zeit).not.toBe('2026-11-20T10:00:00.000Z');
  });

  it('`aendern` bekommt die FRISCH gelesene Liste, nicht den Stand von früher', async () => {
    const { port } = speicher([pl(900, { version: 4, reihe: [8] })]);
    let gesehen: unknown = null;
    await personenlisteSpeichern(
      port,
      MODUL,
      KAT,
      (alt) => {
        gesehen = alt;
        return reiheSetzen(alt, [9]);
      },
      4,
    );
    expect(gesehen).toMatchObject({ version: 4, reihe: [8] });
  });

  it('ein anderer Planer war schneller (andere Version) → konflikt mit dem, was jetzt dasteht; nichts geschrieben', async () => {
    const { s, port } = speicher([pl(900, { version: 3, reihe: [7] })]);
    const r = await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), 2);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { version: 3, reihe: [7] } });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('neu gedacht (erwartet null), aber inzwischen gibt es eine Liste → konflikt', async () => {
    const { s, port } = speicher([pl(900, { version: 1, reihe: [7] })]);
    const r = await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), null);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { reihe: [7] } });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('gleichzeitig angelegt (zwei POST) und der andere gewinnt → konflikt, nicht „gespeichert“', async () => {
    const { s, port } = speicher();
    s.vorher = (a) => {
      if (a.method !== 'POST') return;
      s.vorher = null;
      // Ein anderer Planer legt im selben Augenblick an – mit späterer Zeit gewinnt er.
      s.werte.push(pl(500, { version: 1, reihe: [7], zeit: '2026-10-14T21:00:00.000Z' }));
    };
    const r = await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), null);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { reihe: [7] } });
  });

  it('zwei Werte liegen schon da (früher gleichzeitig angelegt): der Gewinner wird geändert, der Verlierer mitgelöscht', async () => {
    const { s, port } = speicher([
      pl(900, { version: 2, reihe: [1] }),
      pl(901, { version: 1, reihe: [9] }),
    ]);
    const r = await personenlisteSpeichern(port, MODUL, KAT, reihe([2]), 2);
    expect(r).toMatchObject({ ok: true, liste: { version: 3, reihe: [2] } });
    // Erst die Doppelten, dann die Liste selbst.
    expect(s.schreibvorgaenge.map((a) => a.method)).toEqual(['DELETE', 'PUT']);
    expect(s.werte.map((w) => w.id)).toEqual([900]);
  });

  it('ein Doppelter lässt sich nicht löschen (vorübergehend) → nichts geändert, „vorübergehend“', async () => {
    const { s, port } = speicher([
      pl(900, { version: 2, reihe: [1] }),
      pl(901, { version: 1, reihe: [9] }),
    ]);
    s.schreibenWirft = new Fehler(503);
    const r = await personenlisteSpeichern(port, MODUL, KAT, reihe([2]), 2);
    expect(r).toMatchObject({ ok: false, grund: 'voruebergehend', jetzt: { reihe: [1] } });
    expect(s.schreibvorgaenge).toHaveLength(1);
  });

  it('vorübergehender Fehler, aber angekommen → Erfolg; nie ein zweiter Schreibversuch', async () => {
    const { s, port } = speicher();
    s.schreibenWirft = new Fehler(503);
    s.trotzdemSchreiben = true;
    expect(await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), null)).toMatchObject({
      ok: true,
    });
    expect(s.schreibvorgaenge).toHaveLength(1);
  });

  it('vorübergehender Fehler, nicht angekommen → „vorübergehend“ (Netz, 429, 5xx, Zeitüberschreitung); nie ein zweiter Versuch', async () => {
    for (const status of [503, 504, 429, null]) {
      const { s, port } = speicher([pl(900, { version: 1 })]);
      s.schreibenWirft = new Fehler(status);
      expect(await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), 1)).toMatchObject({
        ok: false,
        grund: 'voruebergehend',
        jetzt: { version: 1 },
      });
      expect(s.schreibvorgaenge).toHaveLength(1);
      // Nichts wurde zerstört: die alte Liste steht noch da.
      expect(gelesen(s.werte)?.version).toBe(1);
    }
  });

  it('abgemeldet bzw. kein Recht beim Schreiben → genau das, ohne Nachlesen zu raten', async () => {
    for (const [status, grund] of [
      [401, 'abgemeldet'],
      [403, 'kein-recht'],
    ] as const) {
      const { s, port } = speicher();
      s.schreibenWirft = new Fehler(status);
      expect(await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), null)).toEqual({
        ok: false,
        grund,
      });
    }
  });

  it('beim Ändern inzwischen gelöscht (404) → konflikt', async () => {
    const { s, port } = speicher([pl(900, { version: 1 })]);
    s.vorher = () => {
      s.werte = [];
    };
    const r = await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), 1);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: null });
  });

  it('ChurchTools sagt OK, nachgelesen steht es aber nicht da → „nicht angekommen“', async () => {
    const { s, port } = speicher();
    s.verschlucken = true;
    expect(await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), null)).toMatchObject({
      ok: false,
      grund: 'nicht-angekommen',
    });
    // Dasselbe beim Ändern: die alte Version steht noch.
    const { s: s2, port: p2 } = speicher([pl(900, { version: 1 })]);
    s2.verschlucken = true;
    expect(await personenlisteSpeichern(p2, MODUL, KAT, reihe([1]), 1)).toMatchObject({
      ok: false,
      grund: 'nicht-angekommen',
      jetzt: { version: 1 },
    });
  });

  it('Lesen scheitert vorher → nichts geschrieben; abgemeldet / kein Recht / vorübergehend getrennt', async () => {
    for (const [status, grund] of [
      [401, 'abgemeldet'],
      [403, 'kein-recht'],
      [502, 'voruebergehend'],
    ] as const) {
      const { s, port } = speicher();
      s.lesenWirft = new Fehler(status);
      expect(await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), null)).toEqual({
        ok: false,
        grund,
      });
      expect(s.schreibvorgaenge).toEqual([]);
    }
  });

  it('Nachlesen scheitert nach dem Schreiben → der Grund des Lesefehlers, nicht „angekommen“', async () => {
    const { s, port } = speicher();
    s.vorher = () => {
      s.vorher = null;
      s.lesenWirft = new Fehler(502);
    };
    expect(await personenlisteSpeichern(port, MODUL, KAT, reihe([1]), null)).toEqual({
      ok: false,
      grund: 'voruebergehend',
    });
  });

  it('zu lang für einen Wert → „zu groß“, nichts geschrieben', async () => {
    const { s, port } = speicher();
    const viele = Array.from({ length: 400 }, (_, i) => ({
      name: `Tag-Nummer-${i}-${'x'.repeat(20)}`,
      kuerzel: 'T',
    }));
    const r = await personenlisteSpeichern(
      port,
      MODUL,
      KAT,
      (alt) => tagListeSetzen(alt, viele),
      null,
    );
    expect(r).toEqual({ ok: false, grund: 'zu-gross' });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('schon so gespeichert (ein früherer Versuch kam doch an) → Erfolg ohne Schreiben – auch mit der alten Version', async () => {
    const { s, port } = speicher([pl(900, { version: 5, reihe: [2, 1] })]);
    const r = await personenlisteSpeichern(port, MODUL, KAT, reihe([2, 1]), 4);
    expect(r).toMatchObject({ ok: true, liste: { version: 5 } });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('die Reihenfolge der Schlüssel macht keinen Unterschied für „schon so gespeichert“', async () => {
    const { s, port } = speicher([
      pl(900, { version: 1, tagsVon: { '9|4': ['b'], '6|4': ['b'] }, tags: [BEGLEITUNG] }),
    ]);
    const r = await personenlisteSpeichern(
      port,
      MODUL,
      KAT,
      () => ({ ...listeRoh({ tags: [BEGLEITUNG], tagsVon: { '6|4': ['b'], '9|4': ['b'] } }) }),
      1,
    );
    expect(r).toMatchObject({ ok: true });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('Entwürfe in der Schublade bleiben unberührt – Schreiben und Doppelte-Löschen fassen nur die Liste an', async () => {
    const { s, port } = speicher([
      entwurfWert,
      pl(900, { version: 2, reihe: [1] }),
      pl(901, { version: 1 }),
    ]);
    await personenlisteSpeichern(port, MODUL, KAT, reihe([2]), 2);
    expect(s.werte.find((w) => w.id === 5)).toEqual(entwurfWert);
    expect([...inhaltAusWerten(s.werte).je.keys()]).toEqual([
      ortSchluessel({ eventId: 166, serviceId: 7, index: 1 }),
    ]);
  });

  it('jede reine Änderung geht durch das Speichern und wird vom Leser angenommen (Tags, Pause, Reihenfolge nacheinander)', async () => {
    const { s, port } = speicher();
    let v: number | null = null;
    const schritt = async (f: (alt: ListeInhalt | null) => ListeInhalt) => {
      const r = await personenlisteSpeichern(port, MODUL, KAT, f, v);
      expect(r.ok).toBe(true);
      v = r.ok ? r.liste.version : v;
    };
    await schritt((alt) => tagListeSetzen(alt, [{ name: 'Begleitung', kuerzel: 'b' }, LEITUNG]));
    await schritt((alt) => pauseSetzen(alt, 4, { bis: '2027-01-31' }));
    await schritt((alt) => reiheSetzen(alt, [4, 1]));
    expect(gelesen(s.werte)).toMatchObject({
      version: 3,
      reihe: [4, 1],
      pause: { '4': { bis: '2027-01-31' } },
    });
    expect(gelesen(s.werte)?.tags.map((t) => t.kuerzel)).toEqual(['B', 'L']);
  });
});
