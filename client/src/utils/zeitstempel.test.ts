import { describe, expect, it } from 'vitest';
import { standKurz } from './zeitstempel';
import { ortszeitAus } from '@shared/ct/zeit';

/**
 * Der „Stand" eines Offline-Vorrats (#410): Terminliste und „Mehr" formatierten ihn getrennt und
 * waren schon auseinandergelaufen (mit/ohne Jahr). Jetzt gilt die Regel der ganzen App: das Jahr nur,
 * wenn es nicht das laufende ist.
 */
describe('standKurz', () => {
  const heute = new Date(2026, 8, 23, 12, 0);

  it('lässt im laufenden Jahr das Jahr weg', () => {
    expect(standKurz(new Date(2026, 8, 21, 9, 5).getTime(), heute)).toBe('21.09., 09:05');
  });

  it('nennt das Jahr, wenn es nicht das laufende ist', () => {
    expect(standKurz(new Date(2025, 11, 31, 23, 59).getTime(), heute)).toBe('31.12.2025, 23:59');
  });
});

describe('standKurz in der Uhr der Gemeinde (#847)', () => {
  it('rechnet mit der Zone, nicht mit dem Gerät', () => {
    const ms = Date.parse('2026-09-21T09:05:00Z');
    expect(standKurz(ms, new Date('2026-09-23T12:00:00Z'), 'Pacific/Kiritimati')).toBe(
      '21.09., 23:05',
    );
    expect(standKurz(ms, new Date('2026-09-23T12:00:00Z'), 'Europe/Berlin')).toBe('21.09., 11:05');
  });

  it('das laufende Jahr ist das der Gemeinde', () => {
    // Silvester 12 Uhr UTC ist in UTC+14 schon 2027 – ein Stand vom 01.01.2027 steht dann ohne Jahr da.
    const ms = Date.parse('2026-12-31T11:00:00Z');
    expect(ortszeitAus('2026-12-31T11:00:00Z', 'Pacific/Kiritimati').slice(0, 4)).toBe('2027');
    expect(standKurz(ms, new Date('2026-12-31T12:00:00Z'), 'Pacific/Kiritimati')).toBe(
      '01.01., 01:00',
    );
  });
});
