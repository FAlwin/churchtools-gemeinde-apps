import { describe, expect, it } from 'vitest';
import { diensteAus } from '@shared/ct/dienste';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { daten, entwurf } from './entwurfAnschluss.testutil';
import { zauberZeilen } from './planEntwuerfe';

/** Zauberstab: abgesagte Termine (`nimmtEintraegeAn`) und vergangene werden ausgelassen – der Rest wird gefüllt. */
const DIENSTE = diensteAus([{ id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 }]);
const termin = (id: number, startDate: string, extra = {}): RohTermin => ({
  id,
  name: 'Gottesdienst',
  startDate,
  endDate: startDate,
  eventServices: [{ serviceId: 6, personId: null, name: null, index: 1 }],
  ...extra,
});
const PLAN = planAus(
  [
    termin(1, '2026-11-10T09:00:00Z'), // vergangen (heute = 16.11.)
    termin(2, '2026-11-22T09:00:00Z'),
    termin(3, '2026-11-29T09:00:00Z', { isCanceled: true }),
  ],
  {
    ichId: 1,
    dienste: DIENSTE,
    dienstgruppen: [{ id: 3, name: 'Technik', fuerAlle: false }],
    zeitzone: 'Europe/Berlin',
    planbar: () => true,
    ganzSichtbar: () => true,
  },
);

describe('zauberZeilen – wohin der Zauberstab füllt', () => {
  it('nur in Termine, die Einträge annehmen und nicht vorbei sind', () => {
    const r = zauberZeilen(PLAN, daten(), '2026-11-16', [0, 1, 2], PLAN.gruppen[0]);
    expect(r.zeilen.map((z) => z.terminId)).toEqual([2]);
  });

  it('ein abgesagter Termin allein: nichts zu füllen', () => {
    expect(zauberZeilen(PLAN, daten(), '2026-11-16', [2], PLAN.gruppen[0]).zeilen).toEqual([]);
  });

  it('ein Platz mit „Zurückziehen“-Entwurf bleibt, wie er ist – der Zauberstab füllt ihn nicht (anders als „Personen“)', () => {
    const belegt = planAus(
      [
        {
          id: 2,
          name: 'Gottesdienst',
          startDate: '2026-11-22T09:00:00Z',
          endDate: '2026-11-22T09:00:00Z',
          eventServices: [{ serviceId: 6, personId: 5, name: 'Anna', isAccepted: true, index: 1 }],
        },
      ],
      {
        ichId: 1,
        dienste: DIENSTE,
        dienstgruppen: [{ id: 3, name: 'Technik', fuerAlle: false }],
        zeitzone: 'Europe/Berlin',
        planbar: () => true,
        ganzSichtbar: () => true,
      },
    );
    const weg = entwurf({
      ort: { eventId: 2, serviceId: 6, index: 1 },
      ziel: { art: 'frei' },
      gesehen: { art: 'zusage', personId: 5 },
    });
    const r = zauberZeilen(belegt, daten([weg]), '2026-11-16', [0], belegt.gruppen[0]);
    expect(r.zeilen).toEqual([]);
  });
});
