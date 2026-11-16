import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import type { EntwurfZiel } from './entwuerfe';
import {
  einsaetzeUm,
  einsaetzeUmText,
  fokusKandidaten,
  fokusZahlen,
  fokusZahlenText,
  passtZuName,
  platzPerson,
  UM_TAGE,
  type FokusEntwurf,
} from './fokus';
import { planAus, type Plan } from './plan';
import type { PlanAus } from './planFilter';
import type { RohTermin } from './termine';

/**
 * Tests gegen die Erzeuger (`planAus` mit rohen Terminen). Technik: Ton (6), Bild (7); Musik: Gesang (9).
 * Daniel (12) steht an vier Plätzen: Ton 06.12. (zugesagt), Gesang 06.12. (angefragt), Bild 13.12. (zugesagt) und – nach
 * dem Abbruch des Termins 23.12. – Ton dort (abgesagt, zählt nicht).
 */
const DIENSTE = diensteAus([
  { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
  { id: 7, name: 'Bild', serviceGroupId: 3, groupIds: [7], sortKey: 2 },
  { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9], sortKey: 3 },
]);
const GRUPPEN = [
  { id: 3, name: 'Technik', fuerAlle: false },
  { id: 4, name: 'Musik', fuerAlle: false },
];
const platz = (
  serviceId: number,
  personId: number | null,
  name: string | null,
  zu = true,
  index = 1,
) => ({ serviceId, personId, name, isAccepted: zu, index });
const ROH: RohTermin[] = [
  {
    id: 1,
    name: 'Gottesdienst',
    startDate: '2026-12-06T08:00:00Z',
    endDate: '2026-12-06T10:00:00Z',
    eventServices: [
      platz(6, 12, 'Daniel Test'),
      platz(7, 5, 'Anna Test'),
      platz(9, 12, 'Daniel Test', false),
    ],
  },
  {
    id: 2,
    name: 'Gebetsabend',
    startDate: '2026-12-09T17:00:00Z',
    endDate: '2026-12-09T18:30:00Z',
    eventServices: [
      platz(9, 5, 'Anna Test'),
      platz(9, null, 'Gastsänger', true, 2), // Gast
      platz(6, -2, 'Echter Name'), // „Namen verbergen“
    ],
  },
  {
    id: 3,
    name: 'Gottesdienst',
    startDate: '2026-12-13T08:00:00Z',
    endDate: '2026-12-13T10:00:00Z',
    eventServices: [platz(7, 12, 'Daniel Test'), platz(6, null, null)],
  },
  {
    id: 4,
    name: 'Weihnachten',
    startDate: '2026-12-23T08:00:00Z',
    endDate: '2026-12-23T10:00:00Z',
    isCanceled: true,
    eventServices: [platz(6, 12, 'Daniel Test')],
  },
] as RohTermin[];
const PLAN: Plan = planAus(ROH, {
  ichId: 1,
  dienste: DIENSTE,
  dienstgruppen: GRUPPEN,
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
});
const ALLE = PLAN.spalten.map((_, i) => i);
const NICHTS_AUS: PlanAus = { gruppen: [], dienste: [] };

/** Ein Entwurf am Platz (Ton, 13.12.) – so, wie ihn `Sicht.entwurf` liefert. */
const entwurfAn =
  (ziel: EntwurfZiel, veraltet = false): FokusEntwurf =>
  (spalte, zeile) =>
    spalte === 2 && zeile.dienst.id === 6 ? { entwurf: { ziel }, veraltet } : null;

