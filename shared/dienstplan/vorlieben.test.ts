import { describe, expect, it } from 'vitest';
import {
  STANDARD,
  vorliebenAus,
  vorliebeLesen,
  vorliebeSpeichern,
  type Vorliebe,
  type VorliebenPort,
} from './vorlieben';

class Fehler extends Error {
  constructor(readonly status: number | null) {
    super(`Fehler ${status}`);
  }
}

/** Eine Zeile, wie die alte Schnittstelle sie liefert (gemessen E5-3-0: alles Zeichenketten). */
const zeile = (pid: number, gid: number, v: [string, string, string]) => ({
  [String(pid)]: {
    [String(gid)]: {
      person_id: String(pid),
      servicegroup_id: String(gid),
      max_per_month: v[0],
      relation_weight: v[1],
      morning_weight: v[2],
      modified_date: '2026-10-16 18:32:14',
      modified_pid: '19',
    },
  },
});

/**
 * Nachbau der alten Schnittstelle: hält Zeilen je Gruppe; `still` = schreiben meldet Erfolg, übernimmt aber nichts
 * und lässt die Gruppe nicht lesen (gemessen ohne Recht).
 */
function nachbau(o: { still?: boolean; wirft?: Fehler; nachlesenWirft?: Fehler } = {}) {
  const zeilen = new Map<number, Record<string, unknown>>();
  const aufrufe: [string, Record<string, string>][] = [];
  let geschrieben = false;
  const port: VorliebenPort = {
    anfrage(func, felder) {
      aufrufe.push([func, felder]);
      const gid = Number(felder.servicegroup_id);
      if (func === 'editServiceGroupPersonWeight') {
        if (o.wirft) return Promise.reject(o.wirft);
        geschrieben = true;
        if (!o.still)
          zeilen.set(gid, {
            ...(zeilen.get(gid) ?? {}),
            ...zeile(Number(felder.person_id), gid, [
              felder.max_per_month,
              felder.relation_weight,
              felder.morning_weight,
            ]),
          });
        return Promise.resolve(null);
      }
      if (geschrieben && o.nachlesenWirft) return Promise.reject(o.nachlesenWirft);
      if (o.still) return Promise.resolve(null);
      return Promise.resolve(zeilen.get(gid) ?? []);
    },
    status: (e) => (e instanceof Fehler ? e.status : null),
  };
  return { port, aufrufe, zeilen };
}

const V: Vorliebe = { hoechstens: 1, beziehung: 0, tageszeit: 3 };

describe('vorliebenAus', () => {
  it('Zeichenketten der alten Schnittstelle → Zahlen; `null` = nicht lesbar, `[]` = keine Zeilen', () => {
    const l = vorliebenAus(zeile(49, 3, ['1', '0', '3']), 3);
    expect(l.lesbar && l.je.get(49)).toEqual(V);
    expect(vorliebenAus(null, 3)).toEqual({ lesbar: false });
    const leer = vorliebenAus([], 3);
    expect(leer.lesbar && leer.je.size).toBe(0);
  });

  it('nur die gefragte Gruppe; unbrauchbare Werte fallen weg', () => {
    expect(vorliebenAus(zeile(49, 1, ['1', '0', '3']), 3)).toEqual({ lesbar: true, je: new Map() });
    for (const kaputt of [
      ['5', '0', '0'],
      ['1', '3', '0'],
      ['1', '0', '5'],
      ['', '0', '0'],
      ['x', '0', '0'],
    ])
      expect(vorliebenAus(zeile(49, 3, kaputt as [string, string, string]), 3)).toEqual({
        lesbar: true,
        je: new Map(),
      });
  });
});

describe('vorliebeLesen', () => {
  it('ohne Zeile: der Standard (4×, egal, egal)', async () => {
    expect(await vorliebeLesen(nachbau().port, 3, 49)).toEqual({ ok: true, vorliebe: STANDARD });
    expect(STANDARD).toEqual({ hoechstens: 4, beziehung: 0, tageszeit: 0 });
  });

  it('nicht lesbar (`null`) → kein Recht; 403 → kein Recht; 401 → abgemeldet; Netz/5xx → vorübergehend', async () => {
    expect(await vorliebeLesen(nachbau({ still: true }).port, 3, 49)).toEqual({
      ok: false,
      grund: 'kein-recht',
    });
    const wirft = (f: Fehler): VorliebenPort => ({
      anfrage: () => Promise.reject(f),
      status: (e) => (e as Fehler).status,
    });
    expect(await vorliebeLesen(wirft(new Fehler(403)), 3, 49)).toMatchObject({
      grund: 'kein-recht',
    });
    expect(await vorliebeLesen(wirft(new Fehler(401)), 3, 49)).toMatchObject({
      grund: 'abgemeldet',
    });
    expect(await vorliebeLesen(wirft(new Fehler(502)), 3, 49)).toMatchObject({
      grund: 'voruebergehend',
    });
    expect(await vorliebeLesen(wirft(new Fehler(null)), 3, 49)).toMatchObject({
      grund: 'voruebergehend',
    });
  });
});

describe('vorliebeSpeichern', () => {
  it('schreibt die Felder wie ChurchTools (gemessen) und liest nach – erst dann Erfolg', async () => {
    const n = nachbau();
    expect(await vorliebeSpeichern(n.port, 3, 49, V)).toEqual({ ok: true });
    expect(n.aufrufe).toEqual([
      [
        'editServiceGroupPersonWeight',
        {
          servicegroup_id: '3',
          person_id: '49',
          max_per_month: '1',
          relation_weight: '0',
          morning_weight: '3',
        },
      ],
      ['getServiceGroupPersonWeight', { servicegroup_id: '3' }],
    ]);
  });

  it('stille Ablehnung (gemessen ohne Recht: „success“, nichts geschrieben) → kein Recht, nicht „gespeichert“', async () => {
    expect(await vorliebeSpeichern(nachbau({ still: true }).port, 1, 49, V)).toEqual({
      ok: false,
      grund: 'kein-recht',
    });
  });

  it('nachgelesen steht etwas anderes da → nicht angekommen', async () => {
    const n = nachbau();
    const p: VorliebenPort = {
      ...n.port,
      anfrage: (func) =>
        func === 'editServiceGroupPersonWeight'
          ? Promise.resolve(null) // meldet Erfolg, ändert aber nichts
          : Promise.resolve(zeile(49, 3, ['4', '0', '0'])),
    };
    expect(await vorliebeSpeichern(p, 3, 49, V)).toEqual({ ok: false, grund: 'nicht-angekommen' });
  });

  it('Schreiben scheitert: 403 → kein Recht, 502 → vorübergehend; nie ein zweiter Versuch', async () => {
    for (const [f, grund] of [
      [new Fehler(403), 'kein-recht'],
      [new Fehler(502), 'voruebergehend'],
    ] as const) {
      const n = nachbau({ wirft: f });
      expect(await vorliebeSpeichern(n.port, 3, 49, V)).toEqual({ ok: false, grund });
      expect(n.aufrufe.map((a) => a[0])).toEqual(['editServiceGroupPersonWeight']);
    }
  });

  it('Nachlesen scheitert (Netz) → vorübergehend, nicht „gespeichert“', async () => {
    const n = nachbau({ nachlesenWirft: new Fehler(null) });
    expect(await vorliebeSpeichern(n.port, 3, 49, V)).toEqual({
      ok: false,
      grund: 'voruebergehend',
    });
  });
});
