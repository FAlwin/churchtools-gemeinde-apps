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
  { id: 1, name: 'Programm', fuerAlle: false },
  { id: 3, name: 'Technik', fuerAlle: false },
  { id: 4, name: 'Musik', fuerAlle: false },
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
    ganzSichtbar: () => true,
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
    expect(p).toEqual({
      // Die Belegung (für „Entwurf veraltet“) kennt nur die verborgene ID, nie den Namen.
      belegung: { art: 'zusage', personId: -2 },
      art: 'zugesagt',
      name: null,
      gast: false,
      verborgen: true,
      ich: false,
      personId: null,
      index: null,
    });
    expect(JSON.stringify(p)).not.toContain('Echter Name');
  });

  it('jeder Platz trägt seine Belegung – dieselbe Regel wie beim Einteilen (`belegungAus`)', () => {
    expect(platzAus({ personId: null, name: null }, ICH).belegung).toEqual({ art: 'frei' });
    expect(platzAus({ personId: 5, name: 'Anna', isAccepted: false }, ICH).belegung).toEqual({
      art: 'anfrage',
      personId: 5,
    });
    expect(platzAus({ personId: null, name: ' Max ', isAccepted: true }, ICH).belegung).toEqual({
      art: 'gast',
      name: 'Max',
    });
  });

  it('index von ChurchTools wird mitgegeben – damit findet der Schreibkern den Platz (E4-2)', () => {
    expect(platzAus({ personId: null, name: null, index: 2 }, ICH).index).toBe(2);
    expect(platzAus({ personId: 5, name: 'Anna', index: 1 }, ICH).index).toBe(1);
    expect(platzAus({ personId: -2, name: 'X', index: 3 }, ICH).index).toBe(3);
    expect(platzAus({ personId: 5, name: 'Anna' }, ICH).index).toBeNull();
  });
});

describe('planAus – planbar je Zeile (E4-2)', () => {
  it('jede Zeile weiß, ob man diesen Dienst planen darf', () => {
    const p = planAus(
      [
        {
          id: 1,
          name: 'GD',
          startDate: '2026-10-18T08:00:00Z',
          endDate: '2026-10-18T09:00:00Z',
          eventServices: [
            { serviceId: 6, personId: null, name: null },
            { serviceId: 7, personId: null, name: null },
          ],
        },
      ],
      {
        ichId: ICH,
        dienste: DIENSTE,
        dienstgruppen: GRUPPEN,
        zeitzone: 'Europe/Berlin',
        planbar: (d) => d.id === 6,
        ganzSichtbar: () => true,
      },
    );
    expect(p.gruppen[0].zeilen.map((z) => [z.dienst.name, z.planbar])).toEqual([
      ['Licht', false],
      ['Ton', true],
    ]);
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

describe('planAus – nur Dienste, die ChurchTools ganz liefert', () => {
  // Ein Mitglied, das Technik leitet: Musik kommt nur mit dem eigenen Eintrag (gemessen 13.10.2026).
  const roh = [
    termin(11, '2026-10-25T09:00:00Z', [
      { serviceId: 6, personId: 5, name: 'Anna', isAccepted: true },
      { serviceId: 7, personId: null, name: null },
      { serviceId: 9, personId: ICH, name: 'Alwin', isAccepted: true },
    ]),
  ];
  const p = planAus(roh, {
    ichId: ICH,
    dienste: DIENSTE,
    dienstgruppen: GRUPPEN,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => d.dienstgruppeId === 3,
    ganzSichtbar: (d) => d.dienstgruppeId === 3,
  });

  it('ein nur teilweise gelieferter Dienst bekommt keine Zeile – auch die Gruppe fällt weg', () => {
    expect(p.gruppen.map((g) => [g.gruppe?.name, g.zeilen.map((z) => z.dienst.name)])).toEqual([
      ['Technik', ['Licht', 'Ton']],
    ]);
  });

  it('der Kopf zählt dieselben Plätze wie die Zeilen', () => {
    expect(p.spalten[0]).toMatchObject({ plaetze: 2, besetzt: 1 });
  });
});