describe('platzPerson – wer steht dort?', () => {
  const zelle = (dienst: number, spalte: number, nr = 0) =>
    PLAN.gruppen.flatMap((g) => g.zeilen).find((z) => z.dienst.id === dienst)!.zellen[spalte]![nr];

  it('zugesagt und angefragt: die Person mit Stand', () => {
    expect(platzPerson(zelle(6, 0), null)).toEqual({
      personId: 12,
      name: 'Daniel Test',
      stand: 'zugesagt',
    });
    expect(platzPerson(zelle(9, 0), null)?.stand).toBe('angefragt');
  });

  it('frei, Gast und „Namen verbergen“ sind niemand – nie fokussierbar', () => {
    expect(platzPerson(zelle(6, 2), null)).toBeNull(); // frei
    expect(platzPerson(zelle(9, 1, 1), null)).toBeNull(); // Gast
    expect(platzPerson(zelle(6, 1), null)).toBeNull(); // verborgen
  });

  it('ein gültiger Entwurf zählt als der Platz, der er wird; veraltet, Gast und Zurückziehen nicht', () => {
    const frei = zelle(6, 2);
    expect(
      platzPerson(frei, {
        entwurf: { ziel: { art: 'person', personId: 7, name: 'Ben' } },
        veraltet: false,
      }),
    ).toEqual({ personId: 7, name: 'Ben', stand: 'entwurf' });
    expect(
      platzPerson(frei, {
        entwurf: { ziel: { art: 'person', personId: 7, name: 'Ben' } },
        veraltet: true,
      }),
    ).toBeNull();
    expect(
      platzPerson(frei, { entwurf: { ziel: { art: 'gast', name: 'Max' } }, veraltet: false }),
    ).toBeNull();
    // Zurückziehen: der Platz wird frei – die Person, die dort noch steht, ist nicht mehr „dort“.
    expect(
      platzPerson(zelle(6, 0), { entwurf: { ziel: { art: 'frei' } }, veraltet: false }),
    ).toBeNull();
  });
});

describe('fokusZahlen – was die Leiste zählt', () => {
  it('zählt zugesagt, angefragt und Termine; abgesagte Termine zählen nicht', () => {
    expect(fokusZahlen(PLAN, { personId: 12, spalten: ALLE, aus: NICHTS_AUS })).toEqual({
      einsaetze: 3,
      termine: 2,
      angefragt: 1,
      entwuerfe: 0,
      ausgeblendet: 0,
    });
  });

  it('nur die übergebenen Termine', () => {
    expect(fokusZahlen(PLAN, { personId: 12, spalten: [2], aus: NICHTS_AUS }).einsaetze).toBe(1);
    expect(fokusZahlen(PLAN, { personId: 12, spalten: [], aus: NICHTS_AUS }).einsaetze).toBe(0);
  });

  it('ein Entwurf auf die Person zählt mit, ein Entwurf auf eine andere nicht; veraltet gilt ChurchTools', () => {
    const mit = (e: FokusEntwurf) =>
      fokusZahlen(PLAN, { personId: 12, spalten: ALLE, aus: NICHTS_AUS, entwurf: e });
    const daniel: EntwurfZiel = { art: 'person', personId: 12, name: 'Daniel Test' };
    expect(mit(entwurfAn(daniel))).toMatchObject({ einsaetze: 4, entwuerfe: 1 });
    expect(mit(entwurfAn({ art: 'person', personId: 7, name: 'Ben' })).einsaetze).toBe(3);
    expect(mit(entwurfAn(daniel, true)).einsaetze).toBe(3);
  });

  it('ausgeblendete Dienste und Gruppen zählen mit – und werden dazu gesagt', () => {
    const z = (aus: PlanAus) => fokusZahlen(PLAN, { personId: 12, spalten: ALLE, aus });
    // Bild (7) aus: der Einsatz am 13.12. ist versteckt, aber ein Einsatz.
    expect(z({ gruppen: [], dienste: [7] })).toMatchObject({ einsaetze: 3, ausgeblendet: 1 });
    // Ganze Gruppe Musik aus (Schlüssel = Gruppen-ID als Text): der Gesang am 06.12.
    expect(z({ gruppen: ['4'], dienste: [] })).toMatchObject({ einsaetze: 3, ausgeblendet: 1 });
  });

  it('verglichen wird die personId, nie der Name', () => {
    expect(fokusZahlen(PLAN, { personId: 999, spalten: ALLE, aus: NICHTS_AUS }).einsaetze).toBe(0);
    // Verborgen (-2) ist über seine ID nicht anzuleuchten.
    expect(fokusZahlen(PLAN, { personId: -2, spalten: ALLE, aus: NICHTS_AUS }).einsaetze).toBe(0);
  });
});

