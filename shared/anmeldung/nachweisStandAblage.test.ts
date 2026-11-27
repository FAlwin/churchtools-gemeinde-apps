import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_ZEICHEN } from '../ct/modulDaten';
import { ANMELDUNGEN_RECHTE, FalschesCt } from '../ct/gruppenart.testutil';
import { NACHWEIS_STAND_KATEGORIE } from './nachweise';
import {
  StandZuLang,
  nachweisStandLesen,
  nachweisStandSchreiben,
  standAblageSichern,
  standAusWert,
  standWert,
} from './nachweisStandAblage';

/**
 * Die Ablage „Nachweis-Stand“ (N3a) gegen ein nachgestelltes ChurchTools (`FalschesCt`: Rechte an allen vier Zielen,
 * `assignment-summary` aus den gespeicherten Rechten, Datenspeicher). Die Nummern der Rechte kommen aus den Definitionen der
 * Attrappe (`ANMELDUNGEN_RECHTE`, wie die Test-Instanz), nicht abgeschrieben.
 */
const recht = (key: string) => ANMELDUNGEN_RECHTE.find((r) => r.key === key)!.authId;
const SEHEN = recht('view');
const KAT_SEHEN = recht('view custom category');
const DATEN_SEHEN = recht('view custom data');
const DATEN_ANLEGEN = recht('create custom data');
const DATEN_AENDERN = recht('edit custom data');
const MODUL = 13;
const LEITER = 56;
const V = 'kein Recht';

let ct: FalschesCt;
beforeEach(() => {
  ct = new FalschesCt();
  ct.rollen = [
    { id: 53, groupTypeId: 11, isLeader: false },
    { id: LEITER, groupTypeId: 11, isLeader: true },
  ];
});

const kategorie = () => ct.kategorien.find((k) => k.shorty === NACHWEIS_STAND_KATEGORIE.kuerzel);
const an = (z: string) =>
  (z === `group_type_role:${LEITER}` ? ct.rechte.get(LEITER) : ct.rechteAn.get(z)) ?? [];
const nur = (l: { authId: number; dataId: number | null }[], k: number) =>
  l
    .filter((r) => r.dataId === k)
    .map((r) => r.authId)
    .sort();

describe('standWert / standAusWert', () => {
  it('hin und zurück; Personen nach Nummer sortiert – gleicher Stand, gleicher Text', () => {
    const a = new Map([
      [30, 'offen'],
      [4, '2028-11-20'],
      [12, 'rot'],
    ]);
    const b = new Map([...a.entries()].reverse());
    expect(standWert(341, a)).toBe(standWert(341, b));
    const t = standWert(341, a);
    expect(t).not.toMatch(/ergebnis|eintrag|ausgestellt/i);
    expect(standAusWert({ id: 1, dataCategoryId: 9, value: t })).toEqual({
      gruppe: 341,
      personen: a,
    });
  });

  it('fremd oder kaputt: null (zählt nicht als unser Wert)', () => {
    const w = (value: string) => ({ id: 1, dataCategoryId: 9, value });
    expect(standAusWert(w('kein json'))).toBeNull();
    expect(
      standAusWert(w(JSON.stringify({ art: 'anmeldungen-einstellungen', fassung: 1 }))),
    ).toBeNull();
    const ok = JSON.parse(standWert(7, new Map([[1, 'offen']]))) as Record<string, unknown>;
    expect(standAusWert(w(JSON.stringify({ ...ok, personen: { 1: 'gruen' } })))).toBeNull();
    expect(standAusWert(w(JSON.stringify({ ...ok, personen: { x: 'offen' } })))).toBeNull();
    expect(standAusWert(w(JSON.stringify({ ...ok, gruppe: '7' })))).toBeNull();
  });

  it('Platz: 450 Personen mit sechsstelliger Nummer und Datum passen in einen Wert (E26)', () => {
    const personen = new Map<number, string>();
    for (let i = 0; i < 450; i++) personen.set(100000 + i, '2028-11-20');
    expect(standWert(5, personen).length).toBeLessThanOrEqual(MAX_ZEICHEN);
  });

  it('Grenze: bis an MAX_ZEICHEN geht es, eine Person mehr wirft StandZuLang – nie gekürzt', () => {
    const personen = new Map<number, string>();
    let id = 100000;
    let fehler: unknown = null;
    while (fehler === null) {
      try {
        standWert(5, new Map([...personen, [id, 'rot']]));
        personen.set(id++, 'rot');
      } catch (e) {
        fehler = e;
      }
    }
    expect(fehler).toBeInstanceOf(StandZuLang);
    const laenge = standWert(5, personen).length;
    expect(laenge).toBeLessThanOrEqual(MAX_ZEICHEN);
    expect(laenge).toBeGreaterThan(MAX_ZEICHEN - 16);
  });
});

