import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import {
  ERGEBNIS_EINTRAG,
  ERGEBNIS_OHNE,
  NACHWEIS_ABLAUF_NAME,
  NACHWEIS_FELDER,
  NACHWEIS_LEITER_RECHTE,
  NACHWEIS_STAND_KATEGORIE,
  NACHWEIS_TEILNEHMER_RECHTE,
  nachweisEinstellungenLesen,
  nachweisFeldAnlage,
  nachweisGruppenName,
  nachweisNotiz,
  nachweisSchritte,
  type NachweisEinstellungen,
} from '@shared/anmeldung/nachweise';
import { STUFE_NACHWEIS } from '@shared/anmeldung/felder';
import {
  NACHWEIS_SCHRITTE,
  nachweisArtSichern,
  nachweisArtenLesen,
  nachweisEinstieg,
  type NachweisEingabe,
} from './nachweisArten';
import { FalschesNachweisCt, type SchrittStand } from './nachweisArten.testutil';

/**
 * Die Nachweis-Arten gegen ein nachgestelltes ChurchTools (`FalschesNachweisCt`): Der Anschluss `@ui/ct/verbindung` ist
 * ersetzt. Soll-Werte kommen aus den Erzeugern (`NACHWEIS_LEITER_RECHTE`, `nachweisSchritte`, `nachweisFeldAnlage`), nicht
 * aus abgeschriebenen Zahlen.
 */
vi.mock('@ui/ct/verbindung', () => ({
  ctAnfrage: vi.fn(),
  ctDaten: vi.fn(),
  ctAlleSeiten: vi.fn(),
}));
const ct = vi.mocked(V);
/** Der Datenspeicher (Ablage „Nachweis-Stand“, N3a) läuft über denselben ersetzten Anschluss. */
vi.mock('@ui/ct/modulPort', async () =>
  (await import('./nachweisArten.testutil')).modulPortImTest(),
);

let falsch: FalschesNachweisCt;

const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Bitte Führungszeugnis beantragen',
  text: 'Hallo [Vorname], bitte beantrage ein Führungszeugnis.',
};
const EINGABE: NachweisEingabe = {
  gruppeId: null,
  name: 'Führungszeugnis',
  einstellungen: E,
  vertrauen: [7],
};
const ICH = 7;
const OHNE_ADMIN = { churchcore: { 'view birthdays': true }, churchdb: { 'view alldata': true } };

beforeEach(() => {
  falsch = new FalschesNachweisCt();
  ct.ctDaten.mockReset().mockImplementation((pfad: string) => falsch.holen(pfad));
  ct.ctAlleSeiten.mockReset().mockImplementation((pfad: string) => falsch.alleSeiten(pfad));
  ct.ctAnfrage.mockReset().mockImplementation(async (pfad: string, opt?: unknown) => {
    const o = opt as { method?: string; body?: string };
    return await falsch.schicken(
      pfad,
      o.method ?? 'GET',
      typeof o.body === 'string' ? JSON.parse(o.body) : undefined,
    );
  });
});

/** Schreibaufrufe in der Reihenfolge, in der sie stattfanden – als „METHODE pfad“. */
const reihe = () => falsch.aufrufe.map((a) => `${a.methode} ${a.pfad}`);
/** Die Aufrufe, die eine Gruppe anlegen (nicht die Felder darin: auch die beginnen mit „POST /groups“). */
const gruppenAngelegt = () =>
  falsch.aufrufe.filter((a) => a.methode === 'POST' && a.pfad === '/groups');
const gruppeDerArt = () => [...falsch.gruppen.values()].find((g) => g.name.startsWith('Nachweis'))!;

