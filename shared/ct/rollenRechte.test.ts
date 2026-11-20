import { describe, expect, it } from 'vitest';
import {
  abweichungen,
  darfVerwalten,
  datenRechteNummernAus,
  istDatenRechtAn,
  rechteAusrichten,
  rechteAus,
  rechteDerRollen,
  rechteVergleichen,
  rechtRumpf,
  rechtSchluessel,
  rollenIdsAus,
  type DatenRechteNummern,
  type Recht,
} from './rollenRechte';

/** Aufbau wie die echte Antwort von `GET /permissions/definitions` (Test-Instanz, Modul `website`). */
const DEFINITIONEN = {
  modules: [
    {
      key: 'website',
      permissions: [
        { authId: 2080, key: 'view' },
        { authId: 2081, key: 'view custom category' },
        { authId: 2082, key: 'create custom category' },
        { authId: 2085, key: 'view custom data' },
        { authId: 2086, key: 'create custom data' },
        { authId: 2087, key: 'edit custom data' },
        { authId: 2088, key: 'delete custom data' },
      ],
    },
  ],
};
const N = datenRechteNummernAus(DEFINITIONEN, 'website') as DatenRechteNummern;
const r = (rolle: number, authId: number, dataId: number | null = null): Recht => ({
  rolle,
  authId,
  dataId,
});
const UNSERE = new Set([104, 107]);
const verwaltet = (x: Recht) => istDatenRechtAn(x, N, UNSERE);

describe('datenRechteNummernAus', () => {
  it('liest die Nummern des Moduls nach Schlüssel (nie feste Zahlen)', () => {
    expect(N).toEqual({
      modulSehen: 2080,
      kategorieSehen: 2081,
      datenSehen: 2085,
      datenAnlegen: 2086,
      datenAendern: 2087,
      datenLoeschen: 2088,
    });
  });
  it('fehlt ein Recht oder das Modul: null – dann wird nichts gesetzt', () => {
    expect(datenRechteNummernAus(DEFINITIONEN, 'protokolle')).toBeNull();
    const ohne = {
      modules: [{ key: 'website', permissions: DEFINITIONEN.modules[0].permissions.slice(0, 5) }],
    };
    expect(datenRechteNummernAus(ohne, 'website')).toBeNull();
    expect(datenRechteNummernAus(null, 'website')).toBeNull();
  });
});

describe('istDatenRechtAn', () => {
  it('nur Daten-Rechte an unseren Kategorien; fremde Kategorie, „Modul sehen“ und Rechte ohne Daten nicht', () => {
    expect(istDatenRechtAn(r(1, N.datenAnlegen, 104), N, UNSERE)).toBe(true);
    expect(istDatenRechtAn(r(1, N.kategorieSehen, 107), N, UNSERE)).toBe(true);
    expect(istDatenRechtAn(r(1, N.datenAnlegen, 999), N, UNSERE)).toBe(false);
    expect(istDatenRechtAn(r(1, N.modulSehen), N, UNSERE)).toBe(false);
    expect(istDatenRechtAn(r(1, 10119), N, UNSERE)).toBe(false);
  });
});

describe('rechteAus / rechtRumpf / darfVerwalten / rollenIdsAus', () => {
  it('Zeilen zu Rechten: Daten je Zeile, ohne Daten = null, Entzüge und Unlesbares fallen weg', () => {
    expect(
      rechteAus(5, [
        { authId: 1, dataId: 2 },
        { authId: 3 },
        { authId: 4, type: 'deny' },
        { authId: 'x' },
      ]),
    ).toEqual([r(5, 1, 2), r(5, 3, null)]);
    expect(rechteAus(5, null)).toEqual([]);
  });
  it('Rumpf: mit Daten als Liste, ohne Daten nur die Nummer', () => {
    expect(rechtRumpf(r(1, 2, 3))).toEqual({ authId: 2, dataId: [3] });
    expect(rechtRumpf(r(1, 2))).toEqual({ authId: 2 });
  });
  it('„administer persons“ erlaubt das Setzen – sonst nicht', () => {
    expect(darfVerwalten({ churchcore: { 'administer persons': true } })).toBe(true);
    expect(darfVerwalten({ churchcore: { 'administer persons': 'true' } })).toBe(false);
    expect(darfVerwalten({ churchdb: { 'administer groups': true } })).toBe(false);
    expect(darfVerwalten(null)).toBe(false);
  });
  it('Rollen-IDs: Zahlen und Zahlen-Texte, sonst weg (0 ist eine ID)', () => {
    expect(rollenIdsAus([{ id: 3 }, { id: '4' }, { id: null }, { id: 0 }, {}])).toEqual([3, 4, 0]);
    expect(rollenIdsAus(null)).toEqual([]);
  });
});

