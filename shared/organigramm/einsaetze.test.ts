import { describe, expect, it } from 'vitest';
import type { RohTermin } from '../dienstplan/termine';
import { diensteAus } from '../ct/dienste';
import { einsaetzeAus, offenVonGruppe, zeitraum } from './einsaetze';

const JETZT = new Date('2026-10-22T12:00:00Z');
const termin = (
  startDate: string,
  plaetze: RohTermin['eventServices'],
  extra: Partial<RohTermin> = {},
) =>
  ({
    id: 1,
    name: 'Gottesdienst',
    startDate,
    endDate: startDate,
    eventServices: plaetze,
    ...extra,
  }) as RohTermin;

describe('einsaetzeAus', () => {
  const T = [
    termin('2026-10-11T08:00:00Z', [
      { serviceId: 6, personId: 1, name: 'Alex' },
      { serviceId: 6, personId: 2, name: 'Bea' },
      { serviceId: 7, personId: null, name: null },
    ]),
    termin('2026-10-18T08:00:00Z', [{ serviceId: 6, personId: 1, name: 'Alex' }]),
    termin('2026-10-25T08:00:00Z', [
      { serviceId: 6, personId: 1, name: 'Alex' },
      { serviceId: 7, personId: null, name: '' },
      { serviceId: 7, personId: null, name: null },
    ]),
  ];

  it('zählt vergangen/kommend je Person, je Dienst und den letzten Einsatz', () => {
    const e = einsaetzeAus(T, JETZT).jePerson.get(1)!;
    expect(e.vergangen).toBe(2);
    expect(e.kommend).toBe(1);
    expect(e.letzter).toBe('2026-10-18T08:00:00Z');
    expect([...e.jeDienst]).toEqual([[6, 2]]);
  });

  it('freie Plätze nur in KOMMENDEN Terminen; frei = ohne Namen (auch leerer Text)', () => {
    expect([...einsaetzeAus(T, JETZT).offenJeDienst]).toEqual([[7, 2]]);
  });

  it('abgesagter Termin zählt weder Einsätze noch freie Plätze', () => {
    const e = einsaetzeAus(
      [
        termin(
          '2026-10-25T08:00:00Z',
          [
            { serviceId: 6, personId: 1, name: 'Alex' },
            { serviceId: 7, name: null },
          ],
          { isCanceled: true },
        ),
      ],
      JETZT,
    );
    expect(e.jePerson.size).toBe(0);
    expect(e.offenJeDienst.size).toBe(0);
  });

  it('„Namen verbergen“ (-2), Gast ohne Person und ungültiger Platz zählen für niemanden', () => {
    const e = einsaetzeAus(
      [
        termin('2026-10-11T08:00:00Z', [
          { serviceId: 6, personId: -2, name: 'Echter Name' },
          { serviceId: 6, personId: null, name: 'Gastprediger' },
          { serviceId: 6, personId: 3, name: 'Cara', isValid: false } as never,
        ]),
      ],
      JETZT,
    );
    expect(e.jePerson.size).toBe(0);
  });
});

describe('offenVonGruppe', () => {
  const dienste = diensteAus([
    { id: 7, name: 'Café', serviceGroupId: 6, groupIds: [47, 49] },
    { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [15] },
  ]);
  const offen = new Map([
    [7, 5],
    [6, 2],
  ]);
  it('Dienst mit mehreren Gruppen zählt nur an der ersten', () => {
    expect(offenVonGruppe(dienste, offen, 47)).toBe(5);
    expect(offenVonGruppe(dienste, offen, 49)).toBe(0);
    expect(offenVonGruppe(dienste, offen, 15)).toBe(2);
  });
  it('ohne Dienste → 0', () => {
    expect(offenVonGruppe(null, offen, 47)).toBe(0);
  });
});

describe('zeitraum', () => {
  it('6 Monate zurück, 3 voraus', () => {
    expect(zeitraum(JETZT)).toEqual({ von: '2026-04-22', bis: '2027-01-22' });
  });
});
