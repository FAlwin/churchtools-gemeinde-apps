import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { fehlendeNachladen, GLEICHZEITIG, ladeMitglieder } from './ladeMitglieder';

const mitglied = (personId: number, rolle = 15) => ({
  personId,
  person: { title: `Person ${personId}`, initials: 'P' },
  groupTypeRoleId: rolle,
  groupMemberStatus: 'active',
});

describe('ladeMitglieder (O2)', () => {
  it('sichtbar / verborgen (403) / fehler (anderes) – je Gruppe; Personen gesammelt', async () => {
    const d = await ladeMitglieder([1, 2, 3, 4], (pfad) => {
      if (pfad === '/groups/1/members') return Promise.resolve([mitglied(10, 16), mitglied(11)]);
      if (pfad === '/groups/2/members') return Promise.reject(new ApiError(403, 'nein'));
      if (pfad === '/groups/3/members') return Promise.reject(new ApiError(502, 'weg'));
      return Promise.resolve([]);
    });
    expect(d.je.get(1)).toEqual({
      art: 'sichtbar',
      mitglieder: [
        { personId: 10, rolleId: 16 },
        { personId: 11, rolleId: 15 },
      ],
    });
    expect(d.je.get(2)).toEqual({ art: 'verborgen' });
    // Vorübergehend ist nicht ungültig: ein 502 ist KEIN „verborgen“
    expect(d.je.get(3)).toEqual({ art: 'fehler' });
    expect(d.je.get(4)).toEqual({ art: 'sichtbar', mitglieder: [] });
    expect([...d.personen.keys()]).toEqual([10, 11]);
  });

  it('Netzfehler (kein ApiError) → fehler, nicht verborgen', async () => {
    const d = await ladeMitglieder([1], () => Promise.reject(new TypeError('Failed to fetch')));
    expect(d.je.get(1)).toEqual({ art: 'fehler' });
  });

  it('abgemeldet (401) → wirft für alle, statt jede Gruppe als Fehler zu zeigen', async () => {
    await expect(
      ladeMitglieder([1, 2], (pfad) =>
        pfad.includes('/2/') ? Promise.reject(new ApiError(401, 'ab')) : Promise.resolve([]),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it(`höchstens ${GLEICHZEITIG} Abrufe gleichzeitig`, async () => {
    let laufend = 0;
    let max = 0;
    await ladeMitglieder(
      Array.from({ length: 12 }, (_, i) => i + 1),
      async () => {
        laufend++;
        max = Math.max(max, laufend);
        await new Promise((r) => setTimeout(r, 1));
        laufend--;
        return [];
      },
    );
    expect(max).toBe(GLEICHZEITIG);
  });
});

describe('fehlendeNachladen', () => {
  it('lädt nur die gescheiterten Gruppen neu, der Rest bleibt', async () => {
    const vorher = await ladeMitglieder([1, 2, 3], (pfad) =>
      pfad.includes('/2/')
        ? Promise.reject(new ApiError(503, 'x'))
        : pfad.includes('/3/')
          ? Promise.reject(new ApiError(403, 'x'))
          : Promise.resolve([mitglied(10)]),
    );
    const gefragt: string[] = [];
    const nachher = await fehlendeNachladen(vorher, (pfad) => {
      gefragt.push(pfad);
      return Promise.resolve([mitglied(20)]);
    });
    expect(gefragt).toEqual(['/groups/2/members']);
    expect(nachher.je.get(2)).toEqual({
      art: 'sichtbar',
      mitglieder: [{ personId: 20, rolleId: 15 }],
    });
    expect(nachher.je.get(3)).toEqual({ art: 'verborgen' });
    expect([...nachher.personen.keys()].sort()).toEqual([10, 20]);
  });

  it('nichts gescheitert → kein Abruf, dieselben Daten', async () => {
    const vorher = await ladeMitglieder([1], () => Promise.resolve([]));
    let gefragt = false;
    const nachher = await fehlendeNachladen(vorher, () => {
      gefragt = true;
      return Promise.resolve([]);
    });
    expect(gefragt).toBe(false);
    expect(nachher).toBe(vorher);
  });
});
