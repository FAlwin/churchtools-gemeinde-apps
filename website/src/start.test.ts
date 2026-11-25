import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ladeIch } from '@ui/ct/ich';
import { modulId } from '@ui/ct/modulPort';
import { kategorienLesen } from '@shared/ct/modulDaten';
import { ctDaten } from '@ui/ct/verbindung';
import { kategorienFuer } from '@shared/website/einrichten';
import { WEBSITE_LEITUNG, WEBSITE_REDAKTEUR } from '@shared/website/zugang';
import { ladeStart } from './start';

vi.mock('@ui/ct/ich', () => ({ ladeIch: vi.fn() }));
vi.mock('@ui/ct/modulPort', () => ({
  modulId: vi.fn(),
  modulPort: { kuerzel: () => 'website' },
}));
vi.mock('@shared/ct/modulDaten', async (original) => ({
  ...(await original<typeof import('@shared/ct/modulDaten')>()),
  kategorienLesen: vi.fn(),
}));
vi.mock('@ui/ct/verbindung', () => ({ ctDaten: vi.fn() }));

const ich = vi.mocked(ladeIch);
const modul = vi.mocked(modulId);
const kategorien = vi.mocked(kategorienLesen);
const daten = vi.mocked(ctDaten);

const GRUPPE = 7;
/** Die Kategorien, wie „Einrichten“ sie anlegt (Kürzel aus der Regel, nicht abgeschrieben). */
const beide = kategorienFuer(GRUPPE, 'Website').map((k, i) => ({
  id: 20 + i,
  shorty: k.kuerzel,
  name: k.name,
}));

const ROLLEN = [
  { id: 2, isLeader: true },
  { id: 3, isLeader: false },
];
const inGruppe = (gruppe: number, rolle: number) => [
  {
    group: { domainIdentifier: String(gruppe), title: 'Website' },
    groupTypeRoleId: rolle,
    groupMemberStatus: 'active',
    memberEndDate: null,
  },
];
const ADMIN = { churchdb: { 'administer groups': true } };

function alsPerson(mitgliedschaften: unknown[], rechte: unknown) {
  ich.mockResolvedValue({
    id: 1,
    vorname: 'Helene',
    gemeinde: 'ECG',
    rollen: ROLLEN,
    mitgliedschaften,
  } as never);
  // `/permissions/global` → die Rechte; `/groups/hierarchies` (W3b-4b) → keine Untergruppen, wenn der Test nichts anderes sagt.
  daten.mockImplementation((pfad: string) =>
    Promise.resolve(pfad === '/groups/hierarchies' ? hierarchie : rechte),
  );
}
let hierarchie: unknown[] = [];

beforeEach(() => {
  hierarchie = [];
  modul.mockResolvedValue(26);
  kategorien.mockResolvedValue(beide);
  alsPerson([], {});
});

describe('ladeStart', () => {
  it('sucht das Modul unter dem Namen der Website und liest dessen Kategorien und die globalen Rechte', async () => {
    await ladeStart();
    expect(modul).toHaveBeenCalledWith('Die Erweiterung „Website“');
    expect(kategorien).toHaveBeenCalledWith(expect.anything(), 26);
    expect(daten).toHaveBeenCalledWith('/permissions/global');
  });

  it('der Name für „Gerade bearbeitet von …“ ist Vor- und Nachname (ohne Nachnamen nur der Vorname)', async () => {
    ich.mockResolvedValue({
      id: 1,
      vorname: 'Helene',
      nachname: 'Wiebe',
      gemeinde: 'ECG',
      rollen: [],
      mitgliedschaften: [],
    });
    expect((await ladeStart()).name).toBe('Helene Wiebe');
    ich.mockResolvedValue({
      id: 1,
      vorname: 'Helene',
      gemeinde: 'ECG',
      rollen: [],
      mitgliedschaften: [],
    });
    expect((await ladeStart()).name).toBe('Helene');
  });

  it('eingerichtet: Gruppe, Namen und beide Kategorien kommen aus den Kürzeln', async () => {
    const s = await ladeStart();
    expect(s.einrichtung).toEqual({
      gruppe: GRUPPE,
      name: 'Website',
      entwuerfe: 20,
      veroeffentlicht: 21,
    });
    expect(s.stand).toBe('fertig');
  });
});

/** Der Block des Moduls in `/permissions/global` – Schreiben (anlegen, ändern, löschen) in diesen Kategorien. */
const schreibt = (...ids: number[]) => ({
  website: {
    'view custom data': ids,
    'create custom data': ids,
    'edit custom data': ids,
    'delete custom data': ids,
  },
});
const [ENTWUERFE, VEROEFFENTLICHT] = [20, 21];

