import { describe, expect, it } from 'vitest';
import { neueAbsenceSchema } from './absencesController.js';

/**
 * Die Zeitfenster einer Abwesenheit nach dem Umstieg auf zod 4 (#849). zod 4 prüft `datetime` strenger als zod 3:
 * ohne Sekunden oder mit Abstand ohne Doppelpunkt geht nichts mehr durch. Die Formen, die ChurchTools liefert
 * (gemessen 05.11.2026: `JJJJ-MM-TTTHH:MM:SSZ`), und ein Abstand wie an anderen Instanzen müssen weiter gehen.
 */
const mit = (startTime: string) =>
  neueAbsenceSchema.safeParse({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    startTime,
    endTime: startTime,
  }).success;

describe('Abwesenheit: Zeitpunkte nach zod 4 (#849)', () => {
  it('wie ChurchTools sie liefert – mit Z, mit Millisekunden, mit Abstand', () => {
    expect(mit('2026-10-04T08:00:00Z')).toBe(true);
    expect(mit('2026-10-04T08:00:00.000Z')).toBe(true);
    expect(mit('2026-10-04T10:00:00+02:00')).toBe(true);
  });

  it('kein Zeitpunkt → abgelehnt', () => {
    expect(mit('2026-10-04')).toBe(false);
    expect(mit('kaputt')).toBe(false);
  });
});