describe('Anlegen einer neuen Nachweis-Art', () => {
  it('legt alles in der richtigen Reihenfolge an – und liest es nach', async () => {
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeNull();
    expect(erg.erledigt).toEqual([...NACHWEIS_SCHRITTE]);

    const g = gruppeDerArt();
    expect(erg.gruppeId).toBe(g.id);
    const r = reihe();
    const nach = (muster: string) => r.findIndex((x) => x.includes(muster));
    expect(nach('POST /group/grouptypes')).toBeLessThan(nach('PUT /permissions'));
    expect(nach('PUT /permissions')).toBeLessThan(nach('POST /groups'));
    expect(nach('POST /groups')).toBeLessThan(nach('PATCH /groups'));
    expect(nach('PATCH /groups')).toBeLessThan(nach('POST /groups/' + g.id + '/memberfields'));
    expect(nach('memberfields/group')).toBeLessThan(nach('PUT /groups/' + g.id + '/members'));
    expect(nach('PUT /groups/' + g.id + '/members')).toBeLessThan(nach('POST /routines'));
    expect(nach('POST /routines')).toBeLessThan(nach('PATCH /routines'));

    // Gruppe: Name, Art, aktiv, eingeschränkt – keine Anmeldung über ChurchTools
    expect(g).toMatchObject({
      name: nachweisGruppenName('Führungszeugnis'),
      groupTypeId: 11,
      groupStatusId: 1,
      visibility: 'restricted',
    });
    expect(nachweisEinstellungenLesen(g.note)).toEqual(E);
    expect(erg.befund).toMatchObject({
      gruppeId: g.id,
      gruppenName: 'Nachweis: Führungszeugnis',
      felder: NACHWEIS_FELDER.map((f) => f.name),
      ablauf: { an: true, schritte: 4 },
    });
  });

  it('Rechte: die sechs der Leiter-Rolle plus das Modulrecht „Anmeldungen sehen“, an der Teilnehmer-Rolle nur „Gruppeninfos sehen“ (M6)', async () => {
    await nachweisArtSichern(EINGABE, ICH);
    // Die Nummer des Modulrechts kommt aus den Definitionen des falschen ChurchTools (nicht abgeschrieben).
    const modulId = (
      falsch.basis.definitionen as { modules: { permissions: { authId: number }[] }[] }
    ).modules[0].permissions[0].authId;
    // Danach (Schritt „stand“, N3a) die vier Rechte an der Ablage „Nachweis-Stand“ – eigener Test unten.
    expect(falsch.basis.rechte.get(54)?.slice(0, NACHWEIS_LEITER_RECHTE.length + 1)).toEqual([
      ...NACHWEIS_LEITER_RECHTE.map(({ authId, dataId }) => ({ authId, dataId })),
      { authId: modulId, dataId: null },
    ]);
    expect(falsch.basis.rechte.get(53)?.some((r) => r.authId === modulId)).toBe(false);
    expect(falsch.basis.rechte.get(53)).toEqual(
      NACHWEIS_TEILNEHMER_RECHTE.map(({ authId, dataId }) => ({ authId, dataId })),
    );
    expect(NACHWEIS_TEILNEHMER_RECHTE).toEqual([
      { authId: 10102, name: 'Gruppeninfos sehen', dataId: 1 },
    ]);
  });

  it('Schritt „stand“ (N3a): Ablage „Nachweis-Stand“ angelegt, die Leiter-Rolle darf dort sehen, anlegen, ändern', async () => {
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.erledigt.at(-1)).toBe('stand');
    const k = falsch.basis.kategorien.find((x) => x.shorty === NACHWEIS_STAND_KATEGORIE.kuerzel)!;
    expect(k).toBeDefined();
    const anKategorie = (falsch.basis.rechte.get(54) ?? []).filter((r) => r.dataId === k.id);
    expect(anKategorie).toHaveLength(4);
    // Die Vertrauenspersonen haben „Anmeldungen sehen“ (Rolle 54) – sie stehen also selbst unter den Trägern.
    expect(falsch.schreibend('PUT /permissions/person')).toEqual([]);
  });

  it('scheitert der Schritt „stand“, steht die Art – das Ergebnis nennt genau diesen Schritt', async () => {
    falsch.basis.summaryKaputt = true;
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.erledigt).toEqual(NACHWEIS_SCHRITTE.filter((x) => x !== 'stand'));
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect((erg.fehler as ApiError).status).toBe(502);
    expect(erg.gruppeId).toBe(gruppeDerArt().id);
  });

  it('Felder: drei, Stufe aus der Konstante, nicht im Anmeldeformular', async () => {
    await nachweisArtSichern(EINGABE, ICH);
    const felder = falsch.felder.get(gruppeDerArt().id)!;
    expect(felder.map((f) => f.name)).toEqual(['Eingesehen am', 'Ausgestellt am', 'Ergebnis']);
    for (const f of felder) {
      expect(f.securityLevel).toBe(STUFE_NACHWEIS);
      expect(f.useInRegistrationForm).toBe(false);
    }
    expect(felder[2].options?.map((o) => o.name)).toEqual([ERGEBNIS_OHNE, ERGEBNIS_EINTRAG]);
    const post = falsch.schreibend('memberfields/group').map((a) => a.json);
    expect(post).toEqual(NACHWEIS_FELDER.map((f) => nachweisFeldAnlage(f)));
  });

  it('Vertrauensperson ist Leiter der Gruppe', async () => {
    await nachweisArtSichern({ ...EINGABE, vertrauen: [7, 8] }, ICH);
    const m = falsch.mitglieder.get(gruppeDerArt().id)!;
    expect(m.map((x) => [x.personId, x.groupTypeRoleId])).toEqual([
      [7, 54],
      [8, 54],
    ]);
    // Anlegen per PUT mit only_add (nie per PATCH – das legt nichts an)
    expect(falsch.schreibend('PUT /groups/').map((a) => a.json)).toEqual([
      { groupTypeRoleId: 54, groupMemberStatus: 'active', only_add: true },
      { groupTypeRoleId: 54, groupMemberStatus: 'active', only_add: true },
    ]);
  });

  it('Ablauf: Teilnehmer-Rolle, aktiv, Schritte aus dem Erzeuger, Absender = die speichernde Vertrauensperson', async () => {
    await nachweisArtSichern({ ...EINGABE, vertrauen: [5, 7] }, ICH);
    const rt = [...falsch.routinen.values()];
    expect(rt).toHaveLength(1);
    expect(rt[0]).toMatchObject({
      name: NACHWEIS_ABLAUF_NAME,
      isEnabled: true,
      groupTypeRoleId: 53,
      groupMemberStatus: 'active',
    });
    const soll = nachweisSchritte({ name: 'Führungszeugnis', ...E }, 7);
    const projekt = (l: { actionKey: string; children?: unknown[] }[]) => l.map((s) => s.actionKey);
    expect(projekt(rt[0].steps)).toEqual(projekt(soll));
    expect(rt[0].steps[0].actionData).toMatchObject({ senderId: 7 });
  });

  it('(d) die Gültigkeit der Art steht als numYears im Wiederholen', async () => {
    await nachweisArtSichern({ ...EINGABE, einstellungen: { ...E, gueltigJahre: 5 } }, ICH);
    const wiederholen = [...falsch.routinen.values()][0].steps[3];
    expect(wiederholen.children?.[0].actionData).toMatchObject({ duration: { numYears: 5 } });
  });

  it('(a) die Gruppe wird nachgelesen: eine Sichtbarkeit, die ChurchTools nicht übernimmt, ist NichtUebernommen', async () => {
    falsch.mitArt();
    falsch.sichtbarkeitFest = 'public';
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(NichtUebernommen);
    expect((erg.fehler as Error).message).toContain('Sichtbarkeit');
    expect(erg.erledigt).toEqual(['grundlage']);
    // danach wird nichts weiter angelegt
    expect(falsch.schreibend('memberfields')).toEqual([]);
    expect(falsch.schreibend('POST /routines')).toEqual([]);
  });

  it('(a) „Erfolg“ ohne Gruppe (ChurchTools gibt eine Nummer, legt nichts an): Fehler, keine Nummer gemerkt', async () => {
    falsch.mitArt();
    falsch.ignoriere = ['POST /groups'];
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(ApiError);
    expect(erg.erledigt).toEqual(['grundlage']);
    expect(erg.gruppeId).toBeNull();
    expect(falsch.schreibend('memberfields')).toEqual([]);
  });

  it('(c) Felder: ChurchTools übernimmt die Stufe nicht → NichtUebernommen, nicht „fertig“', async () => {
    falsch.mitArt();
    const g = falsch.gruppeAnlegen('Nachweis: Führungszeugnis');
    falsch.felder.set(g.id, [
      {
        id: 1,
        name: 'Eingesehen am',
        fieldTypeCode: 'date',
        securityLevel: 1,
        useInRegistrationForm: false,
        requiredInRegistrationForm: false,
      },
    ]);
    falsch.ignoriere = ['PATCH /groups/' + g.id + '/memberfields'];
    const erg = await nachweisArtSichern({ ...EINGABE, gruppeId: g.id }, ICH);
    expect(erg.fehler).toBeInstanceOf(NichtUebernommen);
    expect(erg.erledigt).toEqual(['grundlage', 'gruppe', 'einstellungen']);
  });

  it('(c) allein die zu niedrige Stufe genügt: ein sonst vollständiges Feld wird heraufgesetzt', async () => {
    falsch.mitArt();
    const g = falsch.gruppeAnlegen('Nachweis: Führungszeugnis');
    falsch.felder.set(
      g.id,
      NACHWEIS_FELDER.map((f, i) => ({
        ...nachweisFeldAnlage(f),
        id: i + 1,
        // Eine Stufe weit unter der Vorgabe – sonst ist alles da (Antworten, nicht im Anmeldeformular).
        securityLevel: STUFE_NACHWEIS - 2,
        options: 'optionen' in f ? f.optionen.map((name, k) => ({ id: `o${k}`, name })) : undefined,
      })),
    );
    const erg = await nachweisArtSichern({ ...EINGABE, gruppeId: g.id }, ICH);
    expect(erg.fehler).toBeNull();
    expect(falsch.felder.get(g.id)!.map((f) => f.securityLevel)).toEqual([
      STUFE_NACHWEIS,
      STUFE_NACHWEIS,
      STUFE_NACHWEIS,
    ]);
    // keine neuen Felder, die Antworten behalten ihre Nummern
    expect(falsch.felder.get(g.id)).toHaveLength(3);
    expect(falsch.felder.get(g.id)![2].options?.map((o) => o.id)).toEqual(['o0', 'o1']);
  });

  it('(c) ein Feld mit zu niedriger Stufe wird auf die Stufe heraufgesetzt, die Antworten bleiben', async () => {
    falsch.mitArt();
    const g = falsch.gruppeAnlegen('Nachweis: Führungszeugnis');
    falsch.felder.set(g.id, [
      {
        id: 1,
        name: 'Ergebnis',
        fieldTypeCode: 'radioselect',
        securityLevel: 1,
        useInRegistrationForm: false,
        requiredInRegistrationForm: false,
        options: [{ id: 'a1', name: ERGEBNIS_OHNE }],
      },
    ]);
    const erg = await nachweisArtSichern({ ...EINGABE, gruppeId: g.id }, ICH);
    expect(erg.fehler).toBeNull();
    const f = falsch.felder.get(g.id)!.find((x) => x.name === 'Ergebnis')!;
    expect(f.securityLevel).toBe(STUFE_NACHWEIS);
    // die vorhandene Antwort behält ihre Nummer, die zweite kommt dazu
    expect(f.options?.map((o) => o.name)).toEqual([ERGEBNIS_OHNE, ERGEBNIS_EINTRAG]);
    expect(f.options?.[0].id).toBe('a1');
  });
});