describe('nachweisStandSchreiben', () => {
  const KAT = 100;
  beforeEach(() => {
    ct.kategorien = [{ id: KAT, ...{ shorty: 'nachweis-stand', name: 'Nachweis-Stand' } }];
  });
  const schreiben = (arten: { gruppe: number; eintraege: Map<number, string> }[]) =>
    nachweisStandSchreiben(ct.modulPort, MODUL, KAT, arten, V);
  const wertVon = (gruppe: number) =>
    ct.werte.map((w) => standAusWert(w)).find((x) => x?.gruppe === gruppe)?.personen;

  it('neu: ein Wert je Art, nachgelesen', async () => {
    expect(await schreiben([{ gruppe: 341, eintraege: new Map([[371, '2028-11-20']]) }])).toEqual([
      341,
    ]);
    expect(ct.werte).toHaveLength(1);
    expect(wertVon(341)).toEqual(new Map([[371, '2028-11-20']]));
  });

  it('unverändert: kein Schreibaufruf', async () => {
    await schreiben([{ gruppe: 341, eintraege: new Map([[371, 'offen']]) }]);
    ct.aufrufe = [];
    expect(await schreiben([{ gruppe: 341, eintraege: new Map([[371, 'offen']]) }])).toEqual([]);
    expect(ct.aufrufe).toEqual([]);
  });

  it('Änderung: derselbe Wert wird geändert (PUT), Ausgetretene fallen weg, andere Arten bleiben', async () => {
    await schreiben([
      {
        gruppe: 341,
        eintraege: new Map([
          [371, 'offen'],
          [368, 'rot'],
        ]),
      },
      { gruppe: 400, eintraege: new Map([[9, 'offen']]) },
    ]);
    const id = ct.werte[0].id;
    ct.aufrufe = [];
    await schreiben([{ gruppe: 341, eintraege: new Map([[371, '2029-01-01']]) }]);
    expect(ct.aufrufe.map((a) => `${a.methode} ${a.pfad.split('/').pop()}`)).toEqual([`PUT ${id}`]);
    expect(wertVon(341)).toEqual(new Map([[371, '2029-01-01']]));
    expect(wertVon(400)).toEqual(new Map([[9, 'offen']]));
  });

  it('zwei Werte für dieselbe Art (gleichzeitig angelegt): geschrieben wird der älteste', async () => {
    const alt = standWert(341, new Map([[1, 'offen']]));
    ct.werte = [
      { id: 900, dataCategoryId: KAT, value: alt },
      { id: 800, dataCategoryId: KAT, value: alt },
    ];
    await schreiben([{ gruppe: 341, eintraege: new Map([[1, 'rot']]) }]);
    expect(ct.schreibende('PUT').map((a) => a.pfad.split('/').pop())).toEqual(['800']);
    expect(ct.schreibende('POST')).toEqual([]);
  });

  it('Werte nicht lesbar (503): wirft, bevor etwas geschrieben wird – kein zweiter Wert, nichts gelöscht', async () => {
    ct.werteLesenScheitert = 503;
    await expect(schreiben([{ gruppe: 341, eintraege: new Map() }])).rejects.toMatchObject({
      status: 503,
    });
    expect(ct.aufrufe).toEqual([]);
  });

  it('„Erfolg“, der nichts übernimmt: nachgelesen → Fehler 502', async () => {
    ct.ignoriere = ['/customdatavalues'];
    await expect(
      schreiben([{ gruppe: 341, eintraege: new Map([[1, 'rot']]) }]),
    ).rejects.toMatchObject({
      status: 502,
    });
  });

  it('zu viele Personen: StandZuLang, bevor gelesen oder geschrieben wird', async () => {
    const viele = new Map<number, string>();
    for (let i = 0; i < 1000; i++) viele.set(100000 + i, '2028-11-20');
    await expect(schreiben([{ gruppe: 341, eintraege: viele }])).rejects.toBeInstanceOf(
      StandZuLang,
    );
    expect(ct.aufrufe).toEqual([]);
  });
});

describe('nachweisStandLesen – drei Ausgänge', () => {
  it('gelesen: die Personen der Art (nur dieser)', async () => {
    ct.kategorien = [{ id: 100, shorty: 'nachweis-stand', name: 'Nachweis-Stand' }];
    ct.werte = [
      { id: 1, dataCategoryId: 100, value: standWert(341, new Map([[371, '2028-11-20']])) },
      { id: 2, dataCategoryId: 100, value: standWert(400, new Map([[9, 'rot']])) },
    ];
    expect(await nachweisStandLesen(ct.modulPort, MODUL, 341)).toEqual({
      art: 'gelesen',
      personen: new Map([[371, '2028-11-20']]),
    });
  });

  it('gelesen und leer: noch kein Wert für die Art', async () => {
    ct.kategorien = [{ id: 100, shorty: 'nachweis-stand', name: 'Nachweis-Stand' }];
    expect(await nachweisStandLesen(ct.modulPort, MODUL, 341)).toEqual({
      art: 'gelesen',
      personen: new Map(),
    });
  });

  it('nicht lesbar: Kategorie nicht zu sehen (fehlt oder ohne „Kategorie sehen“) – nicht „leer“', async () => {
    expect(await nachweisStandLesen(ct.modulPort, MODUL, 341)).toEqual({ art: 'nichtLesbar' });
  });

  it('nicht lesbar: kein Recht an den Werten (403)', async () => {
    ct.kategorien = [{ id: 100, shorty: 'nachweis-stand', name: 'Nachweis-Stand' }];
    ct.werteLesenScheitert = 403;
    expect(await nachweisStandLesen(ct.modulPort, MODUL, 341)).toEqual({ art: 'nichtLesbar' });
  });

  it('vorübergehend (503): wirft', async () => {
    ct.kategorien = [{ id: 100, shorty: 'nachweis-stand', name: 'Nachweis-Stand' }];
    ct.werteLesenScheitert = 503;
    await expect(nachweisStandLesen(ct.modulPort, MODUL, 341)).rejects.toMatchObject({
      status: 503,
    });
  });
});

