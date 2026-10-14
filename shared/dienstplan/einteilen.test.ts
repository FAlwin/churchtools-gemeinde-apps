import { describe, expect, it } from 'vitest';
import { belegungAus, platzEinteilen, type DienstPort, type PlatzOrt } from './einteilen';
import type { RohPlatz, RohTermin } from './termine';

/** Ein Fehler mit HTTP-Status, wie ihn der Port wirft; `null` = keine Antwort. */
class Fehler extends Error {
  constructor(readonly status: number | null) {
    super(`HTTP ${status}`);
  }
}

/**
 * ChurchTools zum Anfassen, wie in E0/E4-0 gemessen: jedes Schreiben vergibt eine **neue ID**, Schreiben
 * auf eine veraltete ID meldet trotzdem Erfolg und ändert **nichts**, `decline` leert den Platz.
 */
function nachbau(plaetze: RohPlatz[]) {
  let naechsteId = 900;
  const ct = {
    plaetze: plaetze.map((p) => ({ ...p })),
    geschrieben: [] as { pfad: string; method: string; json: unknown }[],
    lesenFehler: [] as (number | null)[],
    /** `undefined` = Schreiben klappt; `null` = keine Antwort (Netz, Zeitüberschreitung). */
    schreibenFehler: undefined as number | null | undefined,
    /** Schreibt ChurchTools trotz Fehler (Antwort ging verloren)? */
    trotzdemSchreiben: false,
    /** Ein anderer Planer schreibt zwischen Lesen und Schreiben. */
    dazwischen: null as null | (() => void),
  };
  const ersetze = (alteId: number, neu: Partial<RohPlatz>) => {
    const i = ct.plaetze.findIndex((p) => p.id === alteId);
    if (i < 0) return; // veraltete ID: 200, aber nichts passiert
    ct.plaetze[i] = { ...ct.plaetze[i], ...neu, id: naechsteId++ };
  };
  const port: DienstPort = {
    termin(eventId) {
      const f = ct.lesenFehler.shift();
      if (f !== undefined) return Promise.reject(new Fehler(f));
      return Promise.resolve({
        id: eventId,
        name: 'Gottesdienst',
        startDate: '2026-10-18T08:00:00Z',
        endDate: '2026-10-18T09:30:00Z',
        eventServices: ct.plaetze.map((p) => ({ ...p })),
      } as RohTermin);
    },
    schreibe(pfad, auftrag) {
      ct.dazwischen?.();
      ct.dazwischen = null;
      ct.geschrieben.push({ pfad, method: auftrag.method, json: auftrag.json });
      const id = Number(/servicerequests\/(\d+)/.exec(pfad)![1]);
      const tun = () => {
        if (pfad.endsWith('/decline'))
          ersetze(id, { personId: null, name: null, isAccepted: false });
        else {
          const j = auftrag.json as {
            personId: number | null;
            name: string | null;
            isAccepted: boolean;
          };
          const name = j.name ?? (j.personId === null ? null : `Person ${j.personId}`);
          ersetze(id, { personId: j.personId, name, isAccepted: j.isAccepted });
        }
      };
      if (ct.schreibenFehler !== undefined) {
        if (ct.trotzdemSchreiben) tun();
        return Promise.reject(new Fehler(ct.schreibenFehler));
      }
      tun();
      return Promise.resolve();
    },
    status: (e) => (e instanceof Fehler ? e.status : null),
  };
  return { ct, port };
}

const TON: PlatzOrt = { eventId: 7, serviceId: 6, index: null };
const frei = (id: number, extra: object = {}): RohPlatz => ({
  id,
  serviceId: 6,
  index: null,
  personId: null,
  name: null,
  isAccepted: false,
  ...extra,
});
const anna = (id: number, zugesagt = false): RohPlatz =>
  frei(id, { personId: 46, name: 'Anna', isAccepted: zugesagt });

describe('belegungAus', () => {
  it('frei, Anfrage, Zusage, Gast – frei entscheidet allein der Name', () => {
    expect(belegungAus(frei(1))).toEqual({ art: 'frei' });
    expect(belegungAus(anna(1))).toEqual({ art: 'anfrage', personId: 46 });
    expect(belegungAus(anna(1, true))).toEqual({ art: 'zusage', personId: 46 });
    expect(belegungAus(frei(1, { name: ' Gast ', isAccepted: true }))).toEqual({
      art: 'gast',
      name: 'Gast',
    });
    expect(belegungAus(frei(1, { personId: 46, name: '' }))).toEqual({ art: 'frei' });
  });
});

