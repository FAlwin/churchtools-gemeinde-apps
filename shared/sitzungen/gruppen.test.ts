import { describe, expect, it } from 'vitest';
import type { RohMitgliedschaft } from '../ct/gruppen';
import { kategorieName, sitzungsGruppen } from './gruppen';
import { kuerzelMitarbeit, kuerzelProtokolle } from './speicher';

/** Aufbau wie `GET /persons/{id}/groups` (gemessen; nur die gelesenen Felder). */
const mit = (
  id: number,
  title: string,
  extra: Partial<RohMitgliedschaft> = {},
): RohMitgliedschaft => ({
  group: { domainIdentifier: String(id), title },
  groupTypeRoleId: 8,
  groupMemberStatus: 'active',
  memberEndDate: null,
  ...extra,
});

describe('sitzungsGruppen', () => {
  it('versteckte Gruppe nur aus den Kategorien – mit Namen aus der Kategorie', () => {
    const g = sitzungsGruppen(
      [mit(19, 'Technik-Team')],
      [
        {
          id: 60,
          shorty: kuerzelProtokolle(11),
          name: kategorieName('Protokolle', 'Leitungsteam'),
        },
        { id: 61, shorty: kuerzelMitarbeit(11), name: kategorieName('Mitarbeit', 'Leitungsteam') },
        { id: 5, shorty: 'vorlagen', name: 'Vorlagen' },
      ],
    );
    expect(g).toEqual([
      { id: 11, name: 'Leitungsteam', lage: 'eingerichtet', protokolle: 60, mitarbeit: 61 },
      {
        id: 19,
        name: 'Technik-Team',
        lage: 'nicht-eingerichtet',
        protokolle: null,
        mitarbeit: null,
      },
    ]);
  });

  it('ohne Mitarbeit-Kategorie: unvollständig', () => {
    const g = sitzungsGruppen(
      [mit(7, 'Jugendleitung')],
      [{ id: 70, shorty: kuerzelProtokolle(7), name: 'Protokolle · Jugendleitung' }],
    );
    expect(g[0]).toMatchObject({ id: 7, lage: 'unvollstaendig', protokolle: 70, mitarbeit: null });
  });

  it('nimmt bei doppeltem Kürzel die kleinste ID', () => {
    const g = sitzungsGruppen(
      [],
      [
        { id: 90, shorty: kuerzelProtokolle(3), name: 'Protokolle · A' },
        { id: 80, shorty: kuerzelProtokolle(3), name: 'Protokolle · A' },
        { id: 81, shorty: kuerzelMitarbeit(3) },
      ],
    );
    expect(g[0]).toMatchObject({ protokolle: 80, mitarbeit: 81, name: 'A' });
  });

  it('lässt beendete und angefragte Mitgliedschaften weg; ohne jeden Namen ein Ersatzname', () => {
    const g = sitzungsGruppen(
      [
        mit(1, 'Alt', { memberEndDate: '2026-01-01' }),
        mit(2, 'Wartet', { groupMemberStatus: 'requested' }),
      ],
      [{ id: 50, shorty: kuerzelProtokolle(4) }],
    );
    expect(g.map((x) => [x.id, x.name])).toEqual([[4, 'Gruppe 4']]);
  });
});
