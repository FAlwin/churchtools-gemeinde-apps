import { describe, expect, it } from 'vitest';
import {
  GRUNDWERTE,
  sommerferienAus,
  uebergaenge,
  werWechselt,
  wechseljahre,
} from './gruppenwechsel';
import type { KjDaten, KjMitglied } from './gruppenwechselSicht';
import { kinderDerStufen, werVorschau } from './einrichtungVorschau';

const E = {
  stufen: [
    { gruppeId: 1, name: 'Schäfchen', abAlter: 4 },
    { gruppeId: 2, name: 'Fische', abAlter: 7 },
    { gruppeId: 3, name: 'Jungschar', abAlter: 10 },
  ],
};
const JAHRE = wechseljahre(
  sommerferienAus(
    [
      { titel: 'Sommerferien NRW 2027', beginn: '2027-07-19', ende: '2027-08-31' },
      { titel: 'Sommerferien NRW 2028', beginn: '2028-07-10', ende: '2028-08-22' },
    ],
    GRUNDWERTE.ferienStichwort,
  ),
  GRUNDWERTE,
);

const kind = (personId: number, name: string, extra: Partial<KjMitglied> = {}): KjMitglied => ({
  personId,
  name,
  leitung: false,
  status: 'active',
  statusGeaendert: null,
  ...extra,
});

// Am 30.09.2027: Anna 7 (wechselt Schäfchen → Fische), Ben 5, Cleo 10 (wechselt Fische → Jungschar), Dora ohne Geburtstag.
const DATEN: KjDaten = {
  gruppen: new Map([
    [
      1,
      {
        art: 'sichtbar',
        mitglieder: [
          kind(10, 'Anna'),
          kind(11, 'Ben'),
          kind(12, 'Leitung', { leitung: true }),
          kind(13, 'Ausnahme', { status: 'to_delete' }),
        ],
      },
    ],
    [2, { art: 'sichtbar', mitglieder: [kind(20, 'Cleo'), kind(21, 'Dora')] }],
    [3, { art: 'sichtbar', mitglieder: [kind(30, 'Emil')] }],
  ]),
  geburtstage: new Map<number, string | null>([
    [10, '2020-03-15'],
    [11, '2022-03-15'],
    [12, '1980-01-01'],
    [13, '2020-03-15'],
    [20, '2017-03-15'],
    [21, null],
    [30, '2015-03-15'],
  ]),
};

describe('kinderDerStufen', () => {
  it('nur aktive Teilnehmer: keine Leitung, keine „zu löschen“', () => {
    const { kinder, nichtGelesen } = kinderDerStufen(DATEN, E);
    expect(kinder.map((k) => k.name)).toEqual(['Anna', 'Ben', 'Cleo', 'Dora', 'Emil']);
    expect(nichtGelesen).toEqual([]);
  });

  it('eine Stufe, die sich nicht lesen ließ, wird genannt – ihre Kinder fehlen nicht stillschweigend', () => {
    const d: KjDaten = { ...DATEN, gruppen: new Map([...DATEN.gruppen, [2, { art: 'fehler' }]]) };
    expect(kinderDerStufen(d, E).nichtGelesen).toEqual(['Fische']);
    const v = werVorschau(d, E, JAHRE);
    expect(v.nichtGelesen).toEqual(['Fische']);
  });
});

describe('werVorschau', () => {
  const v = werVorschau(DATEN, E, JAHRE);

  it('die Zahlen sind genau die von werWechselt (dieselbe Frage wie die Regel)', () => {
    const { kinder } = kinderDerStufen(DATEN, E);
    for (const [i, z] of v.jahre.entries()) {
      const wechsel = werWechselt(kinder, E, JAHRE[i]);
      expect(z.zahlen).toEqual(
        uebergaenge(E).map(
          (u) =>
            wechsel.filter((w) => w.art === 'wechselt' && w.von.gruppeId === u.von.gruppeId).length,
        ),
      );
    }
  });

  it('2027: Anna wechselt in die Fische, Cleo in die Jungschar; die Überschriften nennen die Übergänge', () => {
    expect(v.uebergaenge).toEqual(['Schäfchen → Fische', 'Fische → Jungschar']);
    expect(v.jahre[0].zahlen).toEqual([1, 1]);
    expect(v.namen).toEqual([['Anna'], ['Cleo']]);
  });

  it('Kinder ohne Geburtstag: gezählt, wechseln nie', () => {
    expect(v.ohneGeburtstag).toBe(1);
  });

  it('ohne Jahre: keine Zeilen, keine Namen, nichts gezählt', () => {
    const leer = werVorschau(DATEN, E, []);
    expect(leer.jahre).toEqual([]);
    expect(leer.namen).toEqual([[], []]);
    expect(leer.ohneGeburtstag).toBe(0);
  });
});
