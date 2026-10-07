import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { songPageKey } from '@shared/keys/index';
import { _bremseLoesen, _vergissCsrf, KeinSpeicherRecht } from './ctRuntime';
import { _vergissModul } from './ctModulDaten';
import {
  _vergissAblagen,
  anmerkungenVon,
  einstellungenVon,
  TEILEN_KATEGORIE,
  teilende,
  teilenEinrichten,
  teilenSetzen,
  teiltIch,
} from './ctTeilen';
import {
  _zuruecksetzen,
  holeTeilen,
  schreibeAnmerkung,
  schreibeEinstellungen,
  schreibeTeilen,
} from './personenAblage';
import { FakeCt } from './ctFake.testutil';
import { einstellungenSpeichern } from './ctEinstellungen';
import { meineRechte } from './ctLesen';
import { DEFAULT_SITE_CONFIG } from '@shared/types/index';

/**
 * Team-Notizen in der Erweiterung (#335, 3b-4b): das Verzeichnis „Wer teilt" in den Daten der
 * Erweiterung, die Wahrheit in der eigenen Datei der Person. Die Ablagen der anderen entstehen mit den
 * echten Schreibfunktionen (FakeCt als diese Person) – nicht als handgeschriebenes JSON.
 */
vi.mock('./modus', async (original) => ({
  ...(await original<typeof import('./modus')>()),
  erweiterungsKuerzel: () => 'musik-app',
}));

const ICH = 19;
const ANNA = 20;
const LIED = 7;
const SEITE = songPageKey(LIED, 'original', false, 0);
const PNG = `data:image/png;base64,${btoa('\x89PNG Annas Striche')}`;

let ct: FakeCt;

/** Ab jetzt ist `id` angemeldet – mit frischem Speicher, wie ein anderes Gerät. */
function alsPerson(id: number, vorname: string): void {
  ct.ich = id;
  ct.liefere('/api/whoami', { data: { id, firstName: vorname, lastName: 'Test' } });
  _zuruecksetzen();
  _vergissAblagen();
}

/** Anna teilt und hat Striche, einen Text und eine Tonart zu Lied 7 – über die echten Wege. */
async function annaTeilt(): Promise<void> {
  alsPerson(ANNA, 'Anna');
  await teilenSetzen(true);
  await schreibeAnmerkung(SEITE, {
    strokes: PNG,
    texts: [{ id: 1, text: 'leise', fx: 0.1, fy: 0.2 }] as never,
    zoom: { scale: 2 } as never,
  });
  await schreibeEinstellungen({ worship_key_7: 'A' });
  alsPerson(ICH, 'Alwin');
}

beforeEach(async () => {
  _vergissCsrf();
  _bremseLoesen();
  _vergissModul();
  ct = new FakeCt();
  ct.installieren();
  alsPerson(ICH, 'Alwin');
  await teilenEinrichten(); // wie der Admin beim Speichern der Gruppen
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Einrichten', () => {
  it('legt das Verzeichnis einmal an – ein zweites Mal ändert nichts', async () => {
    await teilenEinrichten();
    expect(ct.kategorien.filter((k) => k.shorty === TEILEN_KATEGORIE.kuerzel)).toHaveLength(1);
  });
});

describe('Eigenes Teilen', () => {
  it('einschalten: Eintrag im Verzeichnis UND in der eigenen Datei', async () => {
    await teilenSetzen(true);
    expect(ct.werte.map((w) => JSON.parse(w.value) as { personId: number })).toMatchObject([
      { personId: ICH },
    ]);
    expect(await holeTeilen()).toBe(true);
    expect(await teiltIch()).toEqual({ enabled: true });
  });

  it('zweimal einschalten → ein Eintrag', async () => {
    await teilenSetzen(true);
    await teilenSetzen(true);
    expect(ct.werte).toHaveLength(1);
  });

  it('ausschalten: eigene Datei aus, Eintrag weg', async () => {
    await teilenSetzen(true);
    await teilenSetzen(false);
    expect(await teiltIch()).toEqual({ enabled: false });
    expect(ct.werte).toEqual([]);
  });

  it('ausschalten gilt, auch wenn der Eintrag im Verzeichnis stehen bleibt', async () => {
    await teilenSetzen(true);
    ct.datenSchreibenVerboten = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(teilenSetzen(false)).resolves.toEqual({ enabled: false });
    expect(await holeTeilen()).toBe(false);
    expect(ct.werte).toHaveLength(1);
  });

  it('einschalten ohne Recht am Verzeichnis: Meldung – und die eigene Datei bleibt unberührt', async () => {
    ct.datenSchreibenVerboten = true;
    await expect(teilenSetzen(true)).rejects.toBeInstanceOf(KeinSpeicherRecht);
    expect(ct.namen()).toEqual([]);
  });

  it('einschalten, wenn es das Verzeichnis nicht gibt (oder man es nicht sehen darf) → klare Meldung', async () => {
    ct.kategorienUnsichtbar = true;
    await expect(teilenSetzen(true)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('nicht zu finden') as unknown,
    });
    expect(ct.namen()).toEqual([]);
  });

  it('ein Erfolg, der keinen Eintrag hinterlässt, wird gemeldet – und nichts eingeschaltet', async () => {
    ct.wertSchreibenVerschwindet = true;
    await expect(teilenSetzen(true)).rejects.toMatchObject({ status: 502 });
    expect(await holeTeilen()).toBe(false);
  });
});