describe('rechteVergleichen', () => {
  it('setzt, was fehlt; entzieht nur Verwaltetes; schiebt ein vorhandenes Recht nach', () => {
    const soll = [r(1, N.modulSehen), r(1, N.datenSehen, 104)];
    const ist = [
      r(1, N.modulSehen),
      r(1, N.datenAnlegen, 107), // unsere Kategorie, nicht im Soll → weg
      r(1, N.datenAnlegen, 999), // fremde Kategorie → bleibt
      r(1, 10119), // Zusatzrecht von Hand → bleibt
    ];
    const p = rechteVergleichen(soll, ist, verwaltet, N.modulSehen);
    expect(p.setzen).toEqual([r(1, N.datenSehen, 104)]);
    expect(p.entziehen).toEqual([r(1, N.datenAnlegen, 107)]);
    expect(p.nachschieben).toEqual(soll[0]);
  });
  it('nichts zu entziehen: nichts nachschieben', () => {
    expect(rechteVergleichen([r(1, 5)], [r(1, 5)], verwaltet, N.modulSehen)).toEqual({
      setzen: [],
      entziehen: [],
      nachschieben: null,
    });
  });
  it('bleibt nach dem Entziehen nichts übrig: „Modul sehen“ an die erste betroffene Rolle', () => {
    const p = rechteVergleichen([], [r(7, N.datenSehen, 104)], verwaltet, N.modulSehen);
    expect(p.nachschieben).toEqual(r(7, N.modulSehen));
  });
  it('der Schlüssel unterscheidet Rolle, Recht und Daten (null ≠ 0)', () => {
    expect(rechtSchluessel(r(1, 2, 0))).not.toBe(rechtSchluessel(r(1, 2, null)));
    expect(rechtSchluessel(r(1, 2, 3))).not.toBe(rechtSchluessel(r(2, 2, 3)));
  });
});

describe('abweichungen', () => {
  it('fehlt = Soll nicht da, nochDa = Entzogenes noch da; leer = übernommen', () => {
    const soll = [r(1, 1, 1), r(1, 2, 2)];
    const weg = [r(1, 3, 3)];
    expect(abweichungen(soll, weg, [r(1, 1, 1), r(1, 2, 2)])).toEqual({ fehlt: [], nochDa: [] });
    expect(abweichungen(soll, weg, [r(1, 1, 1), r(1, 3, 3)])).toEqual({
      fehlt: [r(1, 2, 2)],
      nochDa: [r(1, 3, 3)],
    });
  });
});

/** Ein nachgestelltes ChurchTools: Rechte je Rolle, jeder Aufruf wird mitgeschrieben. */
function nachbau(
  start: Recht[],
  opts: { ignoriere?: 'PUT' | 'DELETE'; scheitereBei?: number } = {},
) {
  const rechte = [...start];
  const aufrufe: string[] = [];
  let n = 0;
  const port = {
    daten: <T>(pfad: string): Promise<T> => {
      aufrufe.push(`GET ${pfad}`);
      const rolle = Number(/group_role\/(\d+)/.exec(pfad)?.[1]);
      return Promise.resolve(
        rechte
          .filter((x) => x.rolle === rolle)
          .map((x) => ({
            authId: x.authId,
            dataId: x.dataId,
            type: 'grant',
          })) as T,
      );
    },
    schreibe: (
      pfad: string,
      a: { method: 'POST' | 'PUT' | 'DELETE'; json?: unknown; verweigert: string },
    ): Promise<void> => {
      n += 1;
      if (opts.scheitereBei === n) return Promise.reject(new Error('503'));
      const rolle = Number(/group_role\/(\d+)/.exec(pfad)?.[1]);
      const j = a.json as { authId: number; dataId?: number[] };
      aufrufe.push(`${a.method} ${rolle} ${j.authId}:${j.dataId?.[0] ?? '-'}`);
      if (a.method === opts.ignoriere) return Promise.resolve();
      const dataId = j.dataId?.[0] ?? null;
      const i = rechte.findIndex(
        (x) => x.rolle === rolle && x.authId === j.authId && x.dataId === dataId,
      );
      if (a.method === 'PUT' && i < 0) rechte.push({ rolle, authId: j.authId, dataId });
      if (a.method === 'DELETE' && i >= 0) rechte.splice(i, 1);
      return Promise.resolve();
    },
  };
  return { port, rechte, aufrufe };
}

