import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ladeGruppenRechte, mitgliedZugriff as z } from './mitgliedschaft';

vi.mock('@ui/ct/verbindung', () => ({ ctAnfrage: vi.fn(), ctDaten: vi.fn() }));
const anfrage = vi.mocked(ctAnfrage);
const daten = vi.mocked(ctDaten);

beforeEach(() => {
  anfrage.mockReset();
  daten.mockReset();
});

describe('mitgliedZugriff (O6) – wie an der Test-Instanz gemessen', () => {
  it('lesen: Rolle, Status, Ende; 404 = nicht in der Gruppe; vorübergehend wirft weiter', async () => {
    daten.mockResolvedValueOnce({
      groupTypeRoleId: 16,
      groupMemberStatus: 'active',
      memberEndDate: null,
    });
    expect(await z.lesen(210, 66)).toEqual({ rolleId: 16, status: 'active', ende: null });
    expect(daten).toHaveBeenCalledWith('/groups/210/members/66');
    daten.mockResolvedValueOnce({
      groupTypeRoleId: 16,
      groupMemberStatus: 'active',
      memberEndDate: '2026-10-23',
    });
    expect((await z.lesen(210, 66))?.ende).toBe('2026-10-23');
    daten.mockRejectedValueOnce(new ApiError(404, 'weg'));
    expect(await z.lesen(210, 66)).toBeNull();
    daten.mockRejectedValueOnce(new ApiError(503, 'antwortet nicht'));
    await expect(z.lesen(210, 66)).rejects.toMatchObject({ status: 503 });
  });

  it('schreiben = PUT mit genau den Feldern; entfernen = DELETE', async () => {
    anfrage.mockResolvedValue(null);
    await z.schreiben(210, 66, { memberEndDate: '2026-10-23' });
    const [pfad, init] = anfrage.mock.calls[0];
    expect(pfad).toBe('/groups/210/members/66');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ memberEndDate: '2026-10-23' });
    await z.entfernen(210, 66);
    expect(anfrage.mock.calls[1][1]?.method).toBe('DELETE');
  });

  it('Rechte je Gruppe aus /permissions/internal/groups/{id}', async () => {
    daten.mockResolvedValue({
      churchdb: {
        '+add person': true,
        '+edit group memberships': true,
        '+remove from group': false,
      },
    });
    expect(await ladeGruppenRechte(9)).toEqual({
      aufnehmen: true,
      rolleAendern: true,
      beenden: false,
    });
    expect(daten).toHaveBeenCalledWith('/permissions/internal/groups/9');
  });
});
