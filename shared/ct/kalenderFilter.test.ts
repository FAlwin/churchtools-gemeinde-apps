import { describe, expect, it } from 'vitest';
import {
  kalenderIdsAus,
  kalenderSichtbar,
  kalenderZumFiltern,
  terminKalenderAus,
} from './kalenderFilter';

describe('Kalender-Filter – gemeinsame Regeln (Wunsch 6)', () => {
  it('terminKalenderAus: ID und Name vom Termin; ohne Namen die Nummer; ohne ID null', () => {
    expect(
      terminKalenderAus({ calendar: { domainIdentifier: '2', title: 'Gemeindeveranstaltungen' } }),
    ).toEqual({ id: 2, name: 'Gemeindeveranstaltungen' });
    expect(terminKalenderAus({ calendar: { domainIdentifier: '7', title: '  ' } })).toEqual({
      id: 7,
      name: 'Kalender 7',
    });
    expect(terminKalenderAus({ calendar: { title: 'ohne ID' } })).toBeNull();
    expect(terminKalenderAus({})).toBeNull();
  });

  it('kalenderSichtbar: ausgeblendet = weg; ohne bekannten Kalender immer sichtbar', () => {
    expect(kalenderSichtbar(2, [2])).toBe(false);
    expect(kalenderSichtbar(3, [2])).toBe(true);
    expect(kalenderSichtbar(null, [2])).toBe(true);
    expect(kalenderSichtbar(undefined, [2])).toBe(true);
  });

  it('kalenderZumFiltern: ausgeblendete bleiben wählbar, nach Namen sortiert, ohne Namen die Nummer', () => {
    const namen = new Map([
      [1, 'Gottesdienste'],
      [2, 'Gemeindeveranstaltungen'],
    ]);
    expect(kalenderZumFiltern([1, 2, 1], (id) => namen.get(id), [9])).toEqual([
      { id: 2, name: 'Gemeindeveranstaltungen' },
      { id: 1, name: 'Gottesdienste' },
      { id: 9, name: 'Kalender 9' },
    ]);
  });

  it('kalenderIdsAus: nur ganze Zahlen über 0, ohne Doppelte', () => {
    expect(kalenderIdsAus([12, '2', 12, 0, 2.5, -1, 3])).toEqual([12, 3]);
    expect(kalenderIdsAus('12')).toEqual([]);
  });
});
