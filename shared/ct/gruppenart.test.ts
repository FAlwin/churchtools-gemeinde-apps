import { describe, expect, it } from 'vitest';
import { NACHWEIS_ART, NACHWEIS_LEITER_RECHTE, istNachweisArt } from '../anmeldung/nachweise';
import { LEITER_RECHTE } from '../organigramm/gruppenwechsel';
import {
  fehlendeRechte,
  GruppenartFehler,
  gruppenartAnlegen,
  gruppenartRollen,
  gruppenartSuchen,
  modulRechtAus,
  modulRechtHolen,
  rechteErgaenzen,
  rechteErgaenzenAn,
  rechtTraegerAus,
  rechtTraegerLesen,
} from './gruppenart';
import { FalschesCt } from './gruppenart.testutil';

const POST_TYP = (ct: FalschesCt) => ct.aufrufe.filter((a) => a.pfad === '/group/grouptypes');

describe('gruppenartSuchen', () => {
  it('nimmt bei mehreren gleichen die kleinste Nummer und nennt den größten sortKey', async () => {
    const ct = new FalschesCt();
    ct.typen = [
      { id: 30, name: 'Nachweis', sortKey: 5 },
      { id: 12, name: ' nachweis ', sortKey: 100 },
      { id: 2, name: 'Dienst', sortKey: 7 },
    ];
    expect(await gruppenartSuchen(ct.port, istNachweisArt)).toEqual({ id: 12, sortKeyMax: 100 });
  });

  it('gibt es sie nicht: id null; keine Liste: wirft „unlesbar“ statt „gibt es nicht“', async () => {
    const ct = new FalschesCt();
    expect(await gruppenartSuchen(ct.port, istNachweisArt)).toEqual({ id: null, sortKeyMax: 0 });
    const kaputt = {
      holen: () => Promise.resolve({ fehler: true }),
      schicken: () => Promise.resolve({}),
    } as never;
    await expect(gruppenartSuchen(kaputt, istNachweisArt)).rejects.toMatchObject({
      art: 'unlesbar',
      was: 'Die Liste der Gruppentypen',
    });
  });
});

describe('gruppenartRollen', () => {
  it('Leiter und Teilnehmer des Typs; versteckte zählen nicht, Standard zuerst', async () => {
    const ct = new FalschesCt();
    ct.rollen = [
      { id: 1, groupTypeId: 9, isLeader: true },
      { id: 2, groupTypeId: 9, isLeader: true, isDefault: true },
      { id: 3, groupTypeId: 9, isLeader: false },
      { id: 4, groupTypeId: 8, isLeader: false },
    ];
    expect(await gruppenartRollen(ct.port, 9)).toEqual({ leiter: 2, teilnehmer: 3 });
    expect(await gruppenartRollen(ct.port, 7)).toEqual({ leiter: null, teilnehmer: null });
  });
});

