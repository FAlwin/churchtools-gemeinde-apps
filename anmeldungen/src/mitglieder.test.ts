import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { VERLAUF_MAX, ladeMitglieder } from './mitglieder';

/** Mitglieder laden (A7-1): ohne Leitung, Verlauf, Gruppenfelder, Personen in Paketen – Rechte einzeln. */
vi.mock('@ui/ct/verbindung', () => ({ ctAlleSeiten: vi.fn(), ctDaten: vi.fn() }));
vi.mock('./einrichten', () => ({ leitungsRollen: vi.fn().mockResolvedValue(new Set([35])) }));
const ct = vi.mocked(V);

const mitglied = (personId: number, status: string, rolle = 32) => ({
  personId,
  person: { title: `Person ${personId}` },
  groupTypeRoleId: rolle,
  groupMemberStatus: status,
  memberStartDate: '2026-10-19',
  fields: [{ id: 531, value: '96' }],
});
const VERLAUF = [
  {
    memberId: 9,
    previous: { membershipStatus: 'active', fields: { Fotos: 'Nein' } },
    current: { membershipStatus: null, fields: null },
    meta: { createdDate: '2026-10-18T10:00:00Z', createdPerson: { id: 9 } },
  },
  {
    memberId: 2,
    previous: { membershipStatus: null },
    current: { membershipStatus: 'waiting' },
    meta: { createdDate: '2026-10-17T10:00:00Z', createdPerson: { id: 2 } },
  },
];
const FELDER = [
  {
    type: 'group',
    field: { id: 531, name: 'Fotos', fieldTypeCode: 'select', options: [{ id: 96, name: 'Nein' }] },
  },
];

/** Antwortet je Pfad – wie ChurchTools. `fehler`: Pfad-Anfang → Fehler. */
function antworten(fehler: Record<string, ApiError> = {}, verlauf: unknown[] = VERLAUF) {
  ct.ctDaten.mockImplementation(async (pfad: string) => {
    for (const [p, x] of Object.entries(fehler)) if (pfad.startsWith(p)) throw x;
    if (pfad.includes('/members/history')) return verlauf;
    if (pfad.includes('/memberfields')) return FELDER;
    if (pfad.startsWith('/persons'))
      return [...pfad.matchAll(/ids\[\]=(\d+)/g)].map(([, id]) => ({
        id: Number(id),
        firstName: 'Vor',
        lastName: id,
        email: `p${id}@example.org`,
        birthday: '2018-05-01',
      }));
    throw new Error(`unerwartet: ${pfad}`);
  });
}

beforeEach(() => {
  ct.ctAlleSeiten.mockReset();
  ct.ctDaten.mockReset();
});

describe('ladeMitglieder', () => {
  it('ohne Leitung; Auswahl als Text; Anmeldetag aus dem Verlauf; Absage mit Namen', async () => {
    ct.ctAlleSeiten.mockResolvedValue([mitglied(1, 'active', 35), mitglied(2, 'active')]);
    antworten();
    const st = await ladeMitglieder(165);
    expect(st?.mitglieder.map((m) => [m.personId, m.werte[531], m.angemeldetAm, m.email])).toEqual([
      [2, 'Nein', '2026-10-17', 'p2@example.org'],
    ]);
    expect(st?.absagen.map((a) => [a.personId, a.name, a.selbst, a.werte[531]])).toEqual([
      [9, 'Vor 9', true, 'Nein'],
    ]);
    expect(String(ct.ctDaten.mock.calls.find(([p]) => p.includes('history'))![0])).toMatch(
      `limit=${VERLAUF_MAX}`,
    );
    expect(st?.verlaufGekuerzt).toBe(false);
  });

  it('Personen in Paketen zu 50', async () => {
    ct.ctAlleSeiten.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => mitglied(i + 100, 'active')),
    );
    antworten({}, []);
    await ladeMitglieder(165);
    const personen = ct.ctDaten.mock.calls.filter(([p]) => p.startsWith('/persons'));
    expect(personen).toHaveLength(2);
    expect(String(personen[0][0])).toMatch(/&limit=50$/);
  });

  it('Mitglieder nicht lesbar (403) → null; vorübergehend → wirft', async () => {
    ct.ctAlleSeiten.mockRejectedValueOnce(new ApiError(403, 'nein'));
    expect(await ladeMitglieder(165)).toBeNull();
    ct.ctAlleSeiten.mockRejectedValueOnce(new ApiError(502, 'weg'));
    await expect(ladeMitglieder(165)).rejects.toThrow();
  });

  it('Verlauf oder Personen nicht lesbar (403) → ohne Absagen bzw. E-Mail; 502 dort → wirft', async () => {
    ct.ctAlleSeiten.mockResolvedValue([mitglied(2, 'active')]);
    antworten({ '/groups/165/members/history': new ApiError(403, 'nein') });
    const ohneVerlauf = await ladeMitglieder(165);
    expect([ohneVerlauf?.absagen, ohneVerlauf?.mitglieder[0].angemeldetAm]).toEqual([
      [],
      '2026-10-19',
    ]);
    antworten({ '/persons': new ApiError(403, 'nein') });
    expect((await ladeMitglieder(165))?.mitglieder[0].email).toBeNull();
    antworten({ '/groups/165/members/history': new ApiError(502, 'weg') });
    await expect(ladeMitglieder(165)).rejects.toThrow();
    antworten({ '/persons': new ApiError(504, 'weg') });
    await expect(ladeMitglieder(165)).rejects.toThrow();
  });

  it('Verlauf genau so lang wie die Grenze → gekürzt', async () => {
    ct.ctAlleSeiten.mockResolvedValue([]);
    antworten(
      {},
      Array.from({ length: VERLAUF_MAX }, () => ({})),
    );
    expect((await ladeMitglieder(165))?.verlaufGekuerzt).toBe(true);
  });
});
