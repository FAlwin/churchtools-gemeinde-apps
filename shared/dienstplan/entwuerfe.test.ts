import { describe, expect, it } from 'vitest';
import type { Wert } from '../ct/modulDaten';
import type { PlatzOrt } from './einteilen';
import { Fehler } from './einteilen.testutil';
import { KAT, MODUL, speicher } from './entwuerfe.testutil';
import {
  entwurfAus,
  entwurfEntfernen,
  entwurfSpeichern,
  entwurfVeraltet,
  inhaltAusWerten,
  modulRechteAus,
  ortSchluessel,
  schublade,
  schubladenStand,
  type Entwurf,
  type EntwurfEingabe,
} from './entwuerfe';

const ORT: PlatzOrt = { eventId: 166, serviceId: 7, index: 1 };

const ALWIN = { personId: 1, name: 'Alwin' };
const SPIKE = { personId: 19, name: 'Spike' };

const eingabe = (x: Partial<EntwurfEingabe> = {}): EntwurfEingabe => ({
  ort: ORT,
  ziel: { art: 'person', personId: 46, name: 'Anna Test' },
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: ALWIN,
  ...x,
});

const entwurf = (x: Partial<Entwurf> = {}): Entwurf => ({
  ...eingabe(),
  zeit: '2026-10-14T19:00:00.000Z',
  version: 1,
  ...x,
});

const wert = (id: number, e: Entwurf | object): Wert => ({
  id,
  dataCategoryId: KAT,
  value: JSON.stringify({ art: 'dienstplaner-entwurf', fassung: 1, ...e }),
});

const gelesen = (werte: Wert[]) => inhaltAusWerten(werte).je.get(ortSchluessel(ORT))?.entwurf;

describe('Schublade je Dienstgruppe', () => {
  it('Kürzel an der ID (nicht am änderbaren Namen), Name höchstens 50 Zeichen', () => {
    expect(schublade({ id: 3, name: 'Technik' })).toMatchObject({
      kuerzel: 'dienstplaner-entwuerfe-3',
      name: 'Entwürfe Technik',
    });
    expect(schublade({ id: 9, name: 'x'.repeat(80) }).name).toHaveLength(50);
  });

  it('Stand aus den Rechten: fehlt / einrichtbar / nur lesen / bereit – Ändern braucht anlegen, ändern UND löschen', () => {
    const r = modulRechteAus({
      'create custom category': false,
      'view custom data': [30, 31],
      'create custom data': [30, 31],
      'edit custom data': [30, 31],
      'delete custom data': [30],
    });
    expect(schubladenStand(r, 30)).toBe('bereit');
    expect(schubladenStand(r, 31)).toBe('nur-lesen'); // löschen fehlt
    expect(schubladenStand(r, 32)).toBe('fehlt'); // ID bekannt, aber nicht sichtbar
    expect(schubladenStand(r, null)).toBe('fehlt');
    expect(schubladenStand({ ...r, anlegen: true }, null)).toBe('einrichtbar');
    expect(modulRechteAus(undefined)).toEqual({ anlegen: false, sehen: [], aendern: [] });
  });
});