const ARGS = (soll: Recht[]) => ({
  rollen: [1],
  soll,
  verwaltet,
  modulSehen: N.modulSehen,
  verweigert: 'nur Admin',
});

describe('rechteAusrichten (Ablauf)', () => {
  it('Reihenfolge: Ist lesen → setzen → entziehen → nachschieben → nachlesen; danach übernommen', async () => {
    const ct = nachbau([r(1, N.modulSehen), r(1, N.datenAnlegen, 107), r(1, N.datenAnlegen, 999)]);
    const soll = [r(1, N.modulSehen), r(1, N.datenSehen, 104)];
    const a = await rechteAusrichten(ct.port, ARGS(soll));
    expect(ct.aufrufe).toEqual([
      'GET /permissions/group_role/1',
      `PUT 1 ${N.datenSehen}:104`,
      `DELETE 1 ${N.datenAnlegen}:107`,
      `PUT 1 ${N.modulSehen}:-`,
      'GET /permissions/group_role/1',
    ]);
    expect(a.fehlt).toEqual([]);
    expect(a.nochDa).toEqual([]);
    // Fremdes bleibt, Entzogenes ist weg.
    expect(ct.rechte).toContainEqual(r(1, N.datenAnlegen, 999));
    expect(ct.rechte).not.toContainEqual(r(1, N.datenAnlegen, 107));
  });

  it('ein 204 ist kein Beleg: übernimmt ChurchTools das PUT nicht, steht es in „fehlt“', async () => {
    const ct = nachbau([], { ignoriere: 'PUT' });
    const a = await rechteAusrichten(ct.port, ARGS([r(1, N.datenSehen, 104)]));
    expect(a.fehlt).toEqual([r(1, N.datenSehen, 104)]);
  });

  it('übernimmt ChurchTools das DELETE nicht, steht es in „nochDa“', async () => {
    const ct = nachbau([r(1, N.datenAnlegen, 107)], { ignoriere: 'DELETE' });
    const a = await rechteAusrichten(ct.port, ARGS([r(1, N.modulSehen)]));
    expect(a.nochDa).toEqual([r(1, N.datenAnlegen, 107)]);
  });

  it('vorübergehender Fehler beim Setzen: wird geworfen, es wird nichts entzogen', async () => {
    const ct = nachbau([r(1, N.datenAnlegen, 107)], { scheitereBei: 1 });
    await expect(rechteAusrichten(ct.port, ARGS([r(1, N.datenSehen, 104)]))).rejects.toThrow('503');
    expect(ct.aufrufe.some((x) => x.startsWith('DELETE'))).toBe(false);
    expect(ct.rechte).toContainEqual(r(1, N.datenAnlegen, 107));
  });

  it('Ist nicht lesbar: wird geworfen, nichts geschrieben (kein „keine Rechte“)', async () => {
    const ct = nachbau([]);
    const kaputt = {
      ...ct.port,
      daten: () => Promise.reject(new Error('504')),
    };
    await expect(rechteAusrichten(kaputt, ARGS([r(1, N.modulSehen)]))).rejects.toThrow('504');
    expect(ct.aufrufe).toEqual([]);
  });

  it('Rollen ohne Soll werden mitgelesen und ihr Entzug gehört dazu', async () => {
    const ct = nachbau([r(2, N.datenAnlegen, 104), r(1, N.modulSehen)]);
    const a = await rechteAusrichten(ct.port, {
      ...ARGS([r(1, N.modulSehen)]),
      rollen: [1, 2],
    });
    expect(a.plan.entziehen).toEqual([r(2, N.datenAnlegen, 104)]);
    expect(ct.rechte).toEqual([r(1, N.modulSehen)]);
  });
});

describe('rechteDerRollen', () => {
  it('liest je Rolle und fasst zusammen', async () => {
    const ct = nachbau([r(1, 5, 1), r(2, 6)]);
    expect(await rechteDerRollen(ct.port, [1, 2])).toEqual([r(1, 5, 1), r(2, 6)]);
  });
});