describe('Notizen von …', () => {
  it('listet, wer zu diesen Liedern Anmerkungen teilt – mit dem Namen aus der eigenen Datei', async () => {
    await annaTeilt();
    expect(await teilende([LIED, 8])).toEqual([{ id: ANNA, name: 'Anna Test', songs: [LIED] }]);
    expect(await teilende([8])).toEqual([]);
  });

  it('der Name kommt aus ihrer eigenen Datei – nicht aus dem Verzeichnis, das jeder ändern kann', async () => {
    await annaTeilt();
    const w = ct.werte[0];
    w.value = JSON.stringify({ ...(JSON.parse(w.value) as object), name: 'Jemand anderes' });
    expect(await teilende([LIED])).toMatchObject([{ id: ANNA, name: 'Anna Test' }]);
  });

  it('mich selbst nicht', async () => {
    await teilenSetzen(true);
    await schreibeAnmerkung(SEITE, { strokes: PNG });
    expect(await teilende([LIED])).toEqual([]);
  });

  it('ein Eintrag im Verzeichnis, den die Person nicht selbst bestätigt, bewirkt nichts', async () => {
    await annaTeilt();
    alsPerson(ANNA, 'Anna');
    await schreibeTeilen(false, 'Anna Test'); // Anna schaltet ab – ihr Eintrag bleibt stehen
    alsPerson(ICH, 'Alwin');
    expect(ct.werte).toHaveLength(1);
    expect(await teilende([LIED])).toEqual([]);
    await expect(anmerkungenVon(ANNA, [LIED])).rejects.toMatchObject({ status: 403 });
  });

  it('ihre Anmerkungen ohne Zoom, ihre Einstellungen für ihre Ansicht', async () => {
    await annaTeilt();
    const seiten = await anmerkungenVon(ANNA, [LIED]);
    expect(Object.keys(seiten)).toEqual([SEITE]);
    expect(seiten[SEITE].strokes).toBe(PNG);
    expect(seiten[SEITE].texts).toMatchObject([{ text: 'leise' }]);
    expect(seiten[SEITE]).not.toHaveProperty('zoom');
    expect(await einstellungenVon(ANNA, [LIED])).toEqual({ worship_key_7: 'A' });
  });

  it('nur Texte, keine Striche: zählt auch', async () => {
    alsPerson(ANNA, 'Anna');
    await teilenSetzen(true);
    await schreibeAnmerkung(SEITE, { texts: [{ id: 1, text: 'x', fx: 0, fy: 0 }] as never });
    alsPerson(ICH, 'Alwin');
    expect(await teilende([LIED])).toMatchObject([{ id: ANNA, songs: [LIED] }]);
  });

  it('Verzeichnis nicht zu sehen → niemand, kein Fehler', async () => {
    await annaTeilt();
    ct.kategorienUnsichtbar = true;
    expect(await teilende([LIED])).toEqual([]);
  });

  it('ein vorübergehender Fehler beim Verzeichnis WIRFT – „niemand teilt" wäre eine falsche Aussage', async () => {
    await annaTeilt();
    const kat = ct.kategorien[0].id;
    ct.liefere(`/api/custommodules/10/customdatacategories/${kat}/customdatavalues`, {}, 500);
    await expect(teilende([LIED])).rejects.toMatchObject({ status: 500 });
  });

  it('liest Annas Ablage für Liste, Anmerkungen und Einstellungen nur einmal', async () => {
    await annaTeilt();
    const vorher = ct.zaehle(`GET /api/files/person/${ANNA}`);
    await teilende([LIED]);
    await anmerkungenVon(ANNA, [LIED]);
    await einstellungenVon(ANNA, [LIED]);
    expect(ct.zaehle(`GET /api/files/person/${ANNA}`) - vorher).toBe(1);
  });
});

describe('Recht auf Team-Notizen (wie im Server)', () => {
  const MUSIKTEAM = 9;

  beforeEach(async () => {
    ct.liefere('/api/permissions/global', {
      data: { churchservice: { 'view songcategory': [1], 'view agenda': [1] } },
    });
    // Wie der Admin in der Verwaltung: Musikteam, Rolle 15 darf.
    await einstellungenSpeichern({
      ...DEFAULT_SITE_CONFIG,
      musicianGroupIds: [MUSIKTEAM],
      noteRoles: [{ groupId: MUSIKTEAM, roles: [15] }],
    });
  });

  function mitglied(roleId: number, status = 'active'): void {
    ct.liefere(`/api/persons/${ICH}/groups`, {
      data: [
        {
          group: { domainIdentifier: String(MUSIKTEAM) },
          groupTypeRoleId: roleId,
          groupMemberStatus: status,
        },
      ],
    });
  }

  it('aktives Mitglied mit freigegebener Rolle → darf', async () => {
    mitglied(15);
    expect((await meineRechte()).canUseGlobalNotes).toBe(true);
  });

  it('andere Rolle oder nicht aktiv → darf nicht', async () => {
    mitglied(16);
    expect((await meineRechte()).canUseGlobalNotes).toBe(false);
    mitglied(15, 'requested');
    expect((await meineRechte()).canUseGlobalNotes).toBe(false);
  });

  it('Mitgliedschaften nicht lesbar → vorerst aus, die übrigen Rechte bleiben', async () => {
    ct.liefere(`/api/persons/${ICH}/groups`, {}, 500);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await meineRechte();
    expect(r.canUseGlobalNotes).toBe(false);
    expect(r.canViewSongs).toBe(true);
  });

  it('Abwesenheiten bleiben bis 3b-3 aus – auch für Mitglieder', async () => {
    mitglied(15);
    expect((await meineRechte()).canUseAvailability).toBe(false);
  });
});