describe('Lesen', () => {
  it('nur eigene, vollständige Werte zählen – fremd, kaputt, andere Fassung → übergangen', () => {
    expect(entwurfAus(wert(1, entwurf()))).toEqual(entwurf());
    expect(entwurfAus({ id: 2, dataCategoryId: KAT, value: '{kaputt' })).toBeNull();
    expect(entwurfAus(wert(3, { ...entwurf(), art: 'musikapp-teilen' }))).toBeNull();
    expect(
      entwurfAus({
        ...wert(4, entwurf()),
        value: wert(4, entwurf()).value.replace('"fassung":1', '"fassung":2'),
      }),
    ).toBeNull();
    expect(entwurfAus(wert(5, entwurf({ ziel: { art: 'gast', name: '  ' } })))).toBeNull();
    expect(entwurfAus(wert(6, { ...entwurf(), ort: { eventId: 1, serviceId: 2 } }))).toBeNull();
    expect(entwurfAus(wert(7, { ...entwurf(), gesehen: { art: 'anfrage' } }))).toBeNull();
  });

  it('zwei Werte für denselben Platz: höhere Version, dann spätere Zeit, dann höhere ID gewinnt', () => {
    const a = wert(10, entwurf({ version: 2, von: SPIKE }));
    const b = wert(11, entwurf({ version: 1 }));
    expect(gelesen([a, b])?.von).toEqual(SPIKE);
    expect(gelesen([b, a])?.von).toEqual(SPIKE);
    // Spätere Zeit, aber kleinere ID – sonst entschiede die ID, und die Zeit-Regel bliebe ungeprüft.
    const spaet = wert(9, entwurf({ zeit: '2026-10-14T19:05:00.000Z', von: SPIKE }));
    expect(gelesen([spaet, b])?.von).toEqual(SPIKE);
    const hoeher = wert(13, entwurf({ von: SPIKE }));
    expect(gelesen([hoeher, b])?.von).toEqual(SPIKE);
    expect(gelesen([b, hoeher])?.von).toEqual(SPIKE);
    expect(
      inhaltAusWerten([a, b])
        .doppelt.get(ortSchluessel(ORT))
        ?.map((w) => w.id),
    ).toEqual([11]);
  });

  it('Plätze ohne index (nur ein Platz im Dienst) bekommen einen eigenen Schlüssel', () => {
    expect(ortSchluessel({ ...ORT, index: null })).toBe('166|7|-');
    expect(ortSchluessel(ORT)).toBe('166|7|1');
  });
});

