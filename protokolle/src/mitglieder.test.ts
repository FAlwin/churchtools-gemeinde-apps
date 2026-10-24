import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { ladeGruppenMitglieder } from './mitglieder';

const roh = (personId: number, title: string, status = 'active', ende: string | null = null) => ({
  personId,
  person: { title },
  groupTypeRoleId: 1,
  groupMemberStatus: status,
  memberEndDate: ende,
});

describe('ladeGruppenMitglieder (S4-2)', () => {
  it('nur aktive Mitglieder, nach Namen sortiert, jede Person einmal', async () => {
    const r = await ladeGruppenMitglieder(194, (pfad) => {
      expect(pfad).toBe('/groups/194/members');
      return Promise.resolve([
        roh(19, 'Spike Musiker'),
        roh(1, 'Alwin Friesen'),
        roh(1, 'Alwin Friesen'),
        roh(5, 'Angefragt', 'requested'),
        roh(6, 'Ehemalig', 'active', '2026-01-01'),
      ]);
    });
    expect(r).not.toBe('verborgen');
    expect((r as { name: string }[]).map((p) => p.name)).toEqual([
      'Alwin Friesen',
      'Spike Musiker',
    ]);
  });

  it('403 → „verborgen“; alles andere wird geworfen (vorübergehend ist nicht leer)', async () => {
    expect(
      await ladeGruppenMitglieder(1, () => Promise.reject(new ApiError(403, 'verboten'))),
    ).toBe('verborgen');
    await expect(
      ladeGruppenMitglieder(1, () => Promise.reject(new ApiError(503, 'weg'))),
    ).rejects.toThrow('weg');
  });
});
