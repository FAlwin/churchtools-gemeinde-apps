import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import { planAus } from './plan';
import type { RohTermin } from './termine';
import { werWieOft } from './werWieOft';

const DIENSTE = diensteAus([
  { id: 6, name: 'Ton', serviceGroupId: 3 },
  { id: 7, name: 'Licht', serviceGroupId: 3 },
  { id: 9, name: 'Gesang', serviceGroupId: 4 },
]);
const GRUPPEN = [
  { id: 3, name: 'Technik' },
  { id: 4, name: 'Musik' },
];
const t = (id: number, startDate: string, eventServices: object[]): RohTermin => ({
  id,
  name: 'GD',
  startDate,
  endDate: startDate,
  eventServices,
});

const PLAN = planAus(
  [
    t(1, '2026-10-18T08:00:00Z', [
      { serviceId: 6, personId: 5, name: 'Anna', isAccepted: true },
      { serviceId: 9, personId: 5, name: 'Anna', isAccepted: false },
      { serviceId: 7, personId: null, name: null },
    ]),
    t(2, '2026-10-25T09:00:00Z', [
      { serviceId: 6, personId: 8, name: 'Ben', isAccepted: true },
      { serviceId: 9, personId: null, name: 'Gastsängerin', isAccepted: true },
      { serviceId: 7, personId: -2, name: 'Verborgen', isAccepted: true },
    ]),
    t(3, '2026-11-01T09:00:00Z', [{ serviceId: 6, personId: 5, name: 'Anna', isAccepted: true }]),
  ],
  {
    ichId: 1,
    dienste: DIENSTE,
    dienstgruppen: GRUPPEN,
    zeitzone: 'Europe/Berlin',
    planbar: () => true,
  },
);

const alle = { spalten: [0, 1, 2], gruppeSichtbar: () => true };

describe('werWieOft', () => {
  it('Einsätze je Person, meiste zuerst; Gäste nach Namen; verborgene und freie Plätze fehlen', () => {
    const { personen, schnitt } = werWieOft(PLAN, alle);
    expect(personen.map((p) => [p.name, p.einsaetze.length, p.gast])).toEqual([
      ['Anna', 3, false],
      ['Ben', 1, false],
      ['Gastsängerin', 1, true],
    ]);
    expect(schnitt).toBeCloseTo(5 / 3);
    expect(JSON.stringify(personen)).not.toContain('Verborgen');
  });

  it('Dienste ohne Doppelte; Einsätze in Zeitfolge, mit Zusage', () => {
    const anna = werWieOft(PLAN, alle).personen[0];
    expect(anna.dienste.sort()).toEqual(['Gesang', 'Ton']);
    expect(anna.einsaetze.map((e) => [e.spalte.tag, e.dienst, e.zugesagt])).toEqual([
      ['2026-10-18', 'Ton', true],
      ['2026-10-18', 'Gesang', false],
      ['2026-11-01', 'Ton', true],
    ]);
  });

  it('nur sichtbare Spalten und Gruppen', () => {
    const nurMusikErsterTermin = werWieOft(PLAN, { spalten: [0], gruppeSichtbar: (g) => g === 4 });
    expect(nurMusikErsterTermin.personen.map((p) => [p.name, p.einsaetze.length])).toEqual([
      ['Anna', 1],
    ]);
  });

  it('niemand eingeteilt → leer, Schnitt 0', () => {
    expect(werWieOft(PLAN, { spalten: [], gruppeSichtbar: () => true })).toEqual({
      personen: [],
      schnitt: 0,
    });
  });
});

describe('werWieOft – Personen nach ID', () => {
  it('zwei Personen gleichen Namens werden getrennt gezählt', () => {
    const p = planAus(
      [
        t(1, '2026-10-18T08:00:00Z', [
          { serviceId: 6, personId: 5, name: 'Anna', isAccepted: true },
          { serviceId: 9, personId: 6, name: 'Anna', isAccepted: true },
        ]),
      ],
      {
        ichId: 1,
        dienste: DIENSTE,
        dienstgruppen: GRUPPEN,
        zeitzone: 'Europe/Berlin',
        planbar: () => true,
      },
    );
    expect(werWieOft(p, alle).personen.map((x) => [x.name, x.einsaetze.length])).toEqual([
      ['Anna', 1],
      ['Anna', 1],
    ]);
  });
});