describe('platzEinteilen – Erfolg erst, wenn das Ziel am Platz steht', () => {
  it('Anfrage: frisch gelesene ID, richtiger Rumpf, neue ID zurück', async () => {
    const { ct, port } = nachbau([frei(712)]);
    const r = await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 });
    expect(r).toEqual({ ok: true, platzId: 900 });
    expect(ct.geschrieben).toEqual([
      {
        pfad: '/events/7/servicerequests/712',
        method: 'PUT',
        json: { personId: 46, name: null, isAccepted: false },
      },
    ]);
  });

  it('direkt zuteilen und Gast eintragen', async () => {
    const z = nachbau([frei(1)]);
    expect(
      await platzEinteilen(z.port, TON, { art: 'frei' }, { art: 'zusage', personId: 46 }),
    ).toMatchObject({ ok: true });
    expect(z.ct.geschrieben[0].json).toEqual({ personId: 46, name: null, isAccepted: true });
    const g = nachbau([frei(1)]);
    expect(
      await platzEinteilen(g.port, TON, { art: 'frei' }, { art: 'gast', name: 'Weber' }),
    ).toMatchObject({ ok: true });
    expect(g.ct.geschrieben[0].json).toEqual({ personId: null, name: 'Weber', isAccepted: true });
  });

  it('Gastname mit Leerzeichen: getrimmt geschrieben und wiedererkannt', async () => {
    const { ct, port } = nachbau([frei(1)]);
    expect(
      await platzEinteilen(port, TON, { art: 'frei' }, { art: 'gast', name: ' Weber ' }),
    ).toMatchObject({
      ok: true,
    });
    expect(ct.geschrieben[0].json).toEqual({ personId: null, name: 'Weber', isAccepted: true });
  });

  it('Zurückziehen geht über decline (Leeren per PUT lehnt ChurchTools ab, E4-0)', async () => {
    const { ct, port } = nachbau([anna(724)]);
    const r = await platzEinteilen(port, TON, { art: 'anfrage', personId: 46 }, { art: 'frei' });
    expect(r).toEqual({ ok: true, platzId: 900 });
    expect(ct.geschrieben).toEqual([
      { pfad: '/events/7/servicerequests/724/decline', method: 'POST', json: { comment: null } },
    ]);
  });

  it('der Platz wird über Dienst und index gefunden, nicht über eine ID', async () => {
    const zwei: PlatzOrt = { eventId: 7, serviceId: 9, index: 2 };
    const { ct, port } = nachbau([
      frei(715, { serviceId: 9, index: 1 }),
      frei(718, { serviceId: 9, index: 2 }),
    ]);
    await platzEinteilen(port, zwei, { art: 'frei' }, { art: 'anfrage', personId: 46 });
    expect(ct.geschrieben[0].pfad).toBe('/events/7/servicerequests/718');
  });

  it('steht das Ziel schon da (früheres Senden kam doch an) → Erfolg ohne Schreiben', async () => {
    const { ct, port } = nachbau([anna(5)]);
    expect(
      await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 }),
    ).toEqual({
      ok: true,
      platzId: 5,
    });
    expect(ct.geschrieben).toEqual([]);
  });

  it('Anfrage, die schon zugesagt ist, gilt als erfüllt; „direkt zuteilen“ verlangt die Zusage', async () => {
    const a = nachbau([anna(5, true)]);
    expect(
      await platzEinteilen(a.port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 }),
    ).toMatchObject({ ok: true });
    expect(a.ct.geschrieben).toEqual([]);
    const z = nachbau([anna(5)]);
    expect(
      await platzEinteilen(
        z.port,
        TON,
        { art: 'anfrage', personId: 46 },
        { art: 'zusage', personId: 46 },
      ),
    ).toMatchObject({ ok: true });
    expect(z.ct.geschrieben).toHaveLength(1);
  });
});