describe('Zugang: aus den EIGENEN Rechten (W3b-1), nicht daraus, ob man die Gruppe leitet', () => {
  it('Admin → Zugang „admin“', async () => {
    alsPerson([], ADMIN);
    expect(await ladeStart()).toMatchObject({ admin: true, zugang: WEBSITE_LEITUNG });
  });

  it('Rechte an Entwürfe UND Veröffentlicht → „leitung“ – auch ohne Mitglied der Gruppe zu sein', async () => {
    alsPerson([], schreibt(ENTWUERFE, VEROEFFENTLICHT));
    expect(await ladeStart()).toMatchObject({ admin: false, zugang: WEBSITE_LEITUNG });
  });

  it('Rechte nur an Entwürfe → „redakteur“', async () => {
    alsPerson(inGruppe(GRUPPE, 3), schreibt(ENTWUERFE));
    expect(await ladeStart()).toMatchObject({ zugang: WEBSITE_REDAKTEUR });
  });

  it('Rechte nur an FREMDE Kategorien → kein Zugang', async () => {
    alsPerson(inGruppe(GRUPPE, 3), schreibt(999, 1000));
    expect(await ladeStart()).toMatchObject({ zugang: null });
  });

  it('leitet die Gruppe, hat aber keine Rechte → kein Zugang, aber der Hinweis „noch nicht eingerichtet“', async () => {
    alsPerson(inGruppe(GRUPPE, 2), {});
    expect(await ladeStart()).toMatchObject({ zugang: null, leitungOhneRechte: true });
  });

  it('Mitarbeiter ohne Rechte → kein Zugang, kein Hinweis auf fehlende Rechte', async () => {
    alsPerson(inGruppe(GRUPPE, 3), {});
    expect(await ladeStart()).toMatchObject({ zugang: null, leitungOhneRechte: false });
  });

  it('Leitung einer ANDEREN Gruppe ohne Rechte → kein Zugang, kein Hinweis', async () => {
    alsPerson(inGruppe(99, 2), {});
    expect(await ladeStart()).toMatchObject({ zugang: null, leitungOhneRechte: false });
  });

  it('weder Admin noch in einer Gruppe → kein Zugang', async () => {
    expect(await ladeStart()).toMatchObject({ admin: false, zugang: null });
  });

  it('Rechte setzen darf, wer „Personen administrieren“ hat (nicht schon der Admin für Gruppen)', async () => {
    alsPerson([], ADMIN);
    expect((await ladeStart()).darfRechteSetzen).toBe(false);
    alsPerson([], { ...ADMIN, churchcore: { 'administer persons': true } });
    expect((await ladeStart()).darfRechteSetzen).toBe(true);
  });

  it('nicht eingerichtet: nur der Admin darf einrichten, alle anderen sehen den Hinweis', async () => {
    kategorien.mockResolvedValue([]);
    alsPerson([], ADMIN);
    expect(await ladeStart()).toMatchObject({
      einrichtung: null,
      stand: 'einrichten',
      zugang: WEBSITE_LEITUNG,
    });
    alsPerson(inGruppe(GRUPPE, 2), schreibt(ENTWUERFE, VEROEFFENTLICHT));
    expect(await ladeStart()).toMatchObject({ einrichtung: null, stand: 'fehlt', zugang: null });
  });
});

describe('vorübergehende Fehler werden geworfen, nicht zu „nicht eingerichtet“ gemacht', () => {
  it('Kategorien nicht lesbar → Fehler', async () => {
    kategorien.mockRejectedValue(new Error('502'));
    await expect(ladeStart()).rejects.toThrow('502');
  });

  it('Rechte nicht lesbar → Fehler (nicht „kein Admin“)', async () => {
    daten.mockRejectedValue(new Error('504'));
    await expect(ladeStart()).rejects.toThrow('504');
  });

  it('Modul nicht lesbar → Fehler', async () => {
    modul.mockRejectedValue(new Error('503'));
    await expect(ladeStart()).rejects.toThrow('503');
  });
});

