import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ladeIch } from '@ui/ct/ich';
import { modulId } from '@ui/ct/modulPort';
import { kategorienLesen } from '@shared/ct/modulDaten';
import { ctDaten } from '@ui/ct/verbindung';
import { ladeStart } from './start';

vi.mock('@ui/ct/ich', () => ({ ladeIch: vi.fn() }));
vi.mock('@ui/ct/modulPort', () => ({
  modulId: vi.fn(),
  modulPort: { kuerzel: () => 'protokolle' },
}));
vi.mock('@shared/ct/modulDaten', () => ({ kategorienLesen: vi.fn() }));
vi.mock('@ui/ct/verbindung', () => ({ ctDaten: vi.fn() }));

const ich = vi.mocked(ladeIch);
const modul = vi.mocked(modulId);
const kategorien = vi.mocked(kategorienLesen);
const daten = vi.mocked(ctDaten);

beforeEach(() => {
  ich.mockResolvedValue({
    id: 1,
    vorname: 'Alwin',
    gemeinde: 'ECG',
    rollen: [],
    mitgliedschaften: [
      {
        group: { domainIdentifier: '19', title: 'Technik-Team' },
        groupTypeRoleId: 9,
        groupMemberStatus: 'active',
        memberEndDate: null,
      },
    ],
  });
  modul.mockResolvedValue(20);
  daten.mockResolvedValue({ churchcore: { 'administer persons': false } });
  kategorien.mockResolvedValue([
    { id: 60, shorty: 'protokolle-g11', name: 'Protokolle · Leitungsteam' },
  ]);
});

describe('ladeStart', () => {
  it('sucht das eigene Modul unter dem Namen der Protokolle und liest dessen Kategorien', async () => {
    const s = await ladeStart();
    expect(modul).toHaveBeenCalledWith('Die Erweiterung „Protokolle“');
    expect(kategorien).toHaveBeenCalledWith(expect.anything(), 20);
    expect(s.gruppen.map((g) => [g.id, g.name, g.lage])).toEqual([
      [11, 'Leitungsteam', 'unvollstaendig'],
    ]); // Technik-Team (nur Mitgliedschaft, keine sichtbaren Protokolle) steht nicht in der Liste
    expect(s.darfVerwalten).toBe(false);
  });

  it('Admin (Rechte vergeben): darf verwalten – gelesen aus den globalen Rechten', async () => {
    daten.mockResolvedValue({ churchcore: { 'administer persons': true } });
    expect((await ladeStart()).darfVerwalten).toBe(true);
    expect(daten).toHaveBeenCalledWith('/permissions/global');
  });

  it('schreibbar (S4-1): nur Kategorien mit anlegen, ändern UND löschen – unter dem Kürzel der Erweiterung', async () => {
    daten.mockResolvedValue({
      churchcore: {},
      protokolle: {
        'view custom data': [60, 61, 70],
        'create custom data': [60, 61, 70],
        'edit custom data': [60, 61],
        'delete custom data': [60],
      },
      andereerweiterung: {
        'create custom data': [99],
        'edit custom data': [99],
        'delete custom data': [99],
      },
    });
    expect((await ladeStart()).schreibbar).toEqual([60]);
    daten.mockResolvedValue({ churchcore: {} });
    expect((await ladeStart()).schreibbar).toEqual([]);
  });

  it('wirft, wenn die Kategorien nicht lesbar sind – keine leere Liste', async () => {
    kategorien.mockRejectedValue(new Error('502'));
    await expect(ladeStart()).rejects.toThrow('502');
  });
});