describe('„gibt es schon“', () => {
  const vorhanden = () => {
    falsch.mitArt();
    return falsch.gruppeAnlegen(
      'Nachweis: Führungszeugnis',
      nachweisNotiz({ ...E, gueltigJahre: 2 }),
    );
  };

  it('(b) eine fertige Art dieses Namens wird nicht doppelt angelegt – gemeldet, nichts geschrieben', async () => {
    const g = vorhanden();
    const e = await nachweisArtSichern({ ...EINGABE, name: ' führungszeugnis ' }, ICH).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(409);
    expect((e as Error).message).toContain('gibt es schon');
    expect(falsch.gruppen.size).toBe(1);
    expect(gruppenAngelegt()).toEqual([]);
    expect(falsch.aufrufe).toEqual([]);
    expect(nachweisEinstellungenLesen(g.note)?.gueltigJahre).toBe(2);
  });

  it('(b) eine Gruppe dieses Namens ohne Einstellungen (Rest eines abgebrochenen Versuchs) wird übernommen, keine zweite angelegt', async () => {
    falsch.mitArt();
    const waise = falsch.gruppeAnlegen('Nachweis: Führungszeugnis');
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeNull();
    expect(erg.gruppeId).toBe(waise.id);
    expect(falsch.gruppen.size).toBe(1);
    expect(gruppenAngelegt()).toEqual([]);
  });

  it('(b) zwei Gruppen gleichen Namens: nicht raten, nichts anlegen', async () => {
    falsch.mitArt();
    falsch.gruppeAnlegen('Nachweis: Führungszeugnis');
    falsch.gruppeAnlegen('Nachweis: Führungszeugnis');
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect((erg.fehler as ApiError).status).toBe(409);
    expect(falsch.gruppen.size).toBe(2);
    expect(gruppenAngelegt()).toEqual([]);
  });
});

