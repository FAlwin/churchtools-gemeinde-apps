import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ladeIch } from '@ui/ct/ich';
import { modulId } from '@ui/ct/modulPort';
import { kategorienLesen } from '@shared/ct/modulDaten';
import { ladeStart } from './start';

vi.mock('@ui/ct/ich', () => ({ ladeIch: vi.fn() }));
vi.mock('@ui/ct/modulPort', () => ({ modulId: vi.fn(), modulPort: {} }));
vi.mock('@shared/ct/modulDaten', () => ({ kategorienLesen: vi.fn() }));

const ich = vi.mocked(ladeIch);
const modul = vi.mocked(modulId);
const kategorien = vi.mocked(kategorienLesen);

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
      [19, 'Technik-Team', 'nicht-eingerichtet'],
    ]);
  });

  it('wirft, wenn die Kategorien nicht lesbar sind – keine leere Liste', async () => {
    kategorien.mockRejectedValue(new Error('502'));
    await expect(ladeStart()).rejects.toThrow('502');
  });
});