describe('platzEinteilen – jeder Fehlerzweig einzeln', () => {
  it('Konflikt: inzwischen steht jemand anderes da → nichts überschrieben', async () => {
    const { ct, port } = nachbau([frei(5, { personId: 49, name: 'Ben' })]);
    const r = await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 });
    expect(r).toEqual({ ok: false, grund: 'konflikt', jetzt: { art: 'anfrage', personId: 49 } });
    expect(ct.geschrieben).toEqual([]);
  });

  it('gesehene Anfrage wurde inzwischen zugesagt: dieselbe Person, kein Konflikt', async () => {
    const { port } = nachbau([anna(5, true)]);
    const r = await platzEinteilen(port, TON, { art: 'anfrage', personId: 46 }, { art: 'frei' });
    expect(r).toMatchObject({ ok: true });
  });

  it('Gast mit anderem Namen ist ein Konflikt', async () => {
    const { ct, port } = nachbau([frei(5, { name: 'Weber', isAccepted: true })]);
    const r = await platzEinteilen(port, TON, { art: 'gast', name: 'Müller' }, { art: 'frei' });
    expect(r).toMatchObject({ ok: false, grund: 'konflikt' });
    expect(ct.geschrieben).toEqual([]);
  });

  it('Platz gibt es nicht mehr (Anzahl verkleinert) → weg', async () => {
    const { ct, port } = nachbau([frei(5, { serviceId: 9, index: 1 })]);
    expect(
      await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 }),
    ).toEqual({
      ok: false,
      grund: 'weg',
    });
    expect(ct.geschrieben).toEqual([]);
  });

  it('zwei Plätze mit demselben Ort → nicht eindeutig, lieber nicht schreiben', async () => {
    const { ct, port } = nachbau([frei(5), frei(6)]);
    expect(
      await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 }),
    ).toMatchObject({
      ok: false,
      grund: 'weg',
    });
    expect(ct.geschrieben).toEqual([]);
  });

  it.each([
    [401, 'abgemeldet'],
    [403, 'kein-recht'],
    [404, 'weg'],
    [429, 'voruebergehend'],
    [503, 'voruebergehend'],
    [null, 'voruebergehend'],
  ] as const)('Lesen scheitert mit %s → %s, nichts geschrieben', async (status, grund) => {
    const { ct, port } = nachbau([frei(5)]);
    ct.lesenFehler = [status];
    expect(
      await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 }),
    ).toEqual({
      ok: false,
      grund,
    });
    expect(ct.geschrieben).toEqual([]);
  });

  it.each([
    [401, 'abgemeldet'],
    [403, 'kein-recht'],
  ] as const)('Schreiben abgelehnt mit %s → %s, ohne Nachlesen', async (status, grund) => {
    const { ct, port } = nachbau([frei(5)]);
    ct.schreibenFehler = status;
    const r = await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 });
    expect(r).toEqual({ ok: false, grund });
    expect(ct.geschrieben).toHaveLength(1);
  });

  it('vorübergehender Fehler, aber es kam doch an → nachgelesen, Erfolg, NICHT nochmal geschrieben', async () => {
    const { ct, port } = nachbau([frei(5)]);
    ct.schreibenFehler = null; // Zeitüberschreitung: keine Antwort …
    ct.trotzdemSchreiben = true; // … aber ChurchTools hat geschrieben
    const r = await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 });
    expect(r).toEqual({ ok: true, platzId: 900 });
    expect(ct.geschrieben).toHaveLength(1);
  });

  it.each([429, 500, 504, null])(
    'vorübergehend (%s) und nicht angekommen → voruebergehend, nicht wiederholt',
    async (status) => {
      const { ct, port } = nachbau([frei(5)]);
      ct.schreibenFehler = status;
      const r = await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 });
      expect(r).toEqual({ ok: false, grund: 'voruebergehend', jetzt: { art: 'frei' } });
      expect(ct.geschrieben).toHaveLength(1);
    },
  );

  it.each([404, 409])('Schreiben mit %s und nicht angekommen → konflikt', async (status) => {
    const { ct, port } = nachbau([frei(5)]);
    ct.schreibenFehler = status;
    expect(
      await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 }),
    ).toMatchObject({
      ok: false,
      grund: 'konflikt',
    });
  });

  it('200, aber ein anderer Planer kam dazwischen (veraltete ID) → nicht-angekommen, mit Belegung', async () => {
    const { ct, port } = nachbau([frei(5)]);
    ct.dazwischen = () => {
      ct.plaetze[0] = { ...ct.plaetze[0], id: 77, personId: 49, name: 'Ben', isAccepted: false };
    };
    const r = await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 });
    expect(r).toEqual({
      ok: false,
      grund: 'nicht-angekommen',
      jetzt: { art: 'anfrage', personId: 49 },
    });
  });

  it('geschrieben, aber Nachlesen scheitert → nicht bestätigt (Grund des Lesens), kein Erfolg', async () => {
    const { ct, port } = nachbau([frei(5)]);
    const termin = port.termin.bind(port);
    let n = 0;
    port.termin = (id) => (n++ === 0 ? termin(id) : Promise.reject(new Fehler(503)));
    expect(
      await platzEinteilen(port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 }),
    ).toEqual({
      ok: false,
      grund: 'voruebergehend',
    });
    n = 0;
    const g = nachbau([frei(5)]);
    const t2 = g.port.termin.bind(g.port);
    g.port.termin = (id) => (n++ === 0 ? t2(id) : Promise.reject(new Fehler(401)));
    expect(
      await platzEinteilen(g.port, TON, { art: 'frei' }, { art: 'anfrage', personId: 46 }),
    ).toEqual({
      ok: false,
      grund: 'abgemeldet',
    });
    expect(ct.geschrieben).toHaveLength(1);
  });
});