describe('Bereiche (W3b-4b): Untergruppen aus Hierarchie + Kategorien, Bereich aus den eigenen Mitgliedschaften', () => {
  // Realistisch und verschieden: Website = Gruppe 7 (Kategorien 20/21), Jugend = Gruppe 347 (Kategorie 117), Technik = 348
  // (nicht eingerichtet), Band = 349 (Enkel). Rollen-IDs an den Mitgliedern 15/16 – nicht die group_role-IDs.
  const JUGEND = 347;
  const MIT_JUGEND = [
    ...beide,
    {
      id: 117,
      shorty: `veroeffentlicht-g${JUGEND}`,
      name: 'Website: Veröffentlicht · Website – Jugend',
    },
  ];
  const HIERARCHIE = [
    { groupId: GRUPPE, parents: [], children: [JUGEND, 348] },
    { groupId: JUGEND, parents: [GRUPPE], children: [349] },
  ];
  const mitgliedIn = (gruppe: number, title: string, rolle = 15) => ({
    group: { domainIdentifier: String(gruppe), title },
    groupTypeRoleId: rolle,
    groupMemberStatus: 'active',
    memberEndDate: null,
  });
  beforeEach(() => {
    kategorien.mockResolvedValue(MIT_JUGEND);
    hierarchie = HIERARCHIE;
  });

  it('eingerichtete Untergruppen: nur direkte Kinder mit Kategorie – Name aus der Kategorie (kein Admin, keine Leitung)', async () => {
    alsPerson([mitgliedIn(JUGEND, 'Website – Jugend')], schreibt(ENTWUERFE));
    expect((await ladeStart()).untergruppen).toEqual([
      { gruppe: JUGEND, kategorie: 117, name: 'Website – Jugend' },
    ]);
  });

  it('Redakteur NUR in der Untergruppe → sieht nur Jugend', async () => {
    alsPerson([mitgliedIn(JUGEND, 'Website – Jugend')], schreibt(ENTWUERFE));
    expect((await ladeStart()).zugang).toEqual({ sieht: [JUGEND], leitet: [] });
  });

  it('Redakteur in Website UND Untergruppe → die Website geht vor', async () => {
    alsPerson(
      [mitgliedIn(JUGEND, 'Website – Jugend'), mitgliedIn(GRUPPE, 'Website')],
      schreibt(ENTWUERFE),
    );
    expect((await ladeStart()).zugang).toEqual(WEBSITE_REDAKTEUR);
  });

  it('Leitung der Untergruppe (schreibt Entwürfe + 117) → leitet Jugend', async () => {
    alsPerson([mitgliedIn(JUGEND, 'Website – Jugend', 16)], schreibt(ENTWUERFE, 117));
    expect((await ladeStart()).zugang).toEqual({ sieht: [JUGEND], leitet: [JUGEND] });
  });

  it('Redakteur in keiner Gruppe → Zugang ohne Bereich (die App zeigt den Hinweis)', async () => {
    alsPerson([], schreibt(ENTWUERFE));
    expect((await ladeStart()).zugang).toEqual({ sieht: [], leitet: [] });
  });

  it('Leitung der Website: Namen frisch aus der Gruppe (wie „Wer darf was“); scheitert das, bleibt der aus der Kategorie', async () => {
    alsPerson([], schreibt(ENTWUERFE, VEROEFFENTLICHT));
    const rechte = schreibt(ENTWUERFE, VEROEFFENTLICHT);
    daten.mockImplementation((pfad: string) =>
      Promise.resolve(
        pfad === '/groups/hierarchies'
          ? HIERARCHIE
          : pfad === `/groups/${JUGEND}`
            ? { id: JUGEND, name: 'Jugend (neu benannt)' }
            : rechte,
      ),
    );
    expect((await ladeStart()).untergruppen?.[0].name).toBe('Jugend (neu benannt)');
    daten.mockImplementation((pfad: string) =>
      pfad === `/groups/${JUGEND}`
        ? Promise.reject(new Error('403'))
        : Promise.resolve(pfad === '/groups/hierarchies' ? HIERARCHIE : rechte),
    );
    expect((await ladeStart()).untergruppen?.[0].name).toBe('Website – Jugend');
  });

  it('Lesefehler der Mitgliedschaften → Fehler (nie „kein Bereich“ geraten)', async () => {
    alsPerson([mitgliedIn(JUGEND, 'Website – Jugend')], schreibt(ENTWUERFE));
    ich.mockRejectedValue(new Error('502 Gruppen'));
    await expect(ladeStart()).rejects.toThrow('502 Gruppen');
  });

  it('Lesefehler der Hierarchie → Fehler (nie „keine Untergruppen“)', async () => {
    alsPerson([mitgliedIn(JUGEND, 'Website – Jugend')], schreibt(ENTWUERFE));
    daten.mockImplementation((pfad: string) =>
      pfad === '/groups/hierarchies'
        ? Promise.reject(new Error('504 Hierarchie'))
        : Promise.resolve(schreibt(ENTWUERFE)),
    );
    await expect(ladeStart()).rejects.toThrow('504 Hierarchie');
  });
});