describe('gruppenartAnlegen', () => {
  it('legt nur an, wenn es sie nicht gibt – mit dem Körper aus der Vorgabe', async () => {
    const ct = new FalschesCt();
    ct.typen = [{ id: 2, name: 'Dienst', sortKey: 7 }];
    const r = await gruppenartAnlegen(ct.port, NACHWEIS_ART, istNachweisArt);
    expect(r.typId).toBe(11);
    expect(POST_TYP(ct)).toHaveLength(1);
    expect(POST_TYP(ct)[0].json).toEqual({
      ...NACHWEIS_ART,
      postsEnabled: false,
      isLeaderNecessary: false,
      availableForNewPerson: false,
      permissionDepth: 0,
      sortKey: 8,
    });
    // Zweiter Lauf: nichts mehr geschrieben, dieselbe Art.
    const nochmal = await gruppenartAnlegen(ct.port, NACHWEIS_ART, istNachweisArt);
    expect(nochmal).toEqual(r);
    expect(POST_TYP(ct)).toHaveLength(1);
  });

  it('gibt es sie schon: kein POST, die vorhandene Nummer', async () => {
    const ct = new FalschesCt();
    ct.typen = [{ id: 11, name: 'Nachweis', sortKey: 100 }];
    ct.rollen = [
      { id: 53, groupTypeId: 11, isLeader: false, isDefault: true },
      { id: 56, groupTypeId: 11, isLeader: true },
    ];
    expect(await gruppenartAnlegen(ct.port, NACHWEIS_ART, istNachweisArt)).toEqual({
      typId: 11,
      leiter: 56,
      teilnehmer: 53,
    });
    expect(ct.aufrufe).toEqual([]);
  });

  it('fehlen die Rollen, ist das ein verständlicher Fehler', async () => {
    const ct = new FalschesCt();
    ct.typen = [{ id: 11, name: 'Nachweis', sortKey: 1 }];
    ct.rollen = [{ id: 53, groupTypeId: 11, isLeader: false }];
    const e = await gruppenartAnlegen(ct.port, NACHWEIS_ART, istNachweisArt).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(GruppenartFehler);
    expect((e as Error).message).toBe(
      'Der Gruppentyp „Nachweis“ steht in ChurchTools, hat aber nicht beide Rollen (Leiter und Teilnehmer).',
    );
  });

  it('wird die Art nach dem POST nicht gefunden (200, aber nichts übernommen), wirft es', async () => {
    const ct = new FalschesCt();
    ct.ignoriere = ['POST /group/grouptypes'];
    await expect(gruppenartAnlegen(ct.port, NACHWEIS_ART, istNachweisArt)).rejects.toThrow(
      'Den Gruppentyp „Nachweis“ gibt es nicht.',
    );
  });
});

describe('fehlendeRechte', () => {
  it('Schlüssel ist authId + dataId; geerbt zählt als da; Zeilen ohne authId fallen weg', () => {
    const soll = [
      { authId: 1, dataId: 3, name: 'a' },
      { authId: 2, dataId: null, name: 'b' },
    ];
    expect(fehlendeRechte([], soll)).toEqual(soll);
    expect(fehlendeRechte([{ authId: 1, dataId: 4 }, { dataId: null }], soll)).toEqual(soll);
    expect(
      fehlendeRechte(
        [
          { authId: 1, dataId: 3 },
          { authId: 2, dataId: null, isInherited: true },
        ],
        soll,
      ),
    ).toEqual([]);
  });

  it('gegen die Erzeuger: Nachweis- und Wechsel-Rechte, nichts abgeschrieben', () => {
    const alle = (s: readonly { authId: number; dataId: number | null }[]) =>
      s.map(({ authId, dataId }) => ({ authId, dataId }));
    expect(fehlendeRechte(alle(NACHWEIS_LEITER_RECHTE), NACHWEIS_LEITER_RECHTE)).toEqual([]);
    expect(fehlendeRechte(alle(LEITER_RECHTE), LEITER_RECHTE)).toEqual([]);
    // Gruppeninfos/Mitglieder sehen (Stufe 1) haben beide; es fehlen die Feld-Rechte, die Folgeaufgaben und „Gruppenmitglieder hinzufügen“.
    expect(
      fehlendeRechte(alle(LEITER_RECHTE), NACHWEIS_LEITER_RECHTE).map((r) => r.authId),
    ).toEqual([10126, 10133, 10110, 10107]);
  });
});

/**
 * Der Baustein wird mit **einem** Recht geprüft – unabhängig davon, welche Rechte eine App verlangt (die Nachweis-Leiter
 * haben seit N3a sechs; das prüfen die Tests der Anmeldungen gegen `NACHWEIS_LEITER_RECHTE`).
 */
const EIN_RECHT = [{ authId: 10110, name: 'Follow-ups durchführen', dataId: null }] as const;