describe('Speichern', () => {
  it('neu: anlegen, Version 1, nachgelesen', async () => {
    const { s, port } = speicher();
    const r = await entwurfSpeichern(port, MODUL, KAT, eingabe(), null);
    expect(r).toMatchObject({ ok: true, entwurf: { version: 1, von: ALWIN } });
    expect(s.schreibvorgaenge.map((a) => a.method)).toEqual(['POST']);
    expect(gelesen(s.werte)?.ziel).toEqual({ art: 'person', personId: 46, name: 'Anna Test' });
  });

  it('ändern: derselbe Wert, Version zählt hoch', async () => {
    const { s, port } = speicher([wert(100, entwurf())]);
    const r = await entwurfSpeichern(port, MODUL, KAT, eingabe({ modus: 'direkt' }), 1);
    expect(r).toMatchObject({ ok: true, entwurf: { version: 2, modus: 'direkt' } });
    expect(s.schreibvorgaenge.map((a) => a.method)).toEqual(['PUT']);
    expect(s.werte.map((w) => w.id)).toEqual([100]);
  });

  it('ein anderer war schneller (andere Version) → konflikt mit dem, was jetzt dasteht; nichts geschrieben', async () => {
    const { s, port } = speicher([wert(100, entwurf({ von: SPIKE, version: 2 }))]);
    const r = await entwurfSpeichern(
      port,
      MODUL,
      KAT,
      eingabe({ ziel: { art: 'gast', name: 'Max' } }),
      1,
    );
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { von: SPIKE, version: 2 } });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('neu gedacht, aber inzwischen hat jemand einen Entwurf angelegt → konflikt', async () => {
    const { s, port } = speicher([wert(100, entwurf({ von: SPIKE }))]);
    const r = await entwurfSpeichern(
      port,
      MODUL,
      KAT,
      eingabe({ ziel: { art: 'gast', name: 'Max' } }),
      null,
    );
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { von: SPIKE } });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('„Trotzdem eintragen“: mit der Version aus dem Konflikt geht es', async () => {
    const { port } = speicher([wert(100, entwurf({ von: SPIKE, version: 2 }))]);
    const r = await entwurfSpeichern(port, MODUL, KAT, eingabe(), 2);
    expect(r).toMatchObject({ ok: true, entwurf: { version: 3, von: ALWIN } });
  });

  it('schon so gespeichert (ein früherer Versuch kam doch an) → Erfolg ohne Schreiben', async () => {
    const { s, port } = speicher([wert(100, entwurf())]);
    expect(await entwurfSpeichern(port, MODUL, KAT, eingabe(), null)).toMatchObject({ ok: true });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('gleichzeitig angelegt (zwei POST) und der andere gewinnt → konflikt, nicht „gespeichert“', async () => {
    const { s, port } = speicher();
    s.vorher = (a) => {
      if (a.method !== 'POST') return;
      s.vorher = null;
      // Spike legt im selben Augenblick an – mit späterer Zeit gewinnt er.
      s.werte.push(wert(500, entwurf({ von: SPIKE, zeit: '2026-10-14T21:00:00.000Z' })));
    };
    const r = await entwurfSpeichern(port, MODUL, KAT, eingabe(), null);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { von: SPIKE } });
  });

  it('derselbe Planer auf zwei Geräten gleichzeitig: der Eintrag des anderen Geräts ist nicht „meiner“', async () => {
    const { s, port } = speicher();
    s.vorher = (a) => {
      if (a.method !== 'POST') return;
      s.vorher = null;
      // Alwins Handy legt im selben Augenblick einen anderen Entwurf an – gleiche Person, gleiche Version.
      s.werte.push(
        wert(
          500,
          entwurf({ ziel: { art: 'gast', name: 'Max' }, zeit: '2026-10-14T21:00:00.000Z' }),
        ),
      );
    };
    const r = await entwurfSpeichern(port, MODUL, KAT, eingabe(), null);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: { ziel: { art: 'gast' } } });
  });

  it('vorübergehender Fehler, aber angekommen → Erfolg; nie ein zweiter Schreibversuch', async () => {
    const { s, port } = speicher();
    s.schreibenWirft = new Fehler(503);
    s.trotzdemSchreiben = true;
    expect(await entwurfSpeichern(port, MODUL, KAT, eingabe(), null)).toMatchObject({ ok: true });
    expect(s.schreibvorgaenge).toHaveLength(1);
  });

  it('vorübergehender Fehler, nicht angekommen → „vorübergehend“; nie ein zweiter Schreibversuch', async () => {
    for (const status of [503, 504, 429, null]) {
      const { s, port } = speicher();
      s.schreibenWirft = new Fehler(status);
      expect(await entwurfSpeichern(port, MODUL, KAT, eingabe(), null)).toMatchObject({
        ok: false,
        grund: 'voruebergehend',
      });
      expect(s.schreibvorgaenge).toHaveLength(1);
    }
  });

  it('abgemeldet bzw. kein Recht beim Schreiben → genau das, ohne Nachlesen zu raten', async () => {
    for (const [status, grund] of [
      [401, 'abgemeldet'],
      [403, 'kein-recht'],
    ] as const) {
      const { s, port } = speicher();
      s.schreibenWirft = new Fehler(status);
      expect(await entwurfSpeichern(port, MODUL, KAT, eingabe(), null)).toEqual({
        ok: false,
        grund,
      });
    }
  });

  it('beim Ändern inzwischen gelöscht (404) → konflikt', async () => {
    const { s, port } = speicher([wert(100, entwurf())]);
    s.vorher = () => {
      s.werte = [];
    };
    const r = await entwurfSpeichern(port, MODUL, KAT, eingabe({ modus: 'direkt' }), 1);
    expect(r).toMatchObject({ ok: false, grund: 'konflikt', jetzt: null });
  });

  it('ChurchTools sagt OK, nachgelesen steht es aber nicht da → „nicht angekommen“', async () => {
    const { s, port } = speicher();
    s.verschlucken = true;
    expect(await entwurfSpeichern(port, MODUL, KAT, eingabe(), null)).toMatchObject({
      ok: false,
      grund: 'nicht-angekommen',
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
      expect(await entwurfSpeichern(port, MODUL, KAT, eingabe(), null)).toEqual({
        ok: false,
        grund,
      });
      expect(s.schreibvorgaenge).toEqual([]);
    }
  });

  it('zu lang für einen Wert → „zu groß“, nichts geschrieben', async () => {
    const { s, port } = speicher();
    const r = await entwurfSpeichern(
      port,
      MODUL,
      KAT,
      eingabe({ ziel: { art: 'gast', name: 'x'.repeat(10_000) } }),
      null,
    );
    expect(r).toEqual({ ok: false, grund: 'zu-gross' });
    expect(s.schreibvorgaenge).toEqual([]);
  });
});

