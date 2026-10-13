import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import { planAus, platzAus } from './plan';
import type { RohTermin } from './termine';

const ICH = 1;
// Wie an der Test-Instanz gemessen: Technik (3) mit Licht/Ton, Musik (4) mit Gesang, Programm (1) mit Predigt.
const DIENSTE = diensteAus([
  { id: 6, name: 'Ton', serviceGroupId: 3, sortKey: 0 },
  { id: 7, name: 'Licht', serviceGroupId: 3, sortKey: 0 },
  { id: 9, name: 'Gesang', serviceGroupId: 4, sortKey: 100 },
  { id: 1, name: 'Predigt', serviceGroupId: 1, sortKey: 0 },
  { id: 20, name: 'Ohne Gruppe', serviceGroupId: null },
]);
const GRUPPEN = [
  { id: 1, name: 'Programm' },
  { id: 3, name: 'Technik' },
  { id: 4, name: 'Musik' },
];

const termin = (
  id: number,
  startDate: string,
  plaetze: object[],
  extra: object = {},
): RohTermin => ({
  id,
  name: `T${id}`,
  startDate,
  endDate: startDate,
  eventServices: plaetze,
  ...extra,
});

const plan = (roh: RohTermin[], planbarGruppen: number[] = [3]) =>
  planAus(roh, {
    ichId: ICH,
    dienste: DIENSTE,
    dienstgruppen: GRUPPEN,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => d.dienstgruppeId !== null && planbarGruppen.includes(d.dienstgruppeId),
  });

describe('platzAus', () => {
  it('frei, zugesagt, angefragt, Gast, ich', () => {
    expect(platzAus({ personId: null, name: null }, ICH)).toMatchObject({
      art: 'frei',
      name: null,
    });
    expect(platzAus({ personId: 5, name: 'Anna', isAccepted: true }, ICH)).toMatchObject({
      art: 'zugesagt',
      name: 'Anna',
      gast: false,
      ich: false,
    });
    expect(platzAus({ personId: ICH, name: 'Alwin', isAccepted: false }, ICH)).toMatchObject({
      art: 'angefragt',
      ich: true,
    });
    expect(platzAus({ personId: null, name: 'Gastprediger' }, ICH)).toMatchObject({ gast: true });
  });

  it('„Namen verbergen“: besetzt, aber ohne Namen – der mitgeschickte echte Name fällt weg', () => {
    const p = platzAus({ personId: -2, name: 'Echter Name', isAccepted: true }, ICH);
    expect(p).toEqual({ art: 'zugesagt', name: null, gast: false, verborgen: true, ich: false });
  });
});

describe('planAus', () => {
  const roh = [
    termin(11, '2026-10-25T09:00:00Z', [
      { serviceId: 6, personId: 5, name: 'Anna', isAccepted: true },
      { serviceId: 9, personId: null, name: null },
    ]),
    termin(10, '2026-10-18T08:00:00Z', [
      { serviceId: 7, personId: null, name: null },
      { serviceId: 6, personId: ICH, name: 'Alwin', isAccepted: false },
      { serviceId: 1, personId: 3, name: 'Ben', isAccepted: true },
    ]),
  ];

  it('Spalten nach Zeit, mit Ortszeit, Plätzen und besetzten', () => {
    expect(plan(roh).spalten).toEqual([
      {
        id: 10,
        name: 'T10',
        tag: '2026-10-18',
        uhrzeit: '10:00',
        abgesagt: false,
        plaetze: 3,
        besetzt: 2,
        admin: false,
      },
      {
        id: 11,
        name: 'T11',
        tag: '2026-10-25',
        uhrzeit: '10:00',
        abgesagt: false,
        plaetze: 2,
        besetzt: 1,
        admin: false,
      },
    ]);
  });

  it('Gruppen und Dienste in der Reihenfolge der Gemeinde; nur Dienste, die vorkommen', () => {
    const p = plan(roh);
    expect(p.gruppen.map((g) => [g.gruppe?.name, g.zeilen.map((z) => z.dienst.name)])).toEqual([
      ['Programm', ['Predigt']],
      ['Technik', ['Licht', 'Ton']],
      ['Musik', ['Gesang']],
    ]);
  });

  it('Zellen: null, wo der Dienst am Termin nicht vorgesehen ist; sonst die Plätze', () => {
    const technik = plan(roh).gruppen.find((g) => g.gruppe?.id === 3)!;
    const licht = technik.zeilen.find((z) => z.dienst.name === 'Licht')!;
    expect(licht.zellen.map((c) => c?.map((x) => x.art) ?? null)).toEqual([['frei'], null]);
    const ton = technik.zeilen.find((z) => z.dienst.name === 'Ton')!;
    expect(ton.zellen.map((c) => c?.map((x) => x.name) ?? null)).toEqual([['Alwin'], ['Anna']]);
  });

  it('freie Plätze je Gruppe und Spalte; null, wo die Gruppe nichts hat', () => {
    const p = plan(roh);
    expect(p.gruppen.map((g) => [g.gruppe?.name, g.frei])).toEqual([
      ['Programm', [0, null]],
      ['Technik', [1, 0]],
      ['Musik', [null, 1]],
    ]);
  });

  it('planbar je Gruppe aus der Regel; Termin-Admin steht an der Spalte', () => {
    const p = plan([...roh, termin(12, '2026-11-01T09:00:00Z', [], { eventAdminIds: [ICH] })]);
    expect(p.gruppen.map((g) => [g.gruppe?.name, g.planbar])).toEqual([
      ['Programm', false],
      ['Technik', true],
      ['Musik', false],
    ]);
    expect(p.spalten.map((s) => s.admin)).toEqual([false, false, true]);
  });

  it('Dienste ohne bekannte Dienstgruppe stehen am Ende in einer Gruppe ohne Namen', () => {
    const p = plan([
      termin(1, '2026-10-18T08:00:00Z', [{ serviceId: 20, personId: null, name: null }]),
    ]);
    expect(p.gruppen.map((g) => [g.gruppe, g.zeilen.map((z) => z.dienst.name)])).toEqual([
      [null, ['Ohne Gruppe']],
    ]);
  });

  it('abgesagte Termine bleiben als Spalte stehen (markiert)', () => {
    const p = plan([termin(1, '2026-10-18T08:00:00Z', [], { isCanceled: true })]);
    expect(p.spalten[0].abgesagt).toBe(true);
  });
});