describe('rechteErgaenzen', () => {
  it('fehlt das Recht: PUT mit authId (ohne dataId bei null), danach nachgelesen', async () => {
    const ct = new FalschesCt();
    await rechteErgaenzen(ct.port, 56, EIN_RECHT);
    expect(ct.schreibende('PUT')).toEqual([
      { methode: 'PUT', pfad: '/permissions/group_type_role/56', json: { authId: 10110 } },
    ]);
    expect(fehlendeRechte(ct.rechte.get(56) ?? [], EIN_RECHT)).toEqual([]);
  });

  it('mit dataId: als Liste geschickt', async () => {
    const ct = new FalschesCt();
    await rechteErgaenzen(ct.port, 5, [{ authId: 1, dataId: 3, name: 'a' }]);
    expect(ct.schreibende('PUT')[0].json).toEqual({ authId: 1, dataId: [3] });
  });

  it('ist alles da: kein PUT; fremde Rechte bleiben, nichts wird entzogen', async () => {
    const ct = new FalschesCt();
    ct.rechte.set(56, [
      { authId: 10110, dataId: null },
      { authId: 777, dataId: 2 },
    ]);
    await rechteErgaenzen(ct.port, 56, EIN_RECHT);
    expect(ct.aufrufe).toEqual([]);
    expect(ct.rechte.get(56)).toHaveLength(2);
    // Auch beim Ergänzen: das Fremde steht danach noch da, es gibt nur PUT.
    ct.rechte.set(57, [{ authId: 777, dataId: 2 }]);
    await rechteErgaenzen(ct.port, 57, EIN_RECHT);
    expect(ct.rechte.get(57)).toEqual([
      { authId: 777, dataId: 2 },
      { authId: 10110, dataId: null },
    ]);
    expect(ct.aufrufe.every((a) => a.methode === 'PUT')).toBe(true);
  });

  it('PUT wird geschluckt (200, nichts übernommen): Fehler mit dem Namen des Rechts', async () => {
    const ct = new FalschesCt();
    ct.ignoriere = ['PUT /permissions'];
    const e = await rechteErgaenzen(ct.port, 56, EIN_RECHT).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(GruppenartFehler);
    expect(e).toMatchObject({ art: 'nichtUebernommen', was: '„Follow-ups durchführen“' });
    expect((e as Error).message).toBe(
      'ChurchTools hat „Follow-ups durchführen“ nicht übernommen. Bitte noch einmal versuchen.',
    );
  });
});

describe('modulRechtAus / modulRechtHolen', () => {
  const def = (authId: number) => ({
    modules: [
      { key: 'churchcore', permissions: [{ authId: 1, key: 'view' }] },
      { key: 'anmeldungen', permissions: [{ authId, key: 'view' }] },
    ],
  });

  it('sucht per Modul- und Recht-Schlüssel – die Nummer ist je Instanz anders', () => {
    expect(modulRechtAus(def(2020), 'anmeldungen', 'view')).toBe(2020);
    expect(modulRechtAus(def(77), 'anmeldungen', 'view')).toBe(77);
  });

  it('Modul fehlt, Recht fehlt, Antwort ohne Gestalt: null', () => {
    expect(modulRechtAus(def(2020), 'dienstplan', 'view')).toBeNull();
    expect(modulRechtAus(def(2020), 'anmeldungen', 'edit')).toBeNull();
    expect(modulRechtAus(null, 'anmeldungen', 'view')).toBeNull();
    expect(modulRechtAus({ modules: 'x' }, 'anmeldungen', 'view')).toBeNull();
  });

  it('modulRechtHolen: liefert ein SollRecht ohne Einschränkung; nicht gefunden = klarer Fehler „anders“', async () => {
    const ct = new FalschesCt();
    ct.definitionen = def(2020);
    expect(await modulRechtHolen(ct.port, 'anmeldungen', 'view', 'Anmeldungen sehen')).toEqual({
      authId: 2020,
      name: 'Anmeldungen sehen',
      dataId: null,
    });
    ct.definitionen = { modules: [] };
    await expect(
      modulRechtHolen(ct.port, 'anmeldungen', 'view', 'Anmeldungen sehen'),
    ).rejects.toMatchObject({
      art: 'anders',
      message: expect.stringContaining('Anmeldungen sehen'),
    });
  });

  it('modulRechtHolen: Antwort keine Gestalt = „unlesbar“ (vorübergehend), nicht „gibt es nicht“', async () => {
    const kaputt = {
      holen: () => Promise.resolve(null),
      schicken: () => Promise.resolve({}),
    } as never;
    await expect(modulRechtHolen(kaputt, 'anmeldungen', 'view', 'x')).rejects.toMatchObject({
      art: 'unlesbar',
    });
  });
});

