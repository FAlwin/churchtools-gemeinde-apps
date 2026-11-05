import { describe, expect, it } from 'vitest';
import { mapEventToService } from './mapEvent';

describe('mapEventToService – Monat der Terminkarte', () => {
  // Kurzform aus `datum.ts` (bis 14.10.2026 eine eigene Liste hier) – die Anzeige bleibt „Mär“, „Okt“ …
  const KURZ = 'Jan Feb Mär Apr Mai Jun Jul Aug Sep Okt Nov Dez'.split(' ');
  it('alle zwölf Monate, in der Zeitzone der Gemeinde', () => {
    for (let m = 0; m < 12; m++) {
      const start = `2027-${String(m + 1).padStart(2, '0')}-15T09:00:00Z`;
      const s = mapEventToService(
        { id: m, name: 'GD', startDate: start, endDate: start },
        0,
        null,
        'Europe/Berlin',
      );
      expect(s.month).toBe(KURZ[m]);
    }
  });

  it('Monatswechsel nach Ortszeit: 31.10. 23:30 UTC ist in Berlin schon November', () => {
    const s = mapEventToService(
      { id: 1, name: 'GD', startDate: '2026-10-31T23:30:00Z', endDate: '2026-10-31T23:59:00Z' },
      0,
      null,
      'Europe/Berlin',
    );
    expect(s.month).toBe('Nov');
  });
});

/**
 * #847: Tag, Monat, Wochentag und Uhrzeit standen fest auf Berlin, nur `date` folgte der Zone (halb umgesetzte Regel).
 * Geprüft mit UTC+14 – mit fest Berlin käme hier „00:30 Uhr“.
 */
describe('mapEventToService – alles in der Zone der Gemeinde (#847)', () => {
  it('Tag, Monat, Wochentag, Uhrzeit und Datum aus derselben Zone', () => {
    const s = mapEventToService(
      { id: 1, name: 'GD', startDate: '2026-11-03T23:30:00Z', endDate: '2026-11-04T01:00:00Z' },
      0,
      null,
      'Pacific/Kiritimati',
    );
    expect(s).toMatchObject({
      date: '2026-11-04',
      day: '04',
      month: 'Nov',
      weekday: 'Mittwoch',
      time: '13:30 Uhr',
    });
  });

  it('Berlin wie bisher', () => {
    const s = mapEventToService(
      { id: 1, name: 'GD', startDate: '2026-10-18T08:00:00Z', endDate: '2026-10-18T09:30:00Z' },
      0,
      null,
      'Europe/Berlin',
    );
    expect(s).toMatchObject({ day: '18', month: 'Okt', weekday: 'Sonntag', time: '10:00 Uhr' });
  });
});