describe('Teilerfolg und „Nochmal“', () => {
  it('scheitert der Ablauf (503): Ergebnis sagt, was steht; Nochmal legt nichts doppelt an', async () => {
    falsch.scheitert = [{ muster: 'POST /routines', status: 503 }];
    const erst = await nachweisArtSichern(EINGABE, ICH);
    expect(erst.fehler).toBeInstanceOf(ApiError);
    expect((erst.fehler as ApiError).status).toBe(503);
    expect(erst.erledigt).toEqual(['grundlage', 'gruppe', 'einstellungen', 'felder', 'leitung']);
    expect(erst.befund).toBeNull();
    expect(erst.gruppeId).not.toBeNull();

    falsch.scheitert = [];
    const davor = falsch.aufrufe.length;
    const zweit = await nachweisArtSichern({ ...EINGABE, gruppeId: erst.gruppeId }, ICH);
    expect(zweit.fehler).toBeNull();
    expect(zweit.erledigt).toEqual([...NACHWEIS_SCHRITTE]);
    const neu = falsch.aufrufe.slice(davor).map((a) => `${a.methode} ${a.pfad}`);
    // nichts doppelt: keine zweite Gruppe, keine zweiten Felder, keine zweite Mitgliedschaft
    expect(neu.filter((x) => x === 'POST /groups')).toEqual([]);
    expect(neu.filter((x) => x.includes('memberfields'))).toEqual([]);
    expect(neu.filter((x) => x.includes('/members/'))).toEqual([]);
    expect(falsch.gruppen.size).toBe(1);
    expect(falsch.felder.get(erst.gruppeId!)).toHaveLength(3);
    expect(falsch.routinen.size).toBe(1);
  });

  it('Nochmal ohne Nummer nach Teilerfolg: die fertige Art wird gemeldet, nicht doppelt angelegt', async () => {
    falsch.scheitert = [{ muster: 'POST /routines', status: 503 }];
    await nachweisArtSichern(EINGABE, ICH);
    falsch.scheitert = [];
    const e = await nachweisArtSichern(EINGABE, ICH).catch((x: unknown) => x);
    expect((e as ApiError).status).toBe(409);
    expect(falsch.gruppen.size).toBe(1);
  });

  it('ChurchTools legt die Routine an, die Schritte scheitern: Nochmal schreibt die Schritte in dieselbe Routine', async () => {
    falsch.scheitert = [{ muster: 'PATCH /routines', status: 504 }];
    const erst = await nachweisArtSichern(EINGABE, ICH);
    expect((erst.fehler as ApiError).status).toBe(504);
    expect(falsch.routinen.size).toBe(1);
    falsch.scheitert = [];
    const zweit = await nachweisArtSichern({ ...EINGABE, gruppeId: erst.gruppeId }, ICH);
    expect(zweit.fehler).toBeNull();
    expect(falsch.routinen.size).toBe(1);
    expect([...falsch.routinen.values()][0].steps).toHaveLength(4);
  });

  it('ein 5xx bricht ab, ohne etwas zu löschen oder zu verwerfen', async () => {
    falsch.scheitert = [{ muster: 'memberfields/group', status: 503 }];
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect((erg.fehler as ApiError).status).toBe(503);
    expect(erg.erledigt).toEqual(['grundlage', 'gruppe', 'einstellungen']);
    expect(falsch.schreibende('DELETE')).toEqual([]);
    expect(falsch.gruppen.size).toBe(1);
    expect(nachweisEinstellungenLesen(gruppeDerArt().note)).toEqual(E);
  });

  it('ChurchTools schluckt die Einstellungen (200, nichts übernommen): NichtUebernommen', async () => {
    falsch.ignoriere = ['PATCH /groups/'];
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(NichtUebernommen);
    expect(erg.erledigt).toEqual(['grundlage', 'gruppe']);
  });

  it('ChurchTools schluckt den Ablauf (200, Schritte nicht übernommen): NichtUebernommen', async () => {
    // Die Routine entsteht, die Schritte bleiben leer.
    falsch.ignoriere = ['PATCH /routines'];
    const erg = await nachweisArtSichern(EINGABE, ICH);
    expect(erg.fehler).toBeInstanceOf(NichtUebernommen);
    expect(erg.erledigt).toEqual(['grundlage', 'gruppe', 'einstellungen', 'felder', 'leitung']);
  });
});