describe('rechteErgaenzenAn (N3a): dieselbe Mechanik für Status, Gruppenrolle und Person', () => {
  it('schreibt und liest am Pfad des Ziels nach – je Art', async () => {
    for (const art of ['status', 'group_role', 'person'] as const) {
      const ct = new FalschesCt();
      await rechteErgaenzenAn(
        ct.port,
        { art, id: 4 },
        [{ authId: 2021, dataId: 9, name: 'x' }],
        'y',
      );
      expect(ct.schreibende('PUT')).toEqual([
        { methode: 'PUT', pfad: `/permissions/${art}/4`, json: { authId: 2021, dataId: [9] } },
      ]);
      expect(ct.rechteAn.get(`${art}:4`)).toEqual([{ authId: 2021, dataId: 9 }]);
    }
  });

  it('geschluckt: nichtUebernommen; vorhandenes am Ziel: kein PUT', async () => {
    const ct = new FalschesCt();
    ct.ignoriere = ['PUT /permissions'];
    const e = await rechteErgaenzenAn(
      ct.port,
      { art: 'person', id: 1 },
      [{ authId: 2025, dataId: 9, name: 'Daten sehen' }],
      'der Person 1',
    ).catch((x: unknown) => x);
    expect(e).toMatchObject({ art: 'nichtUebernommen', was: '„Daten sehen“' });
    const ct2 = new FalschesCt();
    ct2.rechteAn.set('person:1', [{ authId: 2025, dataId: 9 }]);
    await rechteErgaenzenAn(
      ct2.port,
      { art: 'person', id: 1 },
      [{ authId: 2025, dataId: 9, name: 'a' }],
      'b',
    );
    expect(ct2.aufrufe).toEqual([]);
  });
});

describe('rechtTraegerAus / rechtTraegerLesen (assignment-summary)', () => {
  const summary = (assignments: Record<string, unknown>) => ({
    authId: 2020,
    dataId: null,
    effectivePersonCount: 3,
    assignments: { statuses: [], groupTypes: [], groups: [], persons: [], ...assignments },
  });

  it('alle vier Quellen als Ziel – je Rolle eines, doppelte einmal', () => {
    expect(
      rechtTraegerAus(
        summary({
          statuses: [{ statusId: 2, personCount: 5 }],
          groupTypes: [{ groupTypeId: 11, groupTypeRoleIds: [56, 57], personCount: 2 }],
          groups: [
            { groupId: 17, groupRoleIds: [91], personCount: 1 },
            { groupId: 18, groupRoleIds: [91], personCount: 1 },
          ],
          persons: [{ personId: 1 }],
        }),
      ),
    ).toEqual([
      { art: 'status', id: 2 },
      { art: 'group_type_role', id: 56 },
      { art: 'group_type_role', id: 57 },
      { art: 'group_role', id: 91 },
      { art: 'person', id: 1 },
    ]);
  });

  it('niemand: leere Liste; unbekannte Gestalt: null (nicht „niemand“)', () => {
    expect(rechtTraegerAus(summary({}))).toEqual([]);
    expect(rechtTraegerAus({ authId: 2020 })).toBeNull();
    expect(rechtTraegerAus(summary({ persons: null }))).toBeNull();
    expect(rechtTraegerAus(null)).toBeNull();
  });

  it('Lesen: unbekannte Gestalt wirft „unlesbar“', async () => {
    const ct = new FalschesCt();
    ct.summaryKaputt = true;
    await expect(rechtTraegerLesen(ct.port, 2020)).rejects.toMatchObject({ art: 'unlesbar' });
    ct.summaryKaputt = false;
    ct.rechteAn.set('person:1', [{ authId: 2020, dataId: null }]);
    expect(await rechtTraegerLesen(ct.port, 2020)).toEqual([{ art: 'person', id: 1 }]);
  });
});
