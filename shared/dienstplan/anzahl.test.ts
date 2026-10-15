import { describe, expect, it } from 'vitest';
import { anzahlAendern, zaehle } from './anzahl';
import { nachbau } from './einteilen.testutil';
import type { RohPlatz, RohTermin } from './termine';

// Termin 7: Video (8) ein freier Platz; Gesang (9) zwei Plätze, einer belegt.
const VIDEO = 8;
const GESANG = 9;
const plaetze = (): RohPlatz[] => [
  { id: 1, serviceId: VIDEO, index: null, personId: null, name: null },
  { id: 2, serviceId: GESANG, index: 1, personId: 46, name: 'Anna', isAccepted: true },
  { id: 3, serviceId: GESANG, index: 2, personId: null, name: null },
];
const anzahl = (c: ReturnType<typeof nachbau>, sid: number) =>
  c.ct.plaetze.filter((p) => p.serviceId === sid).length;

describe('zaehle', () => {
  it('Plätze und belegte je Dienst', () => {
    const t = { id: 7, eventServices: plaetze() } as RohTermin;
    expect(zaehle(t, GESANG)).toEqual({ anzahl: 2, belegt: 1 });
    expect(zaehle(t, VIDEO)).toEqual({ anzahl: 1, belegt: 0 });
    expect(zaehle(t, 99)).toEqual({ anzahl: 0, belegt: 0 });
  });
});

describe('anzahlAendern – Erfolg erst, wenn die Zahl nachgelesen dasteht', () => {
  it('mehr: genau dieser Dienst, richtiger Rumpf, nachgelesen', async () => {
    const c = nachbau(plaetze());
    expect(await anzahlAendern(c.port, 7, VIDEO, 1, 2)).toEqual({ ok: true, anzahl: 2 });
    expect(c.ct.geschrieben).toEqual([
      {
        pfad: '/events/7/eventservices',
        method: 'PUT',
        json: { eventId: 7, services: [{ serviceId: VIDEO, count: 2 }] },
      },
    ]);
    expect([anzahl(c, VIDEO), anzahl(c, GESANG)]).toEqual([2, 2]);
  });

  it('weniger: leere fallen weg, die belegte bleibt; bis auf 0 (Dienst nicht mehr vorgesehen)', async () => {
    const c = nachbau(plaetze());
    expect(await anzahlAendern(c.port, 7, GESANG, 2, 1)).toEqual({ ok: true, anzahl: 1 });
    expect(c.ct.plaetze.find((p) => p.serviceId === GESANG)).toMatchObject({ personId: 46 });
    expect(await anzahlAendern(c.port, 7, VIDEO, 1, 0)).toEqual({ ok: true, anzahl: 0 });
  });

  it('weniger als belegt → „belegt“, nichts geschrieben', async () => {
    const c = nachbau(plaetze());
    expect(await anzahlAendern(c.port, 7, GESANG, 2, 0)).toEqual({
      ok: false,
      grund: 'belegt',
      jetzt: 2,
    });
    expect(c.ct.geschrieben).toEqual([]);
  });

  it('steht schon so da (ein früherer Versuch kam doch an) → Erfolg ohne Schreiben', async () => {
    const c = nachbau(plaetze());
    expect(await anzahlAendern(c.port, 7, VIDEO, 1, 1)).toEqual({ ok: true, anzahl: 1 });
    expect(await anzahlAendern(c.port, 7, GESANG, 1, 2)).toEqual({ ok: true, anzahl: 2 });
    expect(c.ct.geschrieben).toEqual([]);
  });

  it('ein anderer hat die Zahl inzwischen geändert → Konflikt mit „jetzt“, nichts geschrieben', async () => {
    const c = nachbau(plaetze());
    expect(await anzahlAendern(c.port, 7, GESANG, 3, 4)).toEqual({
      ok: false,
      grund: 'konflikt',
      jetzt: 2,
    });
    expect(c.ct.geschrieben).toEqual([]);
  });
});

describe('anzahlAendern – jeder Fehlerzweig einzeln, nie ein zweiter Schreibversuch', () => {
  it('Lesen scheitert vorher: abgemeldet / kein Recht / weg / vorübergehend – nichts geschrieben', async () => {
    for (const [status, grund] of [
      [401, 'abgemeldet'],
      [403, 'kein-recht'],
      [404, 'weg'],
      [502, 'voruebergehend'],
      [null, 'voruebergehend'],
    ] as const) {
      const c = nachbau(plaetze());
      c.ct.lesenFehler = [status];
      expect(await anzahlAendern(c.port, 7, VIDEO, 1, 2)).toEqual({ ok: false, grund });
      expect(c.ct.geschrieben).toEqual([]);
    }
  });

  it('Schreiben: abgemeldet bzw. kein Recht → genau das, ohne Nachlesen zu raten', async () => {
    for (const [status, grund] of [
      [401, 'abgemeldet'],
      [403, 'kein-recht'],
    ] as const) {
      const c = nachbau(plaetze());
      c.ct.schreibenFehler = status;
      c.ct.trotzdemSchreiben = true; // selbst wenn es ankäme: 401/403 heißt „nicht erlaubt“
      expect(await anzahlAendern(c.port, 7, VIDEO, 1, 2)).toEqual({ ok: false, grund });
      expect(c.ct.geschrieben).toHaveLength(1);
    }
  });

  it('vorübergehend, aber doch angekommen → Erfolg (nachgelesen)', async () => {
    const c = nachbau(plaetze());
    c.ct.schreibenFehler = 504;
    c.ct.trotzdemSchreiben = true;
    expect(await anzahlAendern(c.port, 7, VIDEO, 1, 2)).toEqual({ ok: true, anzahl: 2 });
    expect(c.ct.geschrieben).toHaveLength(1);
  });

  it('vorübergehend und nicht angekommen → „vorübergehend“ mit „jetzt“', async () => {
    const c = nachbau(plaetze());
    c.ct.schreibenFehler = null;
    expect(await anzahlAendern(c.port, 7, VIDEO, 1, 2)).toEqual({
      ok: false,
      grund: 'voruebergehend',
      jetzt: 1,
    });
    expect(c.ct.geschrieben).toHaveLength(1);
  });

  it('ChurchTools sagt OK, nachgelesen steht die alte Zahl → „nicht angekommen“', async () => {
    const c = nachbau(plaetze());
    // ChurchTools nimmt an, ändert aber nichts.
    c.port.schreibe = (pfad, a) => {
      c.ct.geschrieben.push({ pfad, method: a.method, json: a.json });
      return Promise.resolve();
    };
    expect(await anzahlAendern(c.port, 7, VIDEO, 1, 2)).toEqual({
      ok: false,
      grund: 'nicht-angekommen',
      jetzt: 1,
    });
  });

  it('Nachlesen scheitert → dessen Grund (ob es ankam, weiß niemand)', async () => {
    const c = nachbau(plaetze());
    // Erstes Lesen klappt, das Nachlesen nicht (Netz).
    let n = 0;
    const termin = c.port.termin.bind(c.port);
    c.port.termin = (id) => (n++ === 0 ? termin(id) : Promise.reject(new Error('Netz')));
    expect(await anzahlAendern(c.port, 7, VIDEO, 1, 2)).toEqual({
      ok: false,
      grund: 'voruebergehend',
    });
  });
});