describe('Eingaben, die vor dem Schreiben abgewiesen werden', () => {
  it('ohne Namen, mit leerem Betreff, ohne Vertrauensperson: wirft, schreibt nichts', async () => {
    for (const e of [
      { ...EINGABE, name: '  ' },
      { ...EINGABE, einstellungen: { ...E, betreff: '' } },
      { ...EINGABE, einstellungen: { ...E, text: 'Hallo [Quatsch]' } },
      { ...EINGABE, vertrauen: [] },
    ]) {
      await expect(nachweisArtSichern(e, ICH)).rejects.toMatchObject({ status: 422 });
    }
    expect(falsch.aufrufe).toEqual([]);
  });
});

describe('Bearbeiten', () => {
  /** Eine fertig angelegte Art, wie nach dem ersten Speichern. */
  async function angelegt() {
    const erg = await nachweisArtSichern({ ...EINGABE, vertrauen: [7, 8] }, ICH);
    expect(erg.fehler).toBeNull();
    falsch.aufrufe = [];
    return erg.gruppeId!;
  }
  const ablauf = () => [...falsch.routinen.values()][0];

  it('(e) ändert den vorhandenen Ablauf mit seinen Schritt-Nummern – kein neuer, keine Schritte weniger', async () => {
    const id = await angelegt();
    const vorher = JSON.parse(JSON.stringify(ablauf().steps)) as SchrittStand[];
    const erg = await nachweisArtSichern(
      {
        gruppeId: id,
        name: 'Führungszeugnis',
        einstellungen: { ...E, gueltigJahre: 5, betreff: 'Neuer Betreff' },
        vertrauen: [7, 8],
      },
      ICH,
    );
    expect(erg.fehler).toBeNull();
    expect(falsch.routinen.size).toBe(1);
    expect(falsch.schreibend('POST /routines')).toEqual([]);
    const nachher = ablauf().steps;
    const nummern = (l: typeof nachher) =>
      l.map((s) => [s.id, s.specId, ...(s.children ?? []).map((c) => [c.id, c.specId])]);
    expect(nummern(nachher)).toEqual(nummern(vorher));
    expect(nachher[0].actionData).toMatchObject({ subject: 'Neuer Betreff' });
    expect(nachher[3].children?.[0].actionData).toMatchObject({ duration: { numYears: 5 } });
    // und es ging als EIN Schreiben mit allen Nummern raus
    const patch = falsch.schreibend('PATCH /routines')[0].json as { steps: { id?: number }[] };
    expect(patch.steps.every((s) => typeof s.id === 'number')).toBe(true);
  });

  it('Umbenennen: Name der Gruppe, Beschreibung der Folgeaufgaben; Einstellungen in der Beschreibung', async () => {
    const id = await angelegt();
    await nachweisArtSichern(
      {
        gruppeId: id,
        name: 'JuLeiCa',
        einstellungen: { ...E, gueltigJahre: 2, ab: 'einsicht' },
        vertrauen: [7, 8],
      },
      ICH,
    );
    expect(falsch.gruppen.get(id)?.name).toBe('Nachweis: JuLeiCa');
    expect(nachweisEinstellungenLesen(falsch.gruppen.get(id)?.note)).toMatchObject({
      gueltigJahre: 2,
      ab: 'einsicht',
    });
    expect(ablauf().steps[2].actionData).toMatchObject({ description: 'JuLeiCa einsehen' });
  });

  it('ohne Änderung wird nichts geschrieben, was schon so dasteht', async () => {
    const id = await angelegt();
    const erg = await nachweisArtSichern(
      { gruppeId: id, name: 'Führungszeugnis', einstellungen: E, vertrauen: [7, 8] },
      ICH,
    );
    expect(erg.fehler).toBeNull();
    expect(falsch.schreibend('PATCH /groups/' + id)).toEqual([]);
    expect(falsch.schreibend('memberfields')).toEqual([]);
    expect(falsch.schreibend('/members/')).toEqual([]);
  });

  it('Absender bleibt, wer es war, solange er Vertrauensperson ist', async () => {
    const id = await angelegt();
    // 8 speichert, 7 war Absender und bleibt Vertrauensperson
    await nachweisArtSichern(
      { gruppeId: id, name: 'Führungszeugnis', einstellungen: E, vertrauen: [7, 8] },
      8,
    );
    expect(ablauf().steps[0].actionData).toMatchObject({ senderId: 7 });
    // 7 wird entfernt: der Absender wechselt auf eine verbliebene
    await nachweisArtSichern(
      { gruppeId: id, name: 'Führungszeugnis', einstellungen: E, vertrauen: [8], entfernen: [7] },
      8,
    );
    expect(ablauf().steps[0].actionData).toMatchObject({ senderId: 8 });
  });

  it('Vertrauensperson hinzufügen: neue per PUT, bestehende bleiben', async () => {
    const id = await angelegt();
    await nachweisArtSichern(
      { gruppeId: id, name: 'Führungszeugnis', einstellungen: E, vertrauen: [7, 8, 9] },
      ICH,
    );
    expect(falsch.mitglieder.get(id)?.map((m) => m.personId)).toEqual([7, 8, 9]);
    expect(falsch.schreibend('/members/').map((a) => `${a.methode} ${a.pfad}`)).toEqual([
      `PUT /groups/${id}/members/9`,
    ]);
  });

  it('eine Person, die schon als Teilnehmer in der Gruppe ist, wird per PATCH zur Leitung (nicht per PUT)', async () => {
    const id = await angelegt();
    falsch.mitgliedSetzen(id, { personId: 9, groupTypeRoleId: 53 });
    await nachweisArtSichern(
      { gruppeId: id, name: 'Führungszeugnis', einstellungen: E, vertrauen: [7, 8, 9] },
      ICH,
    );
    expect(falsch.mitglieder.get(id)?.find((m) => m.personId === 9)?.groupTypeRoleId).toBe(54);
    expect(falsch.schreibend('/members/').map((a) => a.methode)).toEqual(['PATCH']);
  });

  it('Entfernen nur auf ausdrücklichen Wunsch: ohne eigene Angaben wird die Mitgliedschaft entfernt', async () => {
    const id = await angelegt();
    await nachweisArtSichern(
      { gruppeId: id, name: 'Führungszeugnis', einstellungen: E, vertrauen: [7], entfernen: [8] },
      ICH,
    );
    expect(falsch.mitglieder.get(id)?.map((m) => m.personId)).toEqual([7]);
    expect(falsch.schreibende('DELETE')).toHaveLength(1);
  });

  it('ohne „entfernen“ bleibt eine nicht mehr genannte Leitung stehen', async () => {
    const id = await angelegt();
    await nachweisArtSichern(
      { gruppeId: id, name: 'Führungszeugnis', einstellungen: E, vertrauen: [7] },
      ICH,
    );
    expect(falsch.mitglieder.get(id)?.map((m) => m.personId)).toEqual([7, 8]);
    expect(falsch.schreibende('DELETE')).toEqual([]);
  });

  it('eine Leitung mit eigenen Angaben wird nicht entfernt (das löschte sie): 409, nichts gelöscht', async () => {
    const id = await angelegt();
    falsch.mitglieder.get(id)!.find((m) => m.personId === 8)!.fields = [
      { id: 1, value: '2026-01-02' },
    ];
    const erg = await nachweisArtSichern(
      { gruppeId: id, name: 'Führungszeugnis', einstellungen: E, vertrauen: [7], entfernen: [8] },
      ICH,
    );
    expect((erg.fehler as ApiError).status).toBe(409);
    expect(falsch.schreibende('DELETE')).toEqual([]);
    expect(falsch.mitglieder.get(id)).toHaveLength(2);
  });

  it('die letzte Vertrauensperson lässt sich nicht entfernen', async () => {
    const id = await angelegt();
    const erg = await nachweisArtSichern(
      { gruppeId: id, name: 'Führungszeugnis', einstellungen: E, vertrauen: [], entfernen: [7, 8] },
      ICH,
    );
    expect((erg.fehler as ApiError).status).toBe(422);
    expect(falsch.schreibende('DELETE')).toEqual([]);
  });

  it('der Ablauf wurde in ChurchTools umgebaut: nichts angefasst, 409', async () => {
    const id = await angelegt();
    ablauf().steps.splice(1, 0, {
      id: 4711,
      actionKey: 'send-member-email',
      isEnabled: true,
      actionData: { subject: 'Eigene Mail' },
    });
    const vorher = JSON.stringify(ablauf().steps);
    const erg = await nachweisArtSichern(
      {
        gruppeId: id,
        name: 'Führungszeugnis',
        einstellungen: { ...E, gueltigJahre: 4 },
        vertrauen: [7, 8],
      },
      ICH,
    );
    expect((erg.fehler as ApiError).status).toBe(409);
    expect(erg.erledigt).toContain('leitung');
    expect(erg.erledigt).not.toContain('ablauf');
    expect(JSON.stringify(ablauf().steps)).toBe(vorher);
    expect(falsch.schreibend('PATCH /routines')).toEqual([]);
  });

  it('ein fremder Ablauf für die Teilnehmer-Rolle bleibt stehen: 409', async () => {
    falsch.mitArt();
    const g = falsch.gruppeAnlegen('Nachweis: Führungszeugnis');
    falsch.routinen.set(77, {
      id: 77,
      name: 'Mein eigener Ablauf',
      isEnabled: true,
      steps: [],
      groupId: g.id,
      groupTypeRoleId: 53,
      groupMemberStatus: 'active',
    });
    const erg = await nachweisArtSichern({ ...EINGABE, gruppeId: g.id }, ICH);
    expect((erg.fehler as ApiError).status).toBe(409);
    expect(falsch.schreibend('PATCH /routines')).toEqual([]);
    expect(falsch.routinen.size).toBe(1);
  });
});

