import { describe, expect, it } from 'vitest';
import { NACHWEIS_ART, NACHWEIS_LEITER_RECHTE, istNachweisArt } from '../anmeldung/nachweise';
import { LEITER_RECHTE } from '../organigramm/gruppenwechsel';
import {
  fehlendeRechte,
  GruppenartFehler,
  gruppenartAnlegen,
  gruppenartRollen,
  gruppenartSuchen,
  rechteErgaenzen,
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
    // Gruppeninfos/Mitglieder sehen (Stufe 1) haben beide; es fehlen die Feld-Rechte und die Folgeaufgaben.
    expect(
      fehlendeRechte(alle(LEITER_RECHTE), NACHWEIS_LEITER_RECHTE).map((r) => r.authId),
    ).toEqual([10126, 10133, 10110]);
  });
});

/**
 * Der Baustein wird mit **einem** Recht geprüft – unabhängig davon, welche Rechte eine App verlangt (die Nachweis-Leiter
 * haben seit N1b fünf; das prüfen die Tests der Anmeldungen gegen `NACHWEIS_LEITER_RECHTE`).
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
