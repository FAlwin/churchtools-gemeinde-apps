import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { ladeNachpruefung } from './nachpruefung';

/** Nachprüfung laden (A6-5c, #623): Mitglieder ohne Leitung, Geburtstage nur, wenn Preise sie brauchen. */
vi.mock('@ui/ct/verbindung', () => ({ ctAlleSeiten: vi.fn(), ctDaten: vi.fn() }));
vi.mock('./einrichten', () => ({ leitungsRollen: vi.fn().mockResolvedValue(new Set([35])) }));
const ct = vi.mocked(V);

function einstellungen() {
  const e = neueEinstellungen('kinder');
  e.preis.grundpreis = { ...e.preis.grundpreis, art: 'fest', betragCent: 1500, gilt: 'person' };
  e.ctFelder = { ...e.ctFelder, nr: 700, betrag: 701, kontakt: 702 };
  return e;
}
const mitglied = (
  personId: number,
  status: string,
  rolle = 32,
  felder: [number, string][] = [],
) => ({
  personId,
  person: { title: `Person ${personId}` },
  groupTypeRoleId: rolle,
  groupMemberStatus: status,
  memberStartDate: '2026-10-17',
  fields: felder.map(([id, value]) => ({ id, value })),
});

beforeEach(() => {
  ct.ctAlleSeiten.mockReset();
  ct.ctDaten.mockReset();
});

describe('ladeNachpruefung', () => {
  it('Leitung zählt nicht; Felder nach ctFelder; Betrag geprüft', async () => {
    ct.ctAlleSeiten.mockResolvedValue([
      mitglied(1, 'active', 35),
      mitglied(2, 'active', 32, [
        [700, 'AAAAAA'],
        [701, '15,00 €'],
        [702, 'Erna'],
      ]),
      mitglied(3, 'waiting', 32, [[700, 'BBBBBB']]),
    ]);
    const n = await ladeNachpruefung(91, einstellungen(), 10);
    expect(n?.plaetze).toEqual({ belegt: 1, wartend: 1, max: 10, wartenTrotzPlatz: true });
    expect([n?.geprueft, n?.betraege]).toEqual([1, []]);
    // Ohne Preise nach Alter keine Personen-Abfrage.
    expect(ct.ctDaten).not.toHaveBeenCalled();
  });

  it('Preise nach Alter → Geburtstage in Paketen zu 50', async () => {
    const e = einstellungen();
    e.preis.alter = [{ von: 0, bis: 5, art: 'frei', wert: 0 }];
    ct.ctAlleSeiten.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => mitglied(i + 1, 'active')),
    );
    ct.ctDaten.mockResolvedValue([]);
    await ladeNachpruefung(91, e, null);
    expect(ct.ctDaten).toHaveBeenCalledTimes(2);
    expect(String(ct.ctDaten.mock.calls[0][0])).toMatch(/^\/persons\?ids\[\]=1&.*&limit=50$/);
  });

  it('Mitglieder nicht lesbar (403) → null; vorübergehend → wirft', async () => {
    ct.ctAlleSeiten.mockRejectedValueOnce(new ApiError(403, 'nein'));
    expect(await ladeNachpruefung(91, einstellungen(), 10)).toBeNull();
    ct.ctAlleSeiten.mockRejectedValueOnce(new ApiError(502, 'weg'));
    await expect(ladeNachpruefung(91, einstellungen(), 10)).rejects.toThrow();
  });
});