describe('Lesen', () => {
  it('listet die Arten mit Namen ohne Präfix, Gültigkeit und Vertrauenspersonen – nach Name sortiert', async () => {
    falsch.mitArt();
    const b = falsch.gruppeAnlegen('Nachweis: JuLeiCa', nachweisNotiz({ ...E, gueltigJahre: 2 }));
    falsch.mitgliedSetzen(b.id, { personId: 8, groupTypeRoleId: 56, title: 'Ben Leitung' });
    falsch.mitgliedSetzen(b.id, { personId: 9, groupTypeRoleId: 53, title: 'Nur Teilnehmer' });
    const a = falsch.gruppeAnlegen('Nachweis: Führungszeugnis', nachweisNotiz(E));
    falsch.mitgliedSetzen(a.id, { personId: 7, groupTypeRoleId: 56, title: 'Anna Leitung' });
    const arten = await nachweisArtenLesen(11);
    expect(arten.map((x) => x.name)).toEqual(['Führungszeugnis', 'JuLeiCa']);
    expect(arten[0].einstellungen?.gueltigJahre).toBe(3);
    expect(arten[0].vertrauen?.map((p) => p.name)).toEqual(['Anna Leitung']);
    expect(arten[1].vertrauen?.map((p) => p.name)).toEqual(['Ben Leitung']);
    expect(falsch.aufrufe).toEqual([]);
  });

  it('eine Gruppe ohne gültige Einstellungen: einstellungen null (nicht fertig eingerichtet)', async () => {
    falsch.mitArt();
    falsch.gruppeAnlegen('Nachweis: Halb');
    expect((await nachweisArtenLesen(11))[0].einstellungen).toBeNull();
  });

  it('Mitglieder nicht lesbar (403): vertrauen null, nicht „niemand“', async () => {
    falsch.mitArt();
    const g = falsch.gruppeAnlegen('Nachweis: X', nachweisNotiz(E));
    falsch.ohneMitgliederRecht.add(g.id);
    expect((await nachweisArtenLesen(11))[0].vertrauen).toBeNull();
  });

  it('ein vorübergehender Fehler beim Lesen wirft, statt eine leere Liste zu zeigen', async () => {
    falsch.mitArt();
    const g = falsch.gruppeAnlegen('Nachweis: X', nachweisNotiz(E));
    ct.ctAlleSeiten.mockImplementation(async (pfad: string) => {
      if (pfad.includes(`/groups/${g.id}/members`)) throw new ApiError(503, 'weg');
      return await falsch.alleSeiten(pfad);
    });
    await expect(nachweisArtenLesen(11)).rejects.toMatchObject({ status: 503 });
  });
});