describe('Entfernen', () => {
  it('entfernt den Entwurf und auch doppelte Werte desselben Platzes', async () => {
    const { s, port } = speicher([
      wert(100, entwurf({ version: 2 })),
      wert(101, entwurf({ von: SPIKE })),
    ]);
    expect(await entwurfEntfernen(port, MODUL, KAT, ORT, 2)).toEqual({ ok: true, entwurf: null });
    expect(s.werte).toEqual([]);
  });

  it('schon weg → Erfolg ohne Schreiben', async () => {
    const { s, port } = speicher();
    expect(await entwurfEntfernen(port, MODUL, KAT, ORT, 1)).toEqual({ ok: true, entwurf: null });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('inzwischen geändert (andere Version) → konflikt, nichts gelöscht', async () => {
    const { s, port } = speicher([wert(100, entwurf({ version: 3, von: SPIKE }))]);
    expect(await entwurfEntfernen(port, MODUL, KAT, ORT, 2)).toMatchObject({
      ok: false,
      grund: 'konflikt',
      jetzt: { version: 3 },
    });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('mittendrin unterbrochen und ein eigener Doppel-Wert bleibt → „vorübergehend“, nicht „konflikt“', async () => {
    const { s, port } = speicher([wert(100, entwurf({ version: 2 })), wert(101, entwurf())]);
    s.vorher = (a) => {
      if (a.method === 'DELETE' && s.werte.length === 1) throw new Fehler(503);
    };
    expect(await entwurfEntfernen(port, MODUL, KAT, ORT, 2)).toMatchObject({
      ok: false,
      grund: 'voruebergehend',
    });
  });

  it('gleichzeitig hat jemand neu eingetragen → konflikt mit seinem Entwurf', async () => {
    const { s, port } = speicher([wert(100, entwurf())]);
    s.vorher = () => {
      s.vorher = null;
      s.werte.push(wert(300, entwurf({ von: SPIKE, zeit: '2026-10-14T22:00:00.000Z' })));
    };
    expect(await entwurfEntfernen(port, MODUL, KAT, ORT, 1)).toMatchObject({
      ok: false,
      grund: 'konflikt',
      jetzt: { von: SPIKE },
    });
  });

  it('ChurchTools sagt OK, der Wert steht aber noch da → „nicht angekommen“', async () => {
    const { s, port } = speicher([wert(100, entwurf())]);
    s.verschlucken = true;
    expect(await entwurfEntfernen(port, MODUL, KAT, ORT, 1)).toMatchObject({
      ok: false,
      grund: 'nicht-angekommen',
    });
  });
});

describe('Veraltet (in ChurchTools steht inzwischen etwas anderes)', () => {
  it('dieselbe Regel wie beim Einteilen: nur eine andere Person zählt, eine Zusage derselben nicht', () => {
    const frei = entwurf({ gesehen: { art: 'frei' } });
    expect(entwurfVeraltet(frei, { art: 'frei' })).toBe(false);
    expect(entwurfVeraltet(frei, { art: 'anfrage', personId: 47 })).toBe(true);
    const angefragt = entwurf({ gesehen: { art: 'anfrage', personId: 47 } });
    expect(entwurfVeraltet(angefragt, { art: 'zusage', personId: 47 })).toBe(false);
    expect(entwurfVeraltet(angefragt, { art: 'anfrage', personId: 48 })).toBe(true);
    expect(entwurfVeraltet(angefragt, { art: 'frei' })).toBe(true);
    const gast = entwurf({ gesehen: { art: 'gast', name: 'Max ' } });
    expect(entwurfVeraltet(gast, { art: 'gast', name: 'Max' })).toBe(false);
  });
});