describe('fokusZahlenText', () => {
  it('nennt nur, was nicht null ist', () => {
    expect(
      fokusZahlenText({ einsaetze: 5, termine: 5, angefragt: 1, entwuerfe: 1, ausgeblendet: 1 }),
    ).toBe('5 Einsätze in 5 Terminen · 1 angefragt · 1 Entwurf · 1 ausgeblendet');
    expect(
      fokusZahlenText({ einsaetze: 1, termine: 1, angefragt: 0, entwuerfe: 0, ausgeblendet: 0 }),
    ).toBe('1 Einsatz in 1 Termin');
    expect(
      fokusZahlenText({ einsaetze: 0, termine: 0, angefragt: 0, entwuerfe: 0, ausgeblendet: 0 }),
    ).toBe('keine Einsätze in diesen Terminen');
  });
});

describe('fokusKandidaten – das Suchfeld', () => {
  it('alle Eingeteilten alphabetisch mit ihren Diensten; weder Gäste noch Verborgene', () => {
    expect(fokusKandidaten(PLAN)).toEqual([
      { personId: 5, name: 'Anna Test', dienste: ['Bild', 'Gesang'] },
      { personId: 12, name: 'Daniel Test', dienste: ['Ton', 'Bild', 'Gesang'] },
    ]);
  });

  it('auch Personen nur im Entwurf', () => {
    const ben: EntwurfZiel = { art: 'person', personId: 7, name: 'Ben Test' };
    expect(fokusKandidaten(PLAN, entwurfAn(ben)).map((k) => k.name)).toEqual([
      'Anna Test',
      'Ben Test',
      'Daniel Test',
    ]);
  });
});

describe('einsaetzeUm – die Mini-Zeile in „Wer kann?“', () => {
  it('nur ±7 Tage um den Termin, nach Datum; abgesagte fehlen', () => {
    const um = (tag: string) =>
      einsaetzeUm(PLAN, { personId: 12, tag }).map((e) => e.dienst + e.tag);
    expect(um('2026-12-09')).toEqual(['Ton2026-12-06', 'Gesang2026-12-06', 'Bild2026-12-13']);
    // 13.12. ± 7: der 06.12. liegt genau auf der Grenze (7 Tage), der abgesagte 23.12. außerhalb ohnehin.
    expect(um('2026-12-13')).toEqual(['Ton2026-12-06', 'Gesang2026-12-06', 'Bild2026-12-13']);
    expect(um('2026-12-14')).toEqual(['Bild2026-12-13']);
    expect(UM_TAGE).toBe(7);
  });

  it('der Text: Dienst und Tag, Entwurf und Anfrage gekennzeichnet, mehr als drei gekürzt', () => {
    expect(einsaetzeUmText([])).toBe('Im Plan, ±7 Tage: noch nichts');
    expect(
      einsaetzeUmText([
        { dienst: 'Gesang', tag: '2026-12-09', stand: 'zugesagt' },
        { dienst: 'Bild', tag: '2026-12-13', stand: 'angefragt' },
        { dienst: 'Kamera', tag: '2026-12-13', stand: 'entwurf' },
      ]),
    ).toBe('Im Plan, ±7 Tage: Gesang Mi 09.12. · Bild So 13.12. (?) · Kamera So 13.12. (Entwurf)');
    expect(
      einsaetzeUmText(
        Array.from({ length: 5 }, () => ({
          dienst: 'Ton',
          tag: '2026-12-06',
          stand: 'zugesagt' as const,
        })),
      ),
    ).toMatch(/· \+ 2 weitere$/);
  });
});

describe('passtZuName – das Suchfeld trifft Wortanfänge', () => {
  it('Name oder ein Wort dahinter; nie mitten im Wort; leer trifft nichts', () => {
    expect(passtZuName('Daniel Test', 'da')).toBe(true);
    expect(passtZuName('Daniel Test', 'TES')).toBe(true);
    expect(passtZuName('Daniel Test', 'dan test')).toBe(false);
    expect(passtZuName('Daniel Test', 'nie')).toBe(false);
    expect(passtZuName('Daniel Test', '  ')).toBe(false);
  });
});