describe('Einstieg auf der Startseite', () => {
  it('„Berechtigungen verwalten“: sichtbar, darf einrichten', async () => {
    falsch.mitArt();
    expect(await nachweisEinstieg(new Set())).toEqual({ darfEinrichten: true, arten: [] });
  });

  it('Leitung einer Nachweis-Gruppe ohne Admin-Recht: sichtbar, darf nicht einrichten', async () => {
    falsch.mitArt();
    falsch.global = OHNE_ADMIN;
    const g = falsch.gruppeAnlegen('Nachweis: X', nachweisNotiz(E));
    expect(await nachweisEinstieg(new Set([g.id]))).toMatchObject({
      darfEinrichten: false,
      arten: [{ id: g.id, personen: [] }],
    });
  });

  it('Leitung einer anderen Gruppe, kein Admin: nicht sichtbar', async () => {
    falsch.mitArt();
    falsch.global = OHNE_ADMIN;
    falsch.gruppeAnlegen('Nachweis: X', nachweisNotiz(E));
    expect(await nachweisEinstieg(new Set([4711]))).toBeNull();
  });

  it('nicht lesbar (5xx): null – die Startseite bleibt, die Karte fehlt nur', async () => {
    ct.ctDaten.mockRejectedValue(new ApiError(503, 'weg'));
    expect(await nachweisEinstieg(new Set([1]))).toBeNull();
  });
});
