import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ladeIch } from '@ui/ct/ich';
import { modulId } from '@ui/ct/modulPort';
import { kategorienLesen } from '@shared/ct/modulDaten';
import { ctDaten } from '@ui/ct/verbindung';
import { kategorienFuer } from '@shared/website/einrichten';
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
  daten.mockResolvedValue(rechte);
}

beforeEach(() => {
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

describe('Zugang: nur Admins und die Leitung der gewählten Gruppe', () => {
  it('Admin → Zugang „admin“', async () => {
    alsPerson([], ADMIN);
    expect(await ladeStart()).toMatchObject({ admin: true, zugang: 'admin' });
  });

  it('Leitung der Website-Gruppe (kein Admin) → Zugang „leitung“', async () => {
    alsPerson(inGruppe(GRUPPE, 2), {});
    expect(await ladeStart()).toMatchObject({ admin: false, zugang: 'leitung' });
  });

  it('Mitarbeiter der Website-Gruppe → kein Zugang', async () => {
    alsPerson(inGruppe(GRUPPE, 3), {});
    expect(await ladeStart()).toMatchObject({ zugang: null });
  });

  it('Leitung einer ANDEREN Gruppe → kein Zugang', async () => {
    alsPerson(inGruppe(99, 2), {});
    expect(await ladeStart()).toMatchObject({ zugang: null });
  });

  it('weder Admin noch in einer Gruppe → kein Zugang', async () => {
    expect(await ladeStart()).toMatchObject({ admin: false, zugang: null });
  });

  it('nicht eingerichtet: nur der Admin darf einrichten, alle anderen sehen den Hinweis', async () => {
    kategorien.mockResolvedValue([]);
    alsPerson([], ADMIN);
    expect(await ladeStart()).toMatchObject({
      einrichtung: null,
      stand: 'einrichten',
      zugang: 'admin',
    });
    alsPerson(inGruppe(GRUPPE, 2), {});
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