describe('standAblageSichern (Admin, E22)', () => {
  const sichern = () => standAblageSichern(ct.port, ct.modulPort, LEITER, V);

  it('legt die Kategorie an und gibt der Leiter-Rolle sehen + anlegen + ändern (nicht löschen)', async () => {
    const r = await sichern();
    const k = kategorie()!;
    expect(r.kategorie).toBe(k.id);
    expect(k.name).toBe(NACHWEIS_STAND_KATEGORIE.name);
    expect(nur(an(`group_type_role:${LEITER}`), k.id)).toEqual(
      [KAT_SEHEN, DATEN_SEHEN, DATEN_ANLEGEN, DATEN_AENDERN].sort(),
    );
  });

  it('jeder Träger von „Anmeldungen sehen“ bekommt Kategorie + Daten sehen – je Art des Ziels', async () => {
    for (const z of ['status:2', 'group_role:91', 'person:1'])
      ct.rechteAn.set(z, [{ authId: SEHEN, dataId: null }]);
    ct.rechte.set(70, [{ authId: SEHEN, dataId: null }]);
    await sichern();
    const k = kategorie()!.id;
    for (const z of ['status:2', 'group_role:91', 'person:1'])
      expect(nur(an(z), k), z).toEqual([KAT_SEHEN, DATEN_SEHEN].sort());
    expect(nur(ct.rechte.get(70) ?? [], k)).toEqual([KAT_SEHEN, DATEN_SEHEN].sort());
  });

  it('die Leiter-Rolle steht selbst unter den Trägern: einmal das volle Soll, nichts doppelt', async () => {
    ct.rechte.set(LEITER, [{ authId: SEHEN, dataId: null }]);
    await sichern();
    const k = kategorie()!.id;
    expect(nur(an(`group_type_role:${LEITER}`), k)).toEqual(
      [KAT_SEHEN, DATEN_SEHEN, DATEN_ANLEGEN, DATEN_AENDERN].sort(),
    );
  });

  it('nur ergänzen: fremde Rechte bleiben, nie DELETE; zweiter Lauf schreibt nichts', async () => {
    ct.rechteAn.set('person:1', [
      { authId: SEHEN, dataId: null },
      { authId: 4711, dataId: 3 },
    ]);
    await sichern();
    expect(an('person:1')).toContainEqual({ authId: 4711, dataId: 3 });
    expect(ct.aufrufe.every((a) => a.methode !== 'DELETE')).toBe(true);
    ct.aufrufe = [];
    await sichern();
    expect(ct.aufrufe).toEqual([]);
  });

  it('neuer Träger später (Admin öffnet wieder): bekommt das Leserecht nachgezogen', async () => {
    await sichern();
    ct.rechteAn.set('person:5', [{ authId: SEHEN, dataId: null }]);
    ct.aufrufe = [];
    await sichern();
    expect(ct.schreibende('PUT').map((a) => a.pfad)).toEqual([
      '/permissions/person/5',
      '/permissions/person/5',
    ]);
  });

  it('ChurchTools kennt die Speicher-Rechte nicht: „anders“, nichts an Rechten geschrieben', async () => {
    ct.definitionen = {
      modules: [{ key: 'anmeldungen', permissions: [{ authId: 2020, key: 'view' }] }],
    };
    await expect(sichern()).rejects.toMatchObject({ art: 'anders' });
    expect(ct.aufrufe.filter((a) => a.pfad.startsWith('/permissions'))).toEqual([]);
  });

  it('Träger nicht lesbar: „unlesbar“, kein Recht geschrieben', async () => {
    ct.summaryKaputt = true;
    await expect(sichern()).rejects.toMatchObject({ art: 'unlesbar' });
    expect(ct.aufrufe.filter((a) => a.pfad.startsWith('/permissions'))).toEqual([]);
  });

  it('ein Recht wird geschluckt: nichtUebernommen (nachgelesen)', async () => {
    ct.ignoriere = ['PUT /permissions'];
    await expect(sichern()).rejects.toMatchObject({ art: 'nichtUebernommen' });
  });

  it('Kategorie gibt es schon: keine zweite', async () => {
    await sichern();
    await sichern();
    expect(ct.kategorien.filter((k) => k.shorty === NACHWEIS_STAND_KATEGORIE.kuerzel)).toHaveLength(
      1,
    );
  });
});
